import { stat } from 'node:fs/promises'
import { join } from 'node:path'
import { app } from 'electron'
import {
  assertCaptureSupported,
  captureSupport,
  createCapture,
  type AudioCapture
} from '../capture'
import { buildRecordingFolder } from '../capture/paths'
import { encodeWavToLibraryMp3 } from '../domains/recording/encode-mp3'
import {
  CAPTURE_AUDIO_FILE,
  LIBRARY_AUDIO_FILE,
  recordingLayout
} from '../domains/recording/layout'
import { emptyMeta, type RecordingCalendarLink } from '../domains/recording/meta'
import {
  statusFromSession,
  withCaptureSupport,
  type ActiveSession
} from '../domains/recording/session'
import { createSilenceWatch, type SilenceWatch } from '../domains/recording/silence-watch'
import { readMeta, writeMeta } from '../domains/recording/store'
import { readSilenceAutoStop } from '../domains/settings/settings-file'
import type {
  RecordingStartResult,
  RecordingStatus,
  RecordingStopResult
} from '../shared/ipc-contract'

export class RecordingController {
  private session: ActiveSession | null = null
  private capture: AudioCapture | null = null
  private onChange: ((status: RecordingStatus) => void) | null = null
  private silence: SilenceWatch | null = null
  private silenceStop: (() => void) | null = null

  setOnChange(listener: (status: RecordingStatus) => void): void {
    this.onChange = listener
  }

  /** Silence auto-stop uses the manual stop path, including the upload hook. */
  setSilenceStop(request: () => void): void {
    this.silenceStop = request
  }

  status(): RecordingStatus {
    return withCaptureSupport(statusFromSession(this.session), captureSupport())
  }

  recordingId(): string | null {
    return this.session?.id ?? null
  }

  async start(input?: {
    title?: string | null
    calendar?: RecordingCalendarLink | null
  }): Promise<RecordingStartResult> {
    if (this.session) {
      throw new Error('Already recording.')
    }
    this.clearSilence()
    assertCaptureSupported()
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
        note: started.note,
        title: input?.title ?? null,
        calendar: input?.calendar ?? null
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
    this.armSilence()
    const result = {
      outPath: folder.audioPath,
      captureMode: started.captureMode,
      note: started.note
    }
    this.emit()
    return result
  }

  async stop(): Promise<RecordingStopResult> {
    this.clearSilence()
    if (!this.session || !this.capture) {
      throw new Error('Not recording.')
    }
    const session = this.session
    const capture = this.capture
    this.session = null
    this.capture = null
    try {
      const stopped = await capture.stop()
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
      const layout = recordingLayout(recordingsDir(), session.id)
      const finished = {
        ...base,
        endedAt,
        durationMs: stopped.durationMs,
        captureMode: session.captureMode,
        note: session.note
      }
      try {
        await encodeWavToLibraryMp3(stopped.outPath, layout.audioPath)
      } catch (error) {
        await writeMeta(recordingsDir(), {
          ...finished,
          paths: { ...base.paths, audio: CAPTURE_AUDIO_FILE }
        })
        throw error
      }
      const mp3 = await stat(layout.audioPath)
      await writeMeta(recordingsDir(), {
        ...finished,
        paths: { ...base.paths, audio: LIBRARY_AUDIO_FILE }
      })
      return {
        outPath: layout.audioPath,
        id: session.id,
        durationMs: stopped.durationMs,
        bytes: mp3.size,
        captureMode: session.captureMode
      }
    } finally {
      this.emit()
    }
  }

  private emit(): void {
    this.onChange?.(this.status())
  }

  private armSilence(): void {
    this.clearSilence()
    const session = this.session
    if (!session) return
    // Latched at start. A settings change during this recording waits for the next one.
    const policy = readSilenceAutoStop(app.getPath('userData'))
    if (!policy.enabled) return
    this.silence = createSilenceWatch({
      outPath: session.outPath,
      startedAtMs: session.startedAtMs,
      thresholdSeconds: policy.seconds,
      onTrip: () => {
        this.tripSilence()
      }
    })
  }

  private tripSilence(): void {
    const request = this.silenceStop
    if (request) {
      request()
      return
    }
    void this.stop().catch(() => undefined)
  }

  private clearSilence(): void {
    this.silence?.clear()
    this.silence = null
  }
}

export function recordingsDir(): string {
  return join(app.getPath('userData'), 'recordings')
}
