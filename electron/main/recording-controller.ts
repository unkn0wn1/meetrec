import { stat } from 'node:fs/promises'
import { join } from 'node:path'
import { app } from 'electron'
import { createCapture, type AudioCapture } from '../capture'
import { buildRecordingPath } from '../capture/paths'
import type {
  RecordingStartResult,
  RecordingStatus,
  RecordingStopResult
} from '../shared/ipc-contract'
import { statusFromSession, type ActiveSession } from '../domains/recording/session'

export class RecordingController {
  private session: ActiveSession | null = null
  private capture: AudioCapture | null = null

  status(): RecordingStatus {
    return statusFromSession(this.session)
  }

  async start(): Promise<RecordingStartResult> {
    if (this.session) {
      throw new Error('Already recording.')
    }
    const outPath = buildRecordingPath(recordingsDir())
    const capture = createCapture()
    const started = await capture.start({ outPath })
    this.capture = capture
    this.session = {
      outPath,
      startedAtMs: Date.now(),
      captureMode: started.captureMode,
      note: started.note
    }
    return {
      outPath,
      captureMode: started.captureMode,
      note: started.note
    }
  }

  async stop(): Promise<RecordingStopResult> {
    if (!this.session || !this.capture) {
      throw new Error('Not recording.')
    }
    const session = this.session
    const capture = this.capture
    this.session = null
    this.capture = null
    const stopped = await capture.stop()
    const info = await stat(stopped.outPath)
    return {
      outPath: stopped.outPath,
      durationMs: stopped.durationMs,
      bytes: info.size,
      captureMode: session.captureMode
    }
  }
}

export function recordingsDir(): string {
  return join(app.getPath('userData'), 'recordings')
}
