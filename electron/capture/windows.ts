import type { AudioCapture, CaptureStartOptions, CaptureStopResult } from './types'

/** Windows capture is out of scope for v1. Interface exists so main can select by platform. */
export class WindowsCapture implements AudioCapture {
  start(_opts: CaptureStartOptions): Promise<never> {
    return Promise.reject(
      new Error(
        'Windows capture is not implemented. TODO: WASAPI loopback + mic mix. Linux is the supported path.'
      )
    )
  }

  stop(): Promise<CaptureStopResult> {
    return Promise.reject(new Error('Windows capture is not implemented.'))
  }
}
