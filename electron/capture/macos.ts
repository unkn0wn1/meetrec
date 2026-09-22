import type { AudioCapture, CaptureStartOptions, CaptureStopResult } from './types'

/** macOS capture is out of scope for v1. Interface exists so main can select by platform. */
export class MacosCapture implements AudioCapture {
  start(_opts: CaptureStartOptions): Promise<never> {
    return Promise.reject(
      new Error(
        'macOS capture is not implemented. TODO: ScreenCaptureKit system audio, or a virtual device such as BlackHole. Linux is the supported path.'
      )
    )
  }

  stop(): Promise<CaptureStopResult> {
    return Promise.reject(new Error('macOS capture is not implemented.'))
  }
}
