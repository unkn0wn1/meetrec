import { describe, expect, it } from 'vitest'
import { parseSearchHits } from './hits'

const id = '2026-09-25T15-04-05-000Z'

function row(extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    file: `qmd://meetings/${id}.md`,
    title: 'Standup',
    snippet: '[t=62.5] [01:02] Ada: hello there',
    score: 0.91,
    ...extra
  }
}

describe('search hits', () => {
  it('reads an array and a results object', () => {
    const fromArray = parseSearchHits(JSON.stringify([row()]))
    const fromObject = parseSearchHits(JSON.stringify({ results: [row()] }))
    expect(fromArray).toEqual(fromObject)
    expect(fromArray[0]).toMatchObject({
      recordingId: id,
      title: 'Standup',
      startMs: 62500,
      score: 0.91
    })
  })

  it('returns a null offset when the snippet has no timestamp', () => {
    const hits = parseSearchHits(JSON.stringify([row({ snippet: 'hello there', line: null })]))
    expect(hits[0]?.startMs).toBeNull()
  })

  it('reads the timestamp from the export line when the snippet has none', () => {
    const hits = parseSearchHits(JSON.stringify([row({ snippet: 'hello', line: 4 })]), () => {
      return '[t=62.5] [01:02] Ada: hello there'
    })
    expect(hits[0]?.startMs).toBe(62500)
  })

  it('keeps the first 20 hits', () => {
    const rows = Array.from({ length: 25 }, () => row())
    expect(parseSearchHits(JSON.stringify(rows))).toHaveLength(20)
  })
})
