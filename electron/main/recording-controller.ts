import { stat } from 'node:fs/promises'
import { join } from 'node:path'
import { app } from 'electron'
import { createCapture, type AudioCapture } from '../capture'
import { buildRecordingFolder } from '../capture/paths'
import { emptyMeta } from '../domains/recording/meta'
import { statusFromSession, type ActiveSession } from '../domains/recording/session'
import { readMeta, writeMeta } from '../domains/recording/store'
import type {
  RecordingStartResult,
  RecordingStatus,
  RecordingStopResult
} from '../shared/ipc-contract'

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
    const folder = buildRecordingFolder(recordingsDir())
    const startedAt = new Date().toISOString()
    const capture = createCapture()
    const started = await capture.start({ outPath: folder.audioPath })
    await writeMeta(
      recordingsDir(),
      emptyMeta({
        id: folder.id,
        startedAt,
        captureMode: started.captureMode,
        note: started.note
      })
    )
    this.capture = capture
    this.session = {
      id: folder.id,
      outPath: folder.audioPath,
      startedAtMs: Date.parse(startedAt),
      captureMode: started.captureMode,
      note: started.note
    }
    return {
      outPath: folder.audioPath,
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
    const endedAt = new Date().toISOString()
    const prior = await readMeta(recordingsDir(), session.id)
    const base =
      prior ??
      emptyMeta({
        id: session.id,
        startedAt: new Date(session.startedAtMs).toISOString(),
        captureMode: session.captureMode,
        note: session.note
      })
    await writeMeta(recordingsDir(), {
      ...base,
      endedAt,
      durationMs: stopped.durationMs,
      captureMode: session.captureMode,
      note: session.note
    })
    return {
      outPath: stopped.outPath,
      id: session.id,
      durationMs: stopped.durationMs,
      bytes: info.size,
      captureMode: session.captureMode
    }
  }
}

export function recordingsDir(): string {
  return join(app.getPath('userData'), 'recordings')
}
