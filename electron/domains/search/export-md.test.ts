import { describe, expect, it } from 'vitest'
import type { TranscriptDocument } from '../transcript/parse'
import { buildMeetingExport, sourceToken } from './export-md'

const id = '2026-09-25T15-04-05-000Z'

function transcript(partial: Partial<TranscriptDocument> = {}): TranscriptDocument {
  return {
    text: 'hello there',
    language: 'en',
    durationSec: 70,
    words: [],
    segments: [
      {
        speakerId: 'speaker-1',
        speakerLabel: 'Speaker 1',
        start: 62.5,
        end: 64,
        text: 'hello there'
      }
    ],
    model: 'test',
    createdAt: '2026-09-25T15:05:00.000Z',
    ...partial
  }
}

describe('meeting export', () => {
  it('writes frontmatter, a timestamped line, and the summary', () => {
    const exported = buildMeetingExport({
      id,
      title: 'Standup',
      startedAt: '2026-09-25T15:04:05.000Z',
      attendees: [{ name: 'Ada', email: 'ada@example.com' }],
      speakers: [{ id: 'speaker-1', label: 'Speaker 1', name: 'Ada' }],
      transcript: transcript(),
      summary: 'Shipped the build.'
    })
    expect(exported.kind).toBe('markdown')
    if (exported.kind !== 'markdown') return
    expect(exported.markdown).toContain('title: "Standup"')
    expect(exported.markdown).toContain('date: "2026-09-25T15:04:05.000Z"')
    expect(exported.markdown).toContain('  - "Ada <ada@example.com>"')
    expect(exported.markdown).toContain(`meetrec_id: "${id}"`)
    expect(exported.markdown).toContain('transcript: "transcript.json"')
    expect(exported.markdown).toContain('summary: "summary.md"')
    expect(exported.markdown).toContain('[t=62.5] [01:02] Ada: hello there')
    expect(exported.markdown).toContain('## Summary')
    expect(exported.markdown).toContain('Shipped the build.')
    expect(exported.markdown).not.toContain('audio.mp3')
    expect(exported.markdown).not.toContain('audio.wav')
    expect(exported.markdown).not.toMatch(/\/[A-Za-z0-9._-]+\//)
  })

  it('omits attendees and the summary section when they are absent', () => {
    const exported = buildMeetingExport({
      id,
      title: 'Standup',
      startedAt: '2026-09-25T15:04:05.000Z',
      attendees: null,
      speakers: [{ id: 'speaker-1', label: 'Speaker 1', name: '' }],
      transcript: transcript(),
      summary: '   '
    })
    expect(exported.kind).toBe('markdown')
    if (exported.kind !== 'markdown') return
    expect(exported.markdown).not.toContain('attendees:')
    expect(exported.markdown).not.toContain('## Summary')
    expect(exported.markdown).not.toContain('summary:')
    expect(exported.markdown).toContain('[t=62.5] [01:02] Speaker 1: hello there')
  })

  it('prefers the saved speaker name over the diarized label', () => {
    const exported = buildMeetingExport({
      id,
      title: 'Standup',
      startedAt: '2026-09-25T15:04:05.000Z',
      attendees: null,
      speakers: [{ id: 'speaker-1', label: 'Speaker 1', name: 'Grace' }],
      transcript: transcript(),
      summary: null
    })
    expect(exported.kind).toBe('markdown')
    if (exported.kind !== 'markdown') return
    expect(exported.markdown).toContain('Grace: hello there')
    expect(exported.markdown).not.toContain('Speaker 1:')
  })

  it('writes one paragraph when the transcript has text and no segments', () => {
    const exported = buildMeetingExport({
      id,
      title: 'Notes',
      startedAt: '2026-09-25T15:04:05.000Z',
      attendees: null,
      speakers: [],
      transcript: transcript({ text: 'plain paragraph', segments: [] }),
      summary: null
    })
    expect(exported.kind).toBe('markdown')
    if (exported.kind !== 'markdown') return
    expect(exported.markdown).toContain('plain paragraph')
    expect(exported.markdown).not.toContain('[t=')
  })

  it('skips an empty transcript', () => {
    const exported = buildMeetingExport({
      id,
      title: 'Empty',
      startedAt: '2026-09-25T15:04:05.000Z',
      attendees: null,
      speakers: [],
      transcript: transcript({ text: '  ', segments: [] }),
      summary: 'unused'
    })
    expect(exported).toEqual({ kind: 'skip' })
  })

  it('changes the token when speaker names change and ignores unrelated fields', () => {
    const base = {
      transcriptMtimeMs: 10,
      transcriptSize: 20,
      summaryMtimeMs: 30,
      summarySize: 40,
      speakerNames: ['Ada']
    }
    const named = sourceToken(base)
    expect(sourceToken({ ...base, speakerNames: ['Grace'] })).not.toBe(named)
    expect(sourceToken({ ...base })).toBe(named)
  })

  it('flattens newlines in the title', () => {
    const exported = buildMeetingExport({
      id,
      title: 'Standup\ncontinued',
      startedAt: '2026-09-25T15:04:05.000Z',
      attendees: null,
      speakers: [],
      transcript: transcript({ text: 'hello', segments: [] }),
      summary: null
    })
    expect(exported.kind).toBe('markdown')
    if (exported.kind !== 'markdown') return
    expect(exported.markdown).toContain('title: "Standup continued"')
  })
})
