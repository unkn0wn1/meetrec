import { describe, expect, it } from 'vitest'
import { googleEventsUrl, parseGoogleEventList } from './google-events'

const context = {
  connectionId: 'acct',
  calendarId: 'cal/id',
  accountEmail: 'ada@example.com',
  calendarLabel: 'Work',
  calendarPrimary: false
}

describe('google events', () => {
  it('maps a timed event and drops all-day, cancelled, and declined', () => {
    const parsed = parseGoogleEventList(
      {
        items: [
          {
            id: 'evt-1',
            status: 'confirmed',
            summary: 'Standup',
            recurringEventId: 'series-1',
            start: { dateTime: '2026-09-23T15:00:00-07:00' },
            end: { dateTime: '2026-09-23T15:30:00-07:00' },
            attendees: [
              { email: 'ada@example.com', displayName: 'Ada', responseStatus: 'accepted' },
              { self: true, email: 'me@example.com', displayName: 'Me', responseStatus: 'accepted' }
            ]
          },
          { id: 'all-day', summary: 'Holiday', start: { date: '2026-09-23' } },
          {
            id: 'cancelled',
            status: 'cancelled',
            summary: 'Nope',
            start: { dateTime: '2026-09-23T16:00:00Z' }
          },
          {
            id: 'declined',
            summary: 'Skip',
            start: { dateTime: '2026-09-23T17:00:00Z' },
            attendees: [{ self: true, email: 'me@example.com', responseStatus: 'declined' }]
          },
          { id: 'busy', status: 'confirmed', start: { dateTime: '2026-09-23T18:00:00Z' } }
        ]
      },
      context
    )
    expect(parsed.events.map((event) => event.eventId)).toEqual(['evt-1', 'busy'])
    expect(parsed.events[0]).toMatchObject({
      provider: 'google',
      title: 'Standup',
      occurrenceKey: 'google:v2:acct:cal%2Fid:evt-1:2026-09-23T22:00:00.000Z',
      connectionId: 'acct',
      calendarId: 'cal/id',
      accountEmail: 'ada@example.com',
      startsAt: '2026-09-23T22:00:00.000Z',
      endsAt: '2026-09-23T22:30:00.000Z',
      seriesId: 'series-1'
    })
    expect(parsed.events[0]?.attendees).toEqual([
      { name: 'Ada', email: 'ada@example.com' },
      { name: 'Me', email: 'me@example.com' }
    ])
    expect(parsed.events[1]?.title).toBe('Busy')
    expect(parsed.events[1]?.seriesId).toBeNull()
  })

  it('encodes the calendar id in the events URL', () => {
    const url = googleEventsUrl(
      'cal/id',
      new Date('2026-09-23T00:00:00.000Z'),
      new Date('2026-09-24T00:00:00.000Z')
    )
    expect(url).toContain('/calendars/cal%2Fid/events')
  })
})
