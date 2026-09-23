import { describe, expect, it } from 'vitest'
import { artifactName, slugTitle } from './names'

describe('cloud file names', () => {
  it('builds a dated slug with a short id and a kind suffix', () => {
    expect(
      artifactName({
        startedAt: '2026-09-23T15:04:00.000Z',
        title: 'Standup',
        id: '2026-09-23T15-04-00-000Z-ab12cd',
        kind: 'audio'
      })
    ).toBe('2026-09-23-standup-ab12-audio.wav')
    expect(
      artifactName({
        startedAt: '2026-09-23T15:04:00.000Z',
        title: 'Standup',
        id: '2026-09-23T15-04-00-000Z-ab12cd',
        kind: 'transcript'
      })
    ).toBe('2026-09-23-standup-ab12-transcript.json')
    expect(
      artifactName({
        startedAt: '2026-09-23T15:04:00.000Z',
        title: 'Standup',
        id: '2026-09-23T15-04-00-000Z-ab12cd',
        kind: 'summary'
      })
    ).toBe('2026-09-23-standup-ab12-summary.md')
  })

  it('limits the slug and strips path separators', () => {
    expect(slugTitle('Q3 / budget: review')).toBe('q3-budget-review')
    expect(slugTitle('A'.repeat(80)).length).toBeLessThanOrEqual(60)
    expect(slugTitle('   ')).toBe('recording')
    expect(slugTitle('../etc/passwd')).not.toContain('/')
    expect(slugTitle('../etc/passwd')).not.toContain('\\')
  })
})
