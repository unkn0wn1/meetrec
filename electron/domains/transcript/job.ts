import { writeFile } from 'node:fs/promises'
import { recordingLayout } from '../recording/layout'
import { mergeSpeakerLabels, type RecordingMeta } from '../recording/meta'
import { writeMeta } from '../recording/store'
import type { TranscriptDocument } from './parse'
import { speakersFromDocument } from './parse'

export async function saveTranscript(input: {
  recordingsDir: string
  meta: RecordingMeta
  document: TranscriptDocument
}): Promise<RecordingMeta> {
  const layout = recordingLayout(input.recordingsDir, input.meta.id)
  await writeFile(layout.transcriptPath, `${JSON.stringify(input.document, null, 2)}\n`, 'utf8')
  const next: RecordingMeta = {
    ...input.meta,
    speakers: mergeSpeakerLabels(input.meta.speakers, speakersFromDocument(input.document)),
    durationMs: durationFromDocument(input.document) ?? input.meta.durationMs
  }
  await writeMeta(input.recordingsDir, next)
  return next
}

function durationFromDocument(document: TranscriptDocument): number | null {
  if (document.durationSec === null || !Number.isFinite(document.durationSec)) return null
  return Math.round(document.durationSec * 1000)
}
