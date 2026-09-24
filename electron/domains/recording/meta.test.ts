import { describe, expect, it } from 'vitest'
import { calendarSummary, parseMeta, uploadFlags, type RecordingCalendarLink } from './meta'

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

  it('passes title and attendees through and drops the rest of the calendar link', () => {
    const link: RecordingCalendarLink = {
      provider: 'microsoft',
      occurrenceKey: 'microsoft:evt:2026-09-25T15:00:00.000Z',
      title: 'Planning',
      startsAt: '2026-09-25T15:00:00.000Z',
      endsAt: '2026-09-25T15:30:00.000Z',
      attendees: [
        { name: 'Ada', email: 'ada@example.com' },
        { name: 'Grace', email: null }
      ]
    }
    expect(calendarSummary(link)).toEqual({
      title: 'Planning',
      attendees: [
        { name: 'Ada', email: 'ada@example.com' },
        { name: 'Grace', email: null }
      ]
    })
    expect(calendarSummary(null)).toBeNull()
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
