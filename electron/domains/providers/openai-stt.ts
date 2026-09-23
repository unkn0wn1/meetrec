import { readFile } from 'node:fs/promises'
import { basename } from 'node:path'
import {
  documentFromStt,
  speakerId,
  speakerLabel,
  type TranscriptDocument,
  type TranscriptSegment
} from '../transcript/parse'
import { OPENAI_STT_MODEL, OPENAI_STT_URL } from './models'

export async function transcribeWavOpenAi(input: {
  apiKey: string
  audioPath: string
  model: string
  fetchImpl?: typeof fetch
}): Promise<TranscriptDocument> {
  const bytes = await readFile(input.audioPath)
  const form = new FormData()
  form.append('model', input.model)
  form.append('response_format', 'diarized_json')
  form.append('chunking_strategy', 'auto')
  form.append('file', new Blob([bytes], { type: 'audio/wav' }), basename(input.audioPath))

  const fetchImpl = input.fetchImpl ?? fetch
  const response = await fetchImpl(OPENAI_STT_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${input.apiKey}` },
    body: form
  })
  const raw = await response.text()
  if (!response.ok) {
    throw new Error(openAiErrorMessage(response.status, raw, 'Speech-to-text'))
  }
  let payload: unknown
  try {
    payload = JSON.parse(raw)
  } catch {
    throw new Error('Speech-to-text returned a response that was not JSON.')
  }
  return documentFromOpenAi(payload, new Date().toISOString(), input.model)
}

export function documentFromOpenAi(
  payload: unknown,
  createdAt: string,
  model = OPENAI_STT_MODEL
): TranscriptDocument {
  const base = documentFromStt(payload, model, createdAt)
  const segments = segmentsFromDiarized(payload)
  if (segments.length === 0) return base
  const text = segments
    .map((segment) => segment.text)
    .join(' ')
    .trim()
  return { ...base, text: base.text || text, segments, words: [] }
}

export function segmentsFromDiarized(payload: unknown): TranscriptSegment[] {
  if (!payload || typeof payload !== 'object') return []
  const raw = (payload as { segments?: unknown }).segments
  if (!Array.isArray(raw)) return []
  const indexes = new Map<string, number>()
  const segments: TranscriptSegment[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const record = item as Record<string, unknown>
    const text = typeof record.text === 'string' ? record.text.trim() : ''
    if (!text) continue
    const speaker = typeof record.speaker === 'string' ? record.speaker : 'A'
    const index = speakerIndex(indexes, speaker)
    const start = typeof record.start === 'number' ? record.start : 0
    const end = typeof record.end === 'number' ? record.end : start
    segments.push({
      speakerId: speakerId(index),
      speakerLabel: speakerLabel(index),
      start,
      end,
      text
    })
  }
  return segments
}

export function openAiErrorMessage(status: number, body: string, action: string): string {
  const detail = body.replace(/\s+/g, ' ').trim().slice(0, 240)
  if (status === 401 || status === 403) {
    return 'OpenAI rejected the API key. Open Settings and save a working key.'
  }
  return detail ? `${action} failed (${status}): ${detail}` : `${action} failed (${status}).`
}

function speakerIndex(indexes: Map<string, number>, speaker: string): number {
  const known = indexes.get(speaker)
  if (known !== undefined) return known
  const next = indexes.size
  indexes.set(speaker, next)
  return next
}
