import { readFile } from 'node:fs/promises'
import { isSafeRecordingId } from '../../capture/paths'
import { minutesPrompt, topicFromMarkdown } from '../minutes/markdown'
import { saveSummary } from '../minutes/job'
import type {
  LibraryListItem,
  ProviderRole,
  SummarizeStage,
  TranscribeStage
} from '../../shared/ipc-contract'
import type { ActiveAuth } from '../providers/auth'
import { providerGateHint } from '../providers/auth'
import { summarizeWithAuth, transcribeWithAuth } from '../providers/dispatch'
import { saveTranscript } from '../transcript/job'
import { parseTranscript, type TranscriptDocument } from '../transcript/parse'
import { recordingLayout } from './layout'
import { applySpeakerNames, uploadFlags, type RecordingMeta, type Speaker } from './meta'
import {
  deleteRecording,
  loadRecording,
  scanRecordings,
  writeMeta,
  type RecordingFlags,
  type StoredRecording
} from './store'

export interface LibraryDetail {
  meta: RecordingMeta
  flags: RecordingFlags
  transcript: TranscriptDocument | null
  summary: string | null
  audioUrl: string
}

export class LibraryService {
  constructor(
    private readonly recordingsDir: () => string,
    private readonly readAuth: (role: ProviderRole) => Promise<ActiveAuth> = async () => {
      throw new Error(providerGateHint('xai-key'))
    }
  ) {}

  async list(): Promise<LibraryListItem[]> {
    const stored = await scanRecordings(this.recordingsDir())
    return stored.map(toListItem)
  }

  async detail(id: string): Promise<LibraryDetail> {
    const stored = await this.require(id)
    const layout = recordingLayout(this.recordingsDir(), id)
    const transcript = stored.flags.hasTranscript
      ? await readTranscript(layout.transcriptPath)
      : null
    const summary = stored.flags.hasSummary ? await readFile(layout.summaryPath, 'utf8') : null
    return {
      meta: stored.meta,
      flags: stored.flags,
      transcript,
      summary,
      audioUrl: `meetrec://recording/${encodeURIComponent(id)}/audio.wav`
    }
  }

  async delete(id: string): Promise<void> {
    await this.require(id)
    await deleteRecording(this.recordingsDir(), id)
  }

  async updateSpeakers(id: string, names: Record<string, string>): Promise<RecordingMeta> {
    const stored = await this.require(id)
    const speakers = applySpeakerNames(stored.meta.speakers, names)
    const next = { ...stored.meta, speakers }
    await writeMeta(this.recordingsDir(), next)
    return next
  }

  async transcribe(
    id: string,
    report: (stage: TranscribeStage) => void = () => {}
  ): Promise<LibraryDetail> {
    const stored = await this.require(id)
    const auth = await this.readAuth('voice')
    const layout = recordingLayout(this.recordingsDir(), id)
    const document = await transcribeWithAuth({
      auth,
      audioPath: layout.audioPath,
      onStage: report
    })
    report('saving')
    await saveTranscript({
      recordingsDir: this.recordingsDir(),
      meta: stored.meta,
      document
    })
    return this.detail(id)
  }

  async summarize(
    id: string,
    report: (stage: SummarizeStage) => void = () => {}
  ): Promise<LibraryDetail> {
    const stored = await this.require(id)
    if (!stored.flags.hasTranscript) {
      throw new Error('Transcribe this recording before generating a summary.')
    }
    const auth = await this.readAuth('ai')
    report('preparing')
    const layout = recordingLayout(this.recordingsDir(), id)
    const transcript = await readTranscript(layout.transcriptPath)
    if (!transcript?.text.trim()) {
      throw new Error('The transcript file is empty.')
    }
    const prompt = minutesPrompt(transcript.text, speakerLines(stored.meta.speakers, transcript))
    const result = await summarizeWithAuth({ auth, prompt, onStage: report })
    const topic = result.draft.topic.trim() || topicFromMarkdown(result.markdown)
    report('saving')
    await saveSummary({
      recordingsDir: this.recordingsDir(),
      meta: stored.meta,
      markdown: result.markdown,
      topic
    })
    return this.detail(id)
  }

  private async require(id: string): Promise<StoredRecording> {
    if (!isSafeRecordingId(id)) {
      throw new Error('Unknown recording.')
    }
    const stored = await loadRecording(this.recordingsDir(), id)
    if (!stored) throw new Error('Recording not found.')
    return stored
  }
}

function toListItem(stored: StoredRecording): LibraryListItem {
  return {
    id: stored.meta.id,
    title: stored.meta.title?.trim() || stored.meta.startedAt,
    startedAt: stored.meta.startedAt,
    durationMs: stored.meta.durationMs,
    topic: stored.meta.topic,
    speakerCount: stored.meta.speakers.length,
    hasTranscript: stored.flags.hasTranscript,
    hasSummary: stored.flags.hasSummary,
    ...uploadFlags(stored.meta.uploads)
  }
}

async function readTranscript(path: string): Promise<TranscriptDocument | null> {
  try {
    return parseTranscript(await readFile(path, 'utf8'))
  } catch {
    return null
  }
}

function speakerLines(speakers: Speaker[], transcript: TranscriptDocument): string[] {
  const named = new Map(
    speakers.map((speaker) => [speaker.id, speaker.name.trim() || speaker.label])
  )
  const lines: string[] = []
  for (const segment of transcript.segments) {
    const name = named.get(segment.speakerId) || segment.speakerLabel
    if (!lines.some((line) => line.startsWith(`${name}:`))) {
      lines.push(`${name}: labeled ${segment.speakerLabel}`)
    }
  }
  return lines
}

export async function readAudioBytes(recordingsDir: string, id: string): Promise<Buffer> {
  if (!isSafeRecordingId(id)) throw new Error('Unknown recording.')
  const layout = recordingLayout(recordingsDir, id)
  return readFile(layout.audioPath)
}
