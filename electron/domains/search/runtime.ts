import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import {
  collectionListed,
  helpLists,
  qmdCollectionAddArgs,
  qmdCollectionListArgs,
  qmdDoctorArgs,
  qmdEmbedArgs,
  qmdHelpArgs,
  qmdPullArgs,
  qmdWarmupArgs
} from './argv'
import { deletePartialModels, listModelFiles, stderrTail } from './meeting-files'
import { modelsReadyOnDisk, pollModelGrowth } from './models'
import { qmdCliDir, qmdExportDir, qmdRuntimePath } from './paths'
import {
  nodeProbeAccepts,
  npmInstallArgs,
  readInstalledQmd,
  resolveQmdLaunch,
  type QmdLaunch
} from './qmd-bin'
import { runChild, runQmd, type NodeProbe, type SearchSession } from './session'
import type { SearchRuntimeHint } from '../../shared/search-contract'

export const NODE_MESSAGE = 'MeetRec needs Node.js on PATH to install qmd.'

export async function lookupOnPath(name: 'node' | 'npm' | 'qmd'): Promise<string | null> {
  const finder = process.platform === 'win32' ? 'where' : 'which'
  const result = await new Promise<{ code: number | null; stdout: string }>((resolve) => {
    const child = spawn(finder, [name], {
      shell: false,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'ignore']
    })
    const chunks: Buffer[] = []
    child.stdout?.on('data', (chunk: Buffer) => chunks.push(chunk))
    child.once('error', () => resolve({ code: 1, stdout: '' }))
    child.once('exit', (code) => resolve({ code, stdout: Buffer.concat(chunks).toString('utf8') }))
  })
  if (result.code !== 0) return null
  const line = result.stdout
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .find(Boolean)
  return line && line !== process.execPath ? line : null
}

export function probeSystemNode(nodePath: string, session: SearchSession): Promise<NodeProbe> {
  return probeNode(nodePath, session)
}

async function probeNode(nodePath: string, session: SearchSession): Promise<NodeProbe> {
  const result = await runChild(session, nodePath, [
    '-e',
    'process.stdout.write(JSON.stringify({node:process.versions.node,electron:process.versions.electron||null}))'
  ])
  if (result.code !== 0) return { ok: false, major: null }
  try {
    const parsed = JSON.parse(result.stdout) as { node?: unknown; electron?: unknown }
    return nodeProbeAccepts({
      nodePath,
      electronExecPath: process.execPath,
      versionsNode: typeof parsed.node === 'string' ? parsed.node : null,
      versionsElectron: typeof parsed.electron === 'string' ? parsed.electron : null
    })
  } catch {
    return { ok: false, major: null }
  }
}

export async function inspectRuntime(session: SearchSession): Promise<SearchRuntimeHint> {
  const node = await session.lookup('node')
  const qmdPath = await session.lookup('qmd')
  const probe = node ? await session.probeNode(node) : { ok: false, major: null }
  const installed = readInstalledQmd(session.deps.userDataDir)
  return {
    nodeOk: probe.ok || installed !== null,
    qmdOnPath: !!qmdPath && qmdPath !== process.execPath,
    installed: installed !== null,
    needsDownload: !modelsReadyOnDisk(listModelFiles(session.deps.userDataDir))
  }
}

export async function resolveLaunch(
  session: SearchSession,
  install: boolean
): Promise<QmdLaunch | null> {
  const pathQmd = await session.lookup('qmd')
  const ready = resolveQmdLaunch({
    installed: readInstalledQmd(session.deps.userDataDir),
    pathQmd,
    electronExecPath: process.execPath
  })
  if (ready.kind !== 'missing') return ready
  if (!install || !session.prefs.enabled) return null
  const node = await session.lookup('node')
  const npm = await session.lookup('npm')
  const probe = node ? await session.probeNode(node) : { ok: false, major: null }
  if (!node || !npm || !probe.ok) {
    session.phase = 'needs-runtime'
    session.error = NODE_MESSAGE
    session.emit()
    return null
  }
  session.phase = 'installing'
  session.emit()
  mkdirSync(qmdCliDir(session.deps.userDataDir), { recursive: true })
  const installed = await runChild(
    session,
    npm,
    npmInstallArgs(qmdCliDir(session.deps.userDataDir))
  )
  if (!session.prefs.enabled) return null
  if (installed.code !== 0) {
    session.phase = 'error'
    session.error = stderrTail(installed.stderr) || 'qmd install failed.'
    session.emit()
    return null
  }
  writeFileSync(
    qmdRuntimePath(session.deps.userDataDir),
    `${JSON.stringify({ nodePath: node }, null, 2)}\n`
  )
  const launch = resolveQmdLaunch({
    installed: readInstalledQmd(session.deps.userDataDir),
    pathQmd,
    electronExecPath: process.execPath
  })
  return launch.kind === 'missing' ? null : launch
}

export async function downloadModels(session: SearchSession): Promise<void> {
  if (!session.prefs.enabled) return
  session.cancelled = false
  const launch = await resolveLaunch(session, true)
  if (!launch || !session.prefs.enabled) return
  session.phase = 'downloading'
  session.download = { label: '', bytes: 0, percent: null }
  session.stdoutBuf = ''
  session.emit()
  startPoll(session)
  try {
    const help = await readHelp(session, launch)
    const result = helpLists(help, 'qmd pull')
      ? await runQmd(session, launch, qmdPullArgs())
      : await warmupModels(session, launch)
    if (!session.prefs.enabled) return
    if (session.cancelled || result.signal) {
      session.cancelled = false
      session.phase = 'error'
      session.error = 'Download cancelled.'
      return
    }
    if (result.code !== 0) {
      session.phase = 'error'
      session.error = stderrTail(result.stderr) || 'Model download failed.'
      return
    }
    session.modelsReady = await doctorReady(session, launch)
    session.phase = session.modelsReady ? 'ready' : 'error'
    session.error = session.modelsReady ? null : (session.error ?? 'Models are not ready.')
  } finally {
    stopPoll(session)
    session.download = null
    session.emit()
  }
}

export async function doctorReady(session: SearchSession, launch: QmdLaunch): Promise<boolean> {
  const doctor = await runQmd(session, launch, qmdDoctorArgs())
  const onDisk = modelsReadyOnDisk(listModelFiles(session.deps.userDataDir))
  session.runtime = {
    ...session.runtime,
    needsDownload: !onDisk,
    installed: readInstalledQmd(session.deps.userDataDir) !== null || launch.kind === 'path'
  }
  if (doctor.code !== 0) session.error = stderrTail(doctor.stderr) || 'qmd doctor failed.'
  return doctor.code === 0 && onDisk
}

export async function readHelp(session: SearchSession, launch: QmdLaunch): Promise<string> {
  if (session.helpText) return session.helpText
  const result = await runQmd(session, launch, qmdHelpArgs())
  session.helpText = `${result.stdout}\n${result.stderr}`
  return session.helpText
}

export async function ensureMeetingsCollection(
  session: SearchSession,
  launch: QmdLaunch
): Promise<void> {
  await mkdir(qmdExportDir(session.deps.userDataDir), { recursive: true })
  const listed = await runQmd(session, launch, qmdCollectionListArgs())
  if (listed.code === 0 && collectionListed(listed.stdout, 'meetings')) return
  await runQmd(session, launch, qmdCollectionAddArgs(qmdExportDir(session.deps.userDataDir)))
}

export async function removePartialDownloads(session: SearchSession): Promise<void> {
  await deletePartialModels(session.deps.userDataDir)
}

async function warmupModels(session: SearchSession, launch: QmdLaunch) {
  await ensureMeetingsCollection(session, launch)
  const embedded = await runQmd(session, launch, qmdEmbedArgs())
  if (embedded.code !== 0 || !session.prefs.enabled || session.cancelled) return embedded
  return runQmd(session, launch, qmdWarmupArgs())
}

function startPoll(session: SearchSession): void {
  stopPoll(session)
  let sizes = new Map<string, number>()
  const poll = (): void => {
    const files = listModelFiles(session.deps.userDataDir)
    const progress = pollModelGrowth(sizes, files)
    sizes = new Map(files.map((file) => [file.name, file.size]))
    if (!session.download) return
    if (progress.label === session.download.label && progress.bytes === session.download.bytes)
      return
    session.download = {
      label: progress.label || session.download.label,
      bytes: progress.bytes,
      percent: session.download.percent
    }
    session.emit()
  }
  session.pollTimer = setInterval(poll, session.deps.pollMs ?? 500)
}

export function stopPoll(session: SearchSession): void {
  if (session.pollTimer) clearInterval(session.pollTimer)
  session.pollTimer = null
}
