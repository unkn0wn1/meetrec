import type { CaptureMode, RecordingStatus } from '../../shared/ipc-contract'

export interface ActiveSession {
  outPath: string
  startedAtMs: number
  captureMode: CaptureMode
  note: string | null
}

export function idleStatus(): RecordingStatus {
  return {
    phase: 'idle',
    outPath: null,
    startedAt: null,
    captureMode: null,
    note: null
  }
}

export function statusFromSession(session: ActiveSession | null): RecordingStatus {
  if (!session) return idleStatus()
  return {
    phase: 'recording',
    outPath: session.outPath,
    startedAt: new Date(session.startedAtMs).toISOString(),
    captureMode: session.captureMode,
    note: session.note
  }
}
