import { describe, expect, it } from 'vitest'
import { microsoftEventsUrl, parseMicrosoftEvents } from './microsoft-events'

describe('microsoft events', () => {
  it('maps a UTC dateTime and drops all-day, cancelled, and declined', () => {
    const events = parseMicrosoftEvents({
      value: [
        {
          id: 'later',
          subject: 'Later',
          isAllDay: false,
          isCancelled: false,
          responseStatus: { response: 'accepted' },
          start: { dateTime: '2026-09-23T16:00:00.0000000', timeZone: 'UTC' },
          end: { dateTime: '2026-09-23T16:30:00.0000000', timeZone: 'UTC' }
        },
        {
          id: 'evt',
          subject: 'Standup',
          seriesMasterId: 'series-9',
          isAllDay: false,
          isCancelled: false,
          responseStatus: { response: 'accepted' },
          start: { dateTime: '2026-09-23T15:00:00.0000000', timeZone: 'UTC' },
          end: { dateTime: '2026-09-23T15:30:00.0000000', timeZone: 'UTC' },
          attendees: [{ emailAddress: { name: 'Ada', address: 'ada@example.com' } }]
        },
        {
          id: 'all-day',
          subject: 'Holiday',
          isAllDay: true,
          start: { dateTime: '2026-09-23T00:00:00.0000000', timeZone: 'UTC' }
        },
        {
          id: 'cancelled',
          subject: 'Nope',
          isCancelled: true,
          start: { dateTime: '2026-09-23T12:00:00.0000000', timeZone: 'UTC' }
        },
        {
          id: 'declined',
          subject: 'Skip',
          responseStatus: { response: 'declined' },
          start: { dateTime: '2026-09-23T13:00:00.0000000', timeZone: 'UTC' }
        },
        {
          id: 'busy',
          subject: '   ',
          start: { dateTime: '2026-09-23T18:00:00.0000000', timeZone: 'UTC' }
        }
      ]
    })
    expect(events.map((event) => event.eventId)).toEqual(['evt', 'later', 'busy'])
    expect(events[0]).toMatchObject({
      provider: 'microsoft',
      title: 'Standup',
      occurrenceKey: 'microsoft:evt:2026-09-23T15:00:00.000Z',
      startsAt: '2026-09-23T15:00:00.000Z',
      endsAt: '2026-09-23T15:30:00.000Z',
      attendees: [{ name: 'Ada', email: 'ada@example.com' }],
      seriesId: 'series-9'
    })
    expect(events[2]?.title).toBe('Busy')
    expect(events[2]?.seriesId).toBeNull()
  })

  it('uses calendarView for one calendar and a v2 occurrence key', () => {
    const from = new Date('2026-09-23T00:00:00.000Z')
    const to = new Date('2026-09-24T00:00:00.000Z')
    expect(microsoftEventsUrl(from, to)).toContain('/me/calendarView')
    expect(microsoftEventsUrl(from, to, 'cal/id')).toContain('/me/calendars/cal%2Fid/calendarView')
    const events = parseMicrosoftEvents(
      {
        value: [
          {
            id: 'evt:1',
            subject: 'Standup',
            start: { dateTime: '2026-09-23T15:00:00.0000000', timeZone: 'UTC' }
          }
        ]
      },
      {
        calendarId: 'cal/id',
        accountEmail: 'ada@contoso.com',
        calendarLabel: 'Team',
        calendarPrimary: false
      }
    )
    expect(events[0]?.occurrenceKey).toBe('microsoft:v2:cal%2Fid:evt%3A1:2026-09-23T15:00:00.000Z')
    expect(events[0]?.calendarId).toBe('cal/id')
    expect(events[0]?.connectionId).toBeNull()
    expect(events[0]?.accountEmail).toBe('ada@contoso.com')
    const named = parseMicrosoftEvents(
      {
        value: [
          {
            id: 'evt:1',
            subject: 'Standup',
            start: { dateTime: '2026-09-23T15:00:00.0000000', timeZone: 'UTC' }
          }
        ]
      },
      {
        connectionId: 'oid 1',
        calendarId: 'cal/id',
        accountEmail: 'ada@contoso.com',
        calendarLabel: 'Team',
        calendarPrimary: false
      }
    )
    expect(named[0]?.occurrenceKey).toBe(
      'microsoft:v2:oid%201:cal%2Fid:evt%3A1:2026-09-23T15:00:00.000Z'
    )
    expect(named[0]?.connectionId).toBe('oid 1')
  })
})
