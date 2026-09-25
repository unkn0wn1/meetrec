import { existsSync } from 'node:fs'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { isSafeRecordingId } from '../../capture/paths'
import { recordingLayout } from '../recording/layout'
import {
  helpLists,
  qmdCollectionRemoveArgs,
  qmdEmbedArgs,
  qmdQueryArgs,
  qmdUpdateArgs
} from './argv'
import { parseSearchHits } from './hits'
import {
  exportLine,
  loadSearchRecords,
  prepareExport,
  readCatchUpAt,
  removeSearchSidecars,
  staleMeetingIds,
  stderrTail,
  writeCatchUpAt
} from './meeting-files'
import { qmdExportDir, qmdExportPath, qmdIndexDbPath } from './paths'
import { ensureMeetingsCollection, readHelp, resolveLaunch } from './runtime'
import { runQmd, type SearchSession } from './session'
import { readSearchStatus, searchStatusPath, writeSearchStatus } from './status-file'
import type { SearchHit } from '../../shared/search-contract'

const CATCH_UP_MS = 24 * 60 * 60 * 1000

export async function indexRecordings(
  session: SearchSession,
  ids: string[],
  refresh: boolean
): Promise<void> {
  if (!session.prefs.enabled) return
  const launch = await resolveLaunch(session, false)
  if (!launch) return
  session.index = { running: true, currentId: ids[0] ?? null }
  session.emit()
  const batch: { id: string; token: string }[] = []
  try {
    for (const id of ids) {
      const prepared = prepareExport(session.deps.recordingsDir, id)
      if (!prepared) continue
      await mkdir(qmdExportDir(session.deps.userDataDir), { recursive: true })
      await writeFile(qmdExportPath(session.deps.userDataDir, id), prepared.markdown, 'utf8')
      batch.push({ id: prepared.id, token: prepared.token })
      await mark(session, id, 'pending', null, prepared.token)
    }
    if (batch.length === 0 && !refresh) return
    await ensureMeetingsCollection(session, launch)
    const updated = await runQmd(session, launch, qmdUpdateArgs())
    if (updated.code !== 0) {
      await markBatch(session, batch, stderrTail(updated.stderr) || 'Index update failed.')
      return
    }
    const embedded = await runQmd(session, launch, qmdEmbedArgs())
    if (embedded.code !== 0) {
      await markBatch(session, batch, stderrTail(embedded.stderr) || 'Index embed failed.')
      return
    }
    for (const item of batch) {
      const status = await readSearchStatus(searchStatusPath(session.deps.recordingsDir, item.id))
      if (status.sourceToken !== item.token) continue
      await mark(session, item.id, 'indexed', null, item.token)
    }
  } finally {
    session.index = { running: false, currentId: null }
    session.emit()
  }
}

export async function queryMeetings(session: SearchSession, text: string): Promise<SearchHit[]> {
  const launch = await resolveLaunch(session, false)
  if (!launch) throw new Error('Meeting search is not ready.')
  await ensureMeetingsCollection(session, launch)
  const result = await runQmd(session, launch, qmdQueryArgs(text))
  if (result.code !== 0) throw new Error(stderrTail(result.stderr) || 'Search failed.')
  return parseSearchHits(result.stdout, (id, line) =>
    exportLine(session.deps.userDataDir, id, line)
  )
}

export async function rebuildMeetings(session: SearchSession): Promise<void> {
  await rm(qmdExportDir(session.deps.userDataDir), { recursive: true, force: true })
  await mkdir(qmdExportDir(session.deps.userDataDir), { recursive: true })
  await removeSearchSidecars(session.deps.recordingsDir)
  session.records = {}
  session.emit()
  const launch = await resolveLaunch(session, false)
  if (launch) {
    const help = await readHelp(session, launch)
    if (helpLists(help, 'remove')) await runQmd(session, launch, qmdCollectionRemoveArgs())
    else await rm(qmdIndexDbPath(session.deps.userDataDir), { force: true })
  }
  await indexRecordings(session, await staleMeetingIds(session.deps.recordingsDir), true)
}

export async function catchUpIfDue(session: SearchSession): Promise<void> {
  if (!session.prefs.enabled || !session.prefs.idleCatchUp || !session.modelsReady) return
  if (session.deps.isRecording() || !session.queue.idle) return
  const last = readCatchUpAt(session.deps.userDataDir)
  if (last !== null && session.now().getTime() - last < CATCH_UP_MS) return
  writeCatchUpAt(session.deps.userDataDir, session.now().toISOString())
  session.queue.enqueueIndexMany(await staleMeetingIds(session.deps.recordingsDir), {
    refresh: true
  })
}

export async function pendingIds(session: SearchSession): Promise<string[]> {
  session.records = await loadSearchRecords(session.deps.recordingsDir)
  return Object.entries(session.records)
    .filter(([, record]) => record.state === 'pending')
    .map(([id]) => id)
}

async function mark(
  session: SearchSession,
  id: string,
  state: 'pending' | 'indexed' | 'error',
  message: string | null,
  token: string | null
): Promise<void> {
  if (!isSafeRecordingId(id)) return
  const dir = recordingLayout(session.deps.recordingsDir, id).dir
  if (!existsSync(dir)) return
  await writeSearchStatus(searchStatusPath(session.deps.recordingsDir, id), {
    state,
    error: message,
    updatedAt: session.now().toISOString(),
    sourceToken: token
  })
  session.records[id] = { state, error: message }
  session.emit()
}

async function markBatch(
  session: SearchSession,
  batch: { id: string; token: string }[],
  message: string
): Promise<void> {
  for (const item of batch) await mark(session, item.id, 'error', message, item.token)
}
