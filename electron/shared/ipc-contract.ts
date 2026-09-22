export const IPC = {
  recordingStart: 'recording:start',
  recordingStop: 'recording:stop',
  recordingStatus: 'recording:status'
} as const

export type CaptureMode = 'mix' | 'mic-only'

export type RecordingPhase = 'idle' | 'recording'

export interface RecordingStatus {
  phase: RecordingPhase
  outPath: string | null
  startedAt: string | null
  captureMode: CaptureMode | null
  note: string | null
}

export interface RecordingStartResult {
  outPath: string
  captureMode: CaptureMode
  note: string | null
}

export interface RecordingStopResult {
  outPath: string
  durationMs: number
  bytes: number
  captureMode: CaptureMode
}

export interface MeetrecApi {
  recording: {
    start: () => Promise<RecordingStartResult>
    stop: () => Promise<RecordingStopResult>
    status: () => Promise<RecordingStatus>
  }
}
