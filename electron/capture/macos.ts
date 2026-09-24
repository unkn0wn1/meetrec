import type { AudioCapture, CaptureStartOptions, CaptureStopResult } from './types'
import { assertCaptureSupported } from './support'

/** macOS capture is out of scope for v1. Interface exists so main can select by platform. */
export class MacosCapture implements AudioCapture {
  async start(_opts: CaptureStartOptions): Promise<never> {
    assertCaptureSupported('darwin')
    throw new Error('macOS capture is not implemented.')
  }

  async stop(): Promise<CaptureStopResult> {
    throw new Error('macOS capture is not available in this build.')
  }
}
