export type CaptureMode = 'mix' | 'mic-only'

export interface CaptureStartOptions {
  outPath: string
  sampleRate?: number
}

export interface CaptureStopResult {
  outPath: string
  durationMs: number
  captureMode: CaptureMode
  note: string | null
}

/**
 * OS audio backend. Policy (when to stop) lives in the recording domain.
 * This interface only starts, stops, and reports what was written.
 */
export interface AudioCapture {
  start(opts: CaptureStartOptions): Promise<{ captureMode: CaptureMode; note: string | null }>
  stop(): Promise<CaptureStopResult>
}
