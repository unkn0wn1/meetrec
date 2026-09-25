import { unlink } from 'node:fs/promises'
import { isSafeRecordingId } from '../../capture/paths'
import { readAppSettings, writeAppSettings } from '../settings/settings-file'
import type { MeetingSearchPrefs } from '../settings/meeting-search-prefs'
import type { SearchHit, SearchSnapshot, SearchScheduleInput } from '../../shared/search-contract'
import {
  catchUpIfDue,
  indexRecordings,
  pendingIds,
  queryMeetings,
  rebuildMeetings
} from './index-run'
import { loadMeetingPrefs, loadSearchRecords, staleMeetingIds } from './meeting-files'
import { qmdExportPath } from './paths'
import { spawnCommand } from './qmd-spawn'
import { SearchQueue, type SearchJob } from './queue'
import {
  doctorReady,
  downloadModels,
  inspectRuntime,
  lookupOnPath,
  NODE_MESSAGE,
  probeSystemNode,
  removePartialDownloads,
  resolveLaunch,
  stopPoll
} from './runtime'
import { emptyRuntime, type SearchDeps, type SearchSession } from './session'

export type { NodeProbe, SearchDeps } from './session'

export interface SearchService {
  snapshot: () => SearchSnapshot
  start: () => Promise<void>
  stop: () => void
  preflight: () => Promise<SearchSnapshot>
  enable: () => Promise<SearchSnapshot>
  disable: () => Promise<SearchSnapshot>
  setSchedule: (input: SearchScheduleInput) => Promise<SearchSnapshot>
  indexAll: () => Promise<SearchSnapshot>
  rebuild: () => Promise<SearchSnapshot>
  retry: (id: string) => Promise<SearchSnapshot>
  cancelDownload: () => SearchSnapshot
  query: (text: string) => Promise<SearchHit[]>
  notifyTranscript: (id: string) => void
  notifySummary: (id: string) => void
  notifySpeakers: (id: string) => void
  notifyDelete: (id: string) => void
  onChange: (listener: (snapshot: SearchSnapshot) => void) => () => void
}

const QUERY_MAX = 500

export function createSearchService(deps: SearchDeps): SearchService {
  const listeners = new Set<(snapshot: SearchSnapshot) => void>()
  let catchTimer: ReturnType<typeof setInterval> | null = null
  const session = {
    deps,
    now: deps.now ?? ((): Date => new Date()),
    run: deps.run ?? spawnCommand,
    lookup: deps.lookup ?? lookupOnPath,
    probeNode: (nodePath: string) => probeSystemNode(nodePath, session),
    prefs: loadMeetingPrefs(deps.userDataDir),
    phase: 'off',
    modelsReady: false,
    download: null,
    index: { running: false, currentId: null },
    error: null,
    records: {},
    runtime: emptyRuntime(),
    helpText: '',
    stdoutBuf: '',
    cancelled: false,
    pollTimer: null,
    emit
  } as SearchSession
  if (deps.probeNode) session.probeNode = deps.probeNode
  session.queue = new SearchQueue({
    isRecording: deps.isRecording,
    schedule:
      deps.schedule ??
      ((fn, ms) => {
        const timer = setTimeout(fn, ms)
        return () => clearTimeout(timer)
      }),
    run: (job) => dispatch(job)
  })
  session.phase = session.prefs.enabled ? 'needs-runtime' : 'off'

  function emit(): void {
    const snapshot = current()
    for (const listener of listeners) listener(snapshot)
  }

  function current(): SearchSnapshot {
    return {
      prefs: { ...session.prefs },
      phase: session.phase,
      modelsReady: session.modelsReady,
      download: session.download ? { ...session.download } : null,
      index: { ...session.index },
      error: session.error,
      records: { ...session.records },
      runtime: { ...session.runtime }
    }
  }

  async function dispatch(job: SearchJob): Promise<void> {
    if (job.kind === 'pull') {
      await downloadModels(session)
      if (session.prefs.enabled && session.modelsReady) {
        session.queue.enqueueIndexMany(await pendingIds(session))
      }
      return
    }
    if (job.kind === 'query') {
      try {
        job.resolve(await queryMeetings(session, job.text))
      } catch (caught) {
        job.reject(caught)
      }
      return
    }
    if (job.rebuild) {
      await rebuildMeetings(session)
      return
    }
    await indexRecordings(session, job.ids, job.refresh)
  }

  function notify(id: string, allowed: boolean): void {
    if (!session.prefs.enabled || !allowed || !isSafeRecordingId(id)) return
    session.queue.enqueueIndex(id)
  }

  async function savePrefs(next: MeetingSearchPrefs): Promise<void> {
    const parsed = await readAppSettings(deps.userDataDir)
    parsed.settings.meetingSearch = next
    await writeAppSettings(deps.userDataDir, parsed.settings)
    session.prefs = loadMeetingPrefs(deps.userDataDir)
    emit()
  }

  return {
    snapshot: current,
    onChange(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    async start() {
      session.prefs = loadMeetingPrefs(deps.userDataDir)
      session.records = await loadSearchRecords(deps.recordingsDir)
      if (!session.prefs.enabled) {
        session.phase = 'off'
        emit()
      } else {
        await resume(session)
      }
      catchTimer = setInterval(
        () => {
          void catchUpIfDue(session)
        },
        60 * 60 * 1000
      )
    },
    stop() {
      if (catchTimer) clearInterval(catchTimer)
      catchTimer = null
      stopPoll(session)
      session.queue.stop()
    },
    async preflight() {
      session.runtime = await inspectRuntime(session)
      if (!session.runtime.nodeOk && !session.runtime.qmdOnPath) session.error = NODE_MESSAGE
      emit()
      return current()
    },
    async enable() {
      session.runtime = await inspectRuntime(session)
      if (!session.runtime.nodeOk && !session.runtime.qmdOnPath) {
        session.phase = 'needs-runtime'
        session.error = NODE_MESSAGE
        emit()
        return current()
      }
      await savePrefs({ ...session.prefs, enabled: true })
      if (!session.runtime.needsDownload) {
        const launch = await resolveLaunch(session, false)
        session.modelsReady = launch ? await doctorReady(session, launch) : false
        session.phase = session.modelsReady ? 'ready' : 'error'
        session.error = session.modelsReady ? null : (session.error ?? 'Models are not ready.')
        emit()
        if (session.modelsReady) session.queue.enqueueIndexMany(await pendingIds(session))
        return current()
      }
      await removePartialDownloads(session)
      session.phase = 'downloading'
      session.download = { label: '', bytes: 0, percent: null }
      session.error = null
      emit()
      session.queue.enqueuePull()
      return current()
    },
    async disable() {
      session.cancelled = true
      await savePrefs({ ...session.prefs, enabled: false })
      session.queue.clearPending()
      session.queue.cancelCurrent()
      session.phase = 'off'
      session.download = null
      session.index = { running: false, currentId: null }
      session.error = null
      stopPoll(session)
      emit()
      return current()
    },
    async setSchedule(input) {
      await savePrefs({
        ...session.prefs,
        indexAfterTranscript: input.indexAfterTranscript,
        indexAfterSummary: input.indexAfterSummary,
        idleCatchUp: input.idleCatchUp
      })
      return current()
    },
    async indexAll() {
      if (!session.prefs.enabled || !session.modelsReady) return current()
      session.queue.enqueueIndexMany(await staleMeetingIds(deps.recordingsDir), { refresh: true })
      return current()
    },
    async rebuild() {
      if (!session.prefs.enabled || !session.modelsReady) return current()
      session.queue.enqueueIndexMany([], { rebuild: true })
      return current()
    },
    async retry(id) {
      if (!isSafeRecordingId(id)) throw new Error('Unknown recording.')
      if (!session.prefs.enabled) return current()
      session.queue.enqueueIndex(id)
      return current()
    },
    cancelDownload() {
      if (session.phase !== 'installing' && session.phase !== 'downloading') return current()
      session.cancelled = true
      session.queue.cancelCurrent()
      return current()
    },
    query(text) {
      const trimmed = text.trim().slice(0, QUERY_MAX)
      if (!trimmed) return Promise.resolve([])
      if (!session.prefs.enabled || !session.modelsReady || session.phase !== 'ready') {
        return Promise.reject(new Error('Meeting search is not ready.'))
      }
      return session.queue.enqueueQuery(trimmed)
    },
    notifyTranscript(id) {
      notify(id, session.prefs.indexAfterTranscript)
    },
    notifySummary(id) {
      notify(id, session.prefs.indexAfterSummary)
    },
    notifySpeakers(id) {
      notify(id, session.prefs.indexAfterTranscript)
    },
    notifyDelete(id) {
      if (!isSafeRecordingId(id)) return
      void unlink(qmdExportPath(deps.userDataDir, id)).catch(() => undefined)
      delete session.records[id]
      emit()
      if (!session.prefs.enabled) return
      session.queue.enqueueIndexMany([], { refresh: true })
    }
  }
}

async function resume(session: SearchSession): Promise<void> {
  const launch = await resolveLaunch(session, false)
  if (!launch) {
    session.phase = 'needs-runtime'
    session.error = NODE_MESSAGE
    session.emit()
    return
  }
  session.modelsReady = await doctorReady(session, launch)
  if (!session.modelsReady) {
    session.phase = 'error'
    session.error = session.error ?? 'Models are not ready.'
    session.emit()
    return
  }
  session.phase = 'ready'
  session.error = null
  session.emit()
  session.queue.enqueueIndexMany(await pendingIds(session))
}
