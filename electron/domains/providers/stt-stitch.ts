import {
  segmentsFromWords,
  speakerId,
  speakerLabel,
  wordsFromUnknown,
  type TranscriptDocument,
  type TranscriptSegment,
  type TranscriptWord
} from '../transcript/parse'

export interface SttTimedText {
  speakerKey: string
  start: number
  end: number
  text: string
}

export interface SttPiece {
  text: string
  language: string | null
  segments: SttTimedText[]
  words: SttTimedText[]
}

export interface SttPieceAt extends SttPiece {
  offsetSec: number
}

export function pieceFromDiarizedPayload(payload: unknown): SttPiece {
  const record = asRecord(payload)
  const raw = record.segments
  const segments: SttTimedText[] = []
  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (!item || typeof item !== 'object') continue
      const segment = item as Record<string, unknown>
      const text = typeof segment.text === 'string' ? segment.text.trim() : ''
      if (!text) continue
      const start = typeof segment.start === 'number' ? segment.start : 0
      segments.push({
        speakerKey: typeof segment.speaker === 'string' ? segment.speaker : 'A',
        start,
        end: typeof segment.end === 'number' ? segment.end : start,
        text
      })
    }
  }
  return {
    text: typeof record.text === 'string' ? record.text : '',
    language: typeof record.language === 'string' ? record.language : null,
    segments,
    words: []
  }
}

export function pieceFromWordPayload(payload: unknown): SttPiece {
  const record = asRecord(payload)
  return {
    text: typeof record.text === 'string' ? record.text : '',
    language: typeof record.language === 'string' ? record.language : null,
    segments: [],
    words: wordsFromUnknown(record.words).map((word) => ({
      speakerKey: word.speaker === null ? '0' : String(word.speaker),
      start: word.start,
      end: word.end,
      text: word.text
    }))
  }
}

export function stitchSttPieces(
  pieces: SttPieceAt[],
  options: { model: string; createdAt: string; timelineEndSec: number }
): TranscriptDocument {
  const speakerIndexes = new Map<string, number>()
  const segments: TranscriptSegment[] = []
  const words: TranscriptWord[] = []
  const texts: string[] = []
  let language: string | null = null

  for (let chunkIndex = 0; chunkIndex < pieces.length; chunkIndex += 1) {
    const piece = pieces[chunkIndex]
    if (!piece) continue
    if (language === null && piece.language !== null) language = piece.language
    if (piece.words.length > 0) {
      const pieceWords = shiftedWords(piece, chunkIndex, speakerIndexes)
      words.push(...pieceWords)
      const pieceSegments = segmentsFromWords(pieceWords)
      segments.push(...pieceSegments)
      pushText(texts, piece.text, pieceSegments)
      continue
    }
    const pieceSegments = shiftedSegments(piece, chunkIndex, speakerIndexes)
    segments.push(...pieceSegments)
    pushText(texts, piece.text, pieceSegments)
  }

  return {
    text: texts.join(' '),
    language,
    durationSec: options.timelineEndSec,
    words,
    segments,
    model: options.model,
    createdAt: options.createdAt
  }
}

function asRecord(payload: unknown): Record<string, unknown> {
  return payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {}
}

function speakerIndex(
  indexes: Map<string, number>,
  chunkIndex: number,
  speakerKey: string
): number {
  const key = `${chunkIndex}\0${speakerKey}`
  const known = indexes.get(key)
  if (known !== undefined) return known
  const next = indexes.size
  indexes.set(key, next)
  return next
}

function shiftTimes(
  start: number,
  end: number,
  offsetSec: number
): { start: number; end: number } | null {
  if (!Number.isFinite(start)) return null
  const shiftedStart = start + offsetSec
  const shiftedEnd = end + offsetSec
  if (!Number.isFinite(shiftedEnd) || shiftedEnd < shiftedStart) {
    return { start: shiftedStart, end: shiftedStart }
  }
  return { start: shiftedStart, end: shiftedEnd }
}

function shiftedSegments(
  piece: SttPieceAt,
  chunkIndex: number,
  indexes: Map<string, number>
): TranscriptSegment[] {
  const segments: TranscriptSegment[] = []
  for (const segment of piece.segments) {
    if (segment.text.trim() === '') continue
    const times = shiftTimes(segment.start, segment.end, piece.offsetSec)
    if (!times) continue
    const index = speakerIndex(indexes, chunkIndex, segment.speakerKey)
    segments.push({
      speakerId: speakerId(index),
      speakerLabel: speakerLabel(index),
      start: times.start,
      end: times.end,
      text: segment.text
    })
  }
  return segments
}

function shiftedWords(
  piece: SttPieceAt,
  chunkIndex: number,
  indexes: Map<string, number>
): TranscriptWord[] {
  const words: TranscriptWord[] = []
  for (const word of piece.words) {
    if (word.text.trim() === '') continue
    const times = shiftTimes(word.start, word.end, piece.offsetSec)
    if (!times) continue
    words.push({
      text: word.text,
      start: times.start,
      end: times.end,
      speaker: speakerIndex(indexes, chunkIndex, word.speakerKey)
    })
  }
  return words
}

function pushText(texts: string[], payloadText: string, segments: TranscriptSegment[]): void {
  const direct = payloadText.trim()
  const text =
    direct ||
    segments
      .map((segment) => segment.text)
      .join(' ')
      .trim()
  if (text) texts.push(text)
}
