import { describe, expect, it } from 'vitest'
import { segmentsFromDiarized } from './openai-stt'
import {
  pieceFromDiarizedPayload,
  pieceFromWordPayload,
  stitchSttPieces,
  type SttPieceAt
} from './stt-stitch'

const createdAt = '2026-09-25T00:00:00.000Z'

describe('stitchSttPieces', () => {
  it('shifts diarized segments and restarts speaker numbers on the next piece', () => {
    const doc = stitchSttPieces(
      [
        pieceAt(0, {
          text: 'one',
          language: 'en',
          words: [],
          segments: [
            { speakerKey: 'A', start: 0, end: 1, text: 'a1' },
            { speakerKey: 'B', start: 1, end: 2, text: 'b' },
            { speakerKey: 'A', start: 2, end: 3, text: 'a2' }
          ]
        }),
        pieceAt(3666, {
          text: 'two',
          language: 'es',
          words: [],
          segments: [{ speakerKey: 'A', start: 0, end: 1, text: 'a3' }]
        })
      ],
      { model: 'gpt-4o-transcribe-diarize', createdAt, timelineEndSec: 8000 }
    )
    expect(doc.segments.map((segment) => segment.text)).toEqual(['a1', 'b', 'a2', 'a3'])
    expect(doc.segments.map((segment) => segment.speakerLabel)).toEqual([
      'Speaker 1',
      'Speaker 2',
      'Speaker 1',
      'Speaker 3'
    ])
    expect(doc.segments.map((segment) => segment.speakerId)).toEqual([
      'speaker-1',
      'speaker-2',
      'speaker-1',
      'speaker-3'
    ])
    expect(doc.segments[3]).toMatchObject({ start: 3666, end: 3667 })
    expect(doc.words).toEqual([])
    expect(doc.language).toBe('en')
    expect(doc.text).toBe('one two')
    expect(doc.durationSec).toBe(8000)
    expect(doc.model).toBe('gpt-4o-transcribe-diarize')
    expect(doc.createdAt).toBe(createdAt)
  })

  it('matches segmentsFromDiarized when the only piece starts at 0', () => {
    const payload = {
      text: 'Hello there',
      segments: [
        { speaker: 'A', start: 0, end: 1.2, text: 'Hello' },
        { speaker: 'B', start: 1.2, end: 2, text: 'there' },
        { speaker: 'A', start: 2, end: 3, text: 'again' }
      ]
    }
    const doc = stitchSttPieces([{ ...pieceFromDiarizedPayload(payload), offsetSec: 0 }], {
      model: 'gpt-4o-transcribe-diarize',
      createdAt,
      timelineEndSec: 3
    })
    expect(doc.segments).toEqual(segmentsFromDiarized(payload))
  })

  it('compacts word speakers per piece and keeps a turn inside the piece', () => {
    const first = pieceFromWordPayload({
      text: '',
      language: null,
      words: [
        { text: 'Hello', start: 0, end: 0.5, speaker: 0 },
        { text: 'there', start: 0.5, end: 1, speaker: 0 },
        { text: 'friend', start: 1, end: 1.5, speaker: 1 },
        { text: '   ', start: 1.5, end: 1.6, speaker: 1 }
      ]
    })
    const later = pieceFromWordPayload({
      text: 'Later',
      language: 'en',
      words: [{ text: 'Again', start: 0, end: 0.5, speaker: 0 }]
    })
    expect(
      pieceFromWordPayload({ words: [{ text: 'Hi', start: 0, end: 1, speaker: null }] }).words[0]
    ).toMatchObject({ speakerKey: '0' })
    const doc = stitchSttPieces(
      [
        { ...first, offsetSec: 10 },
        { ...later, offsetSec: 20 }
      ],
      { model: 'grok-voice-transcribe-2.0', createdAt, timelineEndSec: 40 }
    )
    expect(doc.words.map((word) => word.speaker)).toEqual([0, 0, 1, 2])
    expect(doc.words[0]).toMatchObject({ start: 10, end: 10.5, text: 'Hello' })
    expect(doc.words[3]).toMatchObject({ start: 20, end: 20.5, speaker: 2 })
    expect(doc.segments.map((segment) => segment.text)).toEqual(['Hello there', 'friend', 'Again'])
    expect(doc.segments.map((segment) => segment.speakerLabel)).toEqual([
      'Speaker 1',
      'Speaker 2',
      'Speaker 3'
    ])
    expect(doc.language).toBe('en')
    expect(doc.text).toBe('Hello there friend Later')
    expect(doc.durationSec).toBe(40)
  })

  it('drops a blank or non-finite span and clamps an end before its start', () => {
    const doc = stitchSttPieces(
      [
        pieceAt(10.5, {
          text: '',
          language: null,
          words: [],
          segments: [
            { speakerKey: 'A', start: Number.NaN, end: 1, text: 'skip' },
            { speakerKey: 'A', start: 1.25, end: 2, text: 'Hi' },
            { speakerKey: 'B', start: 5, end: 4, text: 'clamp' },
            { speakerKey: 'C', start: 6, end: 7, text: '   ' }
          ]
        })
      ],
      { model: 'm', createdAt, timelineEndSec: 30 }
    )
    expect(doc.segments.map((segment) => segment.text)).toEqual(['Hi', 'clamp'])
    expect(doc.segments[0]).toMatchObject({ start: 11.75, end: 12.5, speakerLabel: 'Speaker 1' })
    expect(doc.segments[1]).toMatchObject({ start: 15.5, end: 15.5, speakerLabel: 'Speaker 2' })
    expect(doc.text).toBe('Hi clamp')
    expect(doc.durationSec).toBe(30)
  })
})

function pieceAt(offsetSec: number, piece: Omit<SttPieceAt, 'offsetSec'>): SttPieceAt {
  return { ...piece, offsetSec }
}
