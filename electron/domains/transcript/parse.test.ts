import { describe, expect, it } from 'vitest'
import { documentFromStt, segmentsFromWords, speakerLabel, speakersFromDocument } from './parse'

describe('transcript parse', () => {
  it('groups words into speaker segments and labels them Speaker N', () => {
    const segments = segmentsFromWords([
      { text: 'Hello', start: 0.1, end: 0.4, speaker: 0 },
      { text: 'there', start: 0.4, end: 0.8, speaker: 0 },
      { text: 'Hi', start: 0.9, end: 1.1, speaker: 1 }
    ])
    expect(segments).toEqual([
      {
        speakerId: 'speaker-1',
        speakerLabel: 'Speaker 1',
        start: 0.1,
        end: 0.8,
        text: 'Hello there'
      },
      {
        speakerId: 'speaker-2',
        speakerLabel: 'Speaker 2',
        start: 0.9,
        end: 1.1,
        text: 'Hi'
      }
    ])
    expect(speakerLabel(0)).toBe('Speaker 1')
    expect(
      speakersFromDocument({
        text: '',
        language: null,
        durationSec: null,
        words: [],
        segments,
        model: '',
        createdAt: ''
      })
    ).toEqual([
      { id: 'speaker-1', label: 'Speaker 1' },
      { id: 'speaker-2', label: 'Speaker 2' }
    ])
  })

  it('builds a document from an STT payload', () => {
    const doc = documentFromStt(
      {
        text: 'Hello there',
        language: 'en',
        duration: 1.2,
        words: [{ text: 'Hello', start: 0, end: 0.4, speaker: 0 }]
      },
      'grok-voice-transcribe-2.0',
      '2026-09-22T12:00:00.000Z'
    )
    expect(doc.text).toBe('Hello there')
    expect(doc.segments[0]?.speakerId).toBe('speaker-1')
    expect(doc.model).toBe('grok-voice-transcribe-2.0')
  })
})
