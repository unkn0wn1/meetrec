import type { CaptureMode, RecordingStatus } from '../../shared/ipc-contract'

export interface ActiveSession {
  id: string
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
    note: null,
    captureSupported: true,
    unsupportedReason: null
  }
}

export function statusFromSession(session: ActiveSession | null): RecordingStatus {
  if (!session) return idleStatus()
  return {
    phase: 'recording',
    outPath: session.outPath,
    startedAt: new Date(session.startedAtMs).toISOString(),
    captureMode: session.captureMode,
    note: session.note,
    captureSupported: true,
    unsupportedReason: null
  }
}

/** Overlay OS capture support onto a session status snapshot. */
export function withCaptureSupport(
  status: RecordingStatus,
  support: { supported: boolean; message: string | null }
): RecordingStatus {
  return {
    ...status,
    captureSupported: support.supported,
    unsupportedReason: support.message
  }
}
