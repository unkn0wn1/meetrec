import { describe, expect, it } from 'vitest'
import { parseGoogleEventList } from './google-events'

describe('google events', () => {
  it('maps a timed event and drops all-day, cancelled, and declined', () => {
    const parsed = parseGoogleEventList({
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
    })
    expect(parsed.events.map((event) => event.eventId)).toEqual(['evt-1', 'busy'])
    expect(parsed.events[0]).toMatchObject({
      provider: 'google',
      title: 'Standup',
      occurrenceKey: 'google:evt-1:2026-09-23T22:00:00.000Z',
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
})
