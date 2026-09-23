import { describe, expect, it } from 'vitest'
import { parseMicrosoftEvents } from './microsoft-events'

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
      attendees: [{ name: 'Ada', email: 'ada@example.com' }]
    })
    expect(events[2]?.title).toBe('Busy')
  })
})
