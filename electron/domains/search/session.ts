import type { MeetingSearchPrefs } from '../settings/meeting-search-prefs'
import type {
  SearchDownload,
  SearchIndexActivity,
  SearchPhase,
  SearchRecordView,
  SearchRuntimeHint
} from '../../shared/search-contract'
import { parseDownloadPercent } from './models'
import type { QmdLaunch } from './qmd-bin'
import { qmdChildCwd, qmdChildEnv, type CommandResult, type CommandRunner } from './qmd-spawn'
import type { SearchQueue } from './queue'

export interface NodeProbe {
  ok: boolean
  major: number | null
}

export interface SearchDeps {
  userDataDir: string
  recordingsDir: string
  isRecording: () => boolean
  now?: () => Date
  run?: CommandRunner
  lookup?: (name: 'node' | 'npm' | 'qmd') => Promise<string | null>
  probeNode?: (nodePath: string) => Promise<NodeProbe>
  schedule?: (fn: () => void, ms: number) => () => void
  pollMs?: number
}

export interface SearchSession {
  deps: SearchDeps
  now: () => Date
  run: CommandRunner
  lookup: (name: 'node' | 'npm' | 'qmd') => Promise<string | null>
  probeNode: (nodePath: string) => Promise<NodeProbe>
  queue: SearchQueue
  prefs: MeetingSearchPrefs
  phase: SearchPhase
  modelsReady: boolean
  download: SearchDownload | null
  index: SearchIndexActivity
  error: string | null
  records: Record<string, SearchRecordView>
  runtime: SearchRuntimeHint
  helpText: string
  stdoutBuf: string
  cancelled: boolean
  pollTimer: ReturnType<typeof setInterval> | null
  emit: () => void
}

export function emptyRuntime(): SearchRuntimeHint {
  return { nodeOk: false, qmdOnPath: false, installed: false, needsDownload: true }
}

export async function runChild(
  session: SearchSession,
  command: string,
  args: string[]
): Promise<CommandResult> {
  const child = session.run(
    {
      command,
      args,
      env: qmdChildEnv(session.deps.userDataDir),
      cwd: qmdChildCwd(session.deps.userDataDir)
    },
    {
      onStdout(chunk) {
        session.stdoutBuf += chunk
        if (session.download) session.download.percent = parseDownloadPercent(session.stdoutBuf)
      },
      onStderr() {}
    }
  )
  session.queue.bindKill(() => child.kill())
  return child.result
}

export async function runQmd(
  session: SearchSession,
  launch: QmdLaunch,
  args: string[]
): Promise<CommandResult> {
  if (launch.kind === 'missing') {
    return { code: 1, stdout: '', stderr: 'qmd is not available.', signal: null }
  }
  if (launch.kind === 'js') return runChild(session, launch.nodePath, [launch.jsPath, ...args])
  return runChild(session, launch.command, args)
}
