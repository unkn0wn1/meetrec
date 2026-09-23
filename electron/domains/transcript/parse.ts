export interface TranscriptWord {
  text: string
  start: number
  end: number
  speaker: number | null
}

export interface TranscriptSegment {
  speakerId: string
  speakerLabel: string
  start: number
  end: number
  text: string
}

export interface TranscriptDocument {
  text: string
  language: string | null
  durationSec: number | null
  words: TranscriptWord[]
  segments: TranscriptSegment[]
  model: string
  createdAt: string
}

export function speakerLabel(index: number): string {
  return `Speaker ${index + 1}`
}

export function speakerId(index: number): string {
  return `speaker-${index + 1}`
}

export function segmentsFromWords(words: TranscriptWord[]): TranscriptSegment[] {
  const segments: TranscriptSegment[] = []
  for (const word of words) {
    const text = word.text.trim()
    if (!text) continue
    const index = word.speaker ?? 0
    const id = speakerId(index)
    const last = segments[segments.length - 1]
    if (last && last.speakerId === id) {
      last.end = word.end
      last.text = `${last.text} ${text}`
      continue
    }
    segments.push({
      speakerId: id,
      speakerLabel: speakerLabel(index),
      start: word.start,
      end: word.end,
      text
    })
  }
  return segments
}

export function wordsFromUnknown(value: unknown): TranscriptWord[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') return []
    const record = item as Record<string, unknown>
    const text = typeof record.text === 'string' ? record.text : ''
    if (!text) return []
    const start = typeof record.start === 'number' ? record.start : 0
    const end = typeof record.end === 'number' ? record.end : start
    const speaker =
      typeof record.speaker === 'number' && Number.isFinite(record.speaker) ? record.speaker : null
    return [{ text, start, end, speaker }]
  })
}

export function documentFromStt(
  payload: unknown,
  model: string,
  createdAt: string
): TranscriptDocument {
  const record = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {}
  const words = wordsFromUnknown(record.words)
  const text = typeof record.text === 'string' ? record.text.trim() : ''
  const segments = segmentsFromWords(words)
  const joined = segments
    .map((segment) => segment.text)
    .join(' ')
    .trim()
  return {
    text: text || joined,
    language: typeof record.language === 'string' ? record.language : null,
    durationSec: typeof record.duration === 'number' ? record.duration : null,
    words,
    segments,
    model,
    createdAt
  }
}

export function speakersFromDocument(doc: TranscriptDocument): { id: string; label: string }[] {
  const speakers: { id: string; label: string }[] = []
  for (const segment of doc.segments) {
    if (speakers.some((speaker) => speaker.id === segment.speakerId)) continue
    speakers.push({ id: segment.speakerId, label: segment.speakerLabel })
  }
  return speakers
}

export function parseTranscript(raw: string): TranscriptDocument | null {
  let value: unknown
  try {
    value = JSON.parse(raw)
  } catch {
    return null
  }
  if (!value || typeof value !== 'object') return null
  const record = value as Record<string, unknown>
  const words = wordsFromUnknown(record.words)
  const segments = Array.isArray(record.segments)
    ? record.segments.flatMap(parseSegment)
    : segmentsFromWords(words)
  return {
    text: typeof record.text === 'string' ? record.text : '',
    language: typeof record.language === 'string' ? record.language : null,
    durationSec: typeof record.durationSec === 'number' ? record.durationSec : null,
    words,
    segments,
    model: typeof record.model === 'string' ? record.model : '',
    createdAt: typeof record.createdAt === 'string' ? record.createdAt : ''
  }
}

function parseSegment(value: unknown): TranscriptSegment[] {
  if (!value || typeof value !== 'object') return []
  const record = value as Record<string, unknown>
  if (typeof record.text !== 'string' || typeof record.speakerId !== 'string') return []
  return [
    {
      speakerId: record.speakerId,
      speakerLabel:
        typeof record.speakerLabel === 'string' ? record.speakerLabel : record.speakerId,
      start: typeof record.start === 'number' ? record.start : 0,
      end: typeof record.end === 'number' ? record.end : 0,
      text: record.text
    }
  ]
}
