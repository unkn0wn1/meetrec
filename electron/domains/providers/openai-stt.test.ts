import { describe, expect, it } from 'vitest'
import { documentFromOpenAi, segmentsFromDiarized } from './openai-stt'

describe('OpenAI diarized transcript', () => {
  it('maps speaker letters onto Speaker 1 and Speaker 2', () => {
    const segments = segmentsFromDiarized({
      text: 'Hello there',
      segments: [
        { speaker: 'A', start: 0, end: 1.2, text: 'Hello' },
        { speaker: 'B', start: 1.2, end: 2, text: 'there' },
        { speaker: 'A', start: 2, end: 3, text: 'again' }
      ]
    })
    expect(segments.map((segment) => segment.speakerLabel)).toEqual([
      'Speaker 1',
      'Speaker 2',
      'Speaker 1'
    ])
    expect(segments[0]?.speakerId).toBe('speaker-1')
    expect(segments[1]?.speakerId).toBe('speaker-2')
  })

  it('keeps the joined text when diarized segments exist', () => {
    const document = documentFromOpenAi(
      {
        text: '',
        duration: 3,
        segments: [{ speaker: 'agent', start: 0, end: 1, text: 'Thanks' }]
      },
      '2026-09-23T00:00:00.000Z'
    )
    expect(document.text).toBe('Thanks')
    expect(document.model).toBe('gpt-4o-transcribe-diarize')
    expect(document.segments).toHaveLength(1)
  })
})
