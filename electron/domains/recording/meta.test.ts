import { describe, expect, it } from 'vitest'
import { parseMeta, uploadFlags } from './meta'

describe('recording meta', () => {
  it('parses a calendar link and treats a missing link as null', () => {
    const parsed = parseMeta(
      JSON.stringify({
        id: 'ab',
        startedAt: '2026-09-23T15:00:00.000Z',
        calendar: {
          provider: 'google',
          occurrenceKey: 'google:evt:2026-09-23T15:00:00.000Z',
          title: 'Standup',
          startsAt: '2026-09-23T15:00:00.000Z',
          endsAt: null,
          attendees: [{ name: 'Ada', email: 'ada@example.com' }]
        }
      })
    )
    expect(parsed?.calendar).toEqual({
      provider: 'google',
      occurrenceKey: 'google:evt:2026-09-23T15:00:00.000Z',
      title: 'Standup',
      startsAt: '2026-09-23T15:00:00.000Z',
      endsAt: null,
      attendees: [{ name: 'Ada', email: 'ada@example.com' }]
    })
    expect(
      parseMeta(JSON.stringify({ id: 'ab', startedAt: '2026-09-23T15:00:00.000Z' }))?.calendar
    ).toBe(null)
  })

  it('reports Drive and OneDrive only when a file id is stored', () => {
    expect(uploadFlags(undefined)).toEqual({ hasGoogleDrive: false, hasOneDrive: false })
    expect(
      uploadFlags({
        google: { folderId: 'folder', files: { audio: 'g-audio' } },
        microsoft: { files: {} }
      })
    ).toEqual({ hasGoogleDrive: true, hasOneDrive: false })
    expect(uploadFlags({ microsoft: { files: { summary: 'm-summary' } } })).toEqual({
      hasGoogleDrive: false,
      hasOneDrive: true
    })
  })
})
