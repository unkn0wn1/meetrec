import { describe, expect, it } from 'vitest'
import { parseGoogleCalendarList } from './google-calendar-list'

describe('google calendar list', () => {
  it('keeps readable calendars and the primary flag', () => {
    const parsed = parseGoogleCalendarList({
      items: [
        { id: 'primary-id', summary: 'Ada', primary: true },
        { id: 'team', summary: 'Team' },
        { id: ' ', summary: 'Nope' },
        { id: 'primary-id', summary: 'Again', primary: true }
      ],
      nextPageToken: 'next'
    })
    expect(parsed.calendars).toEqual([
      { id: 'primary-id', summary: 'Ada', primary: true },
      { id: 'team', summary: 'Team', primary: false }
    ])
    expect(parsed.nextPageToken).toBe('next')
  })
})
