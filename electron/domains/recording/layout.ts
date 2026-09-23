import { join } from 'node:path'

export const AUDIO_FILE = 'audio.wav'
export const META_FILE = 'meta.json'
export const TRANSCRIPT_FILE = 'transcript.json'
export const SUMMARY_FILE = 'summary.md'

export interface RecordingLayout {
  dir: string
  audioPath: string
  metaPath: string
  transcriptPath: string
  summaryPath: string
}

export function recordingLayout(recordingsDir: string, id: string): RecordingLayout {
  const dir = join(recordingsDir, id)
  return {
    dir,
    audioPath: join(dir, AUDIO_FILE),
    metaPath: join(dir, META_FILE),
    transcriptPath: join(dir, TRANSCRIPT_FILE),
    summaryPath: join(dir, SUMMARY_FILE)
  }
}

export function idFromFlatWav(fileName: string): string | null {
  if (!fileName.endsWith('.wav')) return null
  const id = fileName.slice(0, -'.wav'.length)
  if (!id || id.includes('/') || id.includes('\\')) return null
  return id
}

export function startedAtFromRecordingId(id: string): string | null {
  const match = /^(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z)/.exec(id)
  if (!match) return null
  const stamp = match[1]
  if (!stamp) return null
  const iso = `${stamp.slice(0, 10)}T${stamp.slice(11, 13)}:${stamp.slice(14, 16)}:${stamp.slice(17, 19)}.${stamp.slice(20, 23)}Z`
  const parsed = Date.parse(iso)
  if (Number.isNaN(parsed)) return null
  return new Date(parsed).toISOString()
}
