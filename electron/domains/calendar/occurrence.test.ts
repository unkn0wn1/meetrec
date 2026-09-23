import { describe, expect, it } from 'vitest'
import { occurrenceKey, parseOccurrenceKey } from './occurrence'

const START = '2026-09-23T15:00:00.000Z'

describe('occurrence keys', () => {
  it('round-trips google and microsoft ids that contain colons', () => {
    const google = occurrenceKey({
      provider: 'google',
      eventId: 'evt:1',
      startsAt: START,
      connectionId: 'user:1',
      calendarId: 'cal:1'
    })
    expect(parseOccurrenceKey(google)).toEqual({
      provider: 'google',
      eventId: 'evt:1',
      startsAt: START,
      connectionId: 'user:1',
      calendarId: 'cal:1'
    })
    const microsoft = occurrenceKey({
      provider: 'microsoft',
      eventId: 'evt:1',
      startsAt: START,
      calendarId: 'cal:1'
    })
    expect(parseOccurrenceKey(microsoft)).toEqual({
      provider: 'microsoft',
      eventId: 'evt:1',
      startsAt: START,
      connectionId: null,
      calendarId: 'cal:1'
    })
  })

  it('parses a legacy key as the whole middle, including colons', () => {
    expect(parseOccurrenceKey(`google:evt:1:${START}`)).toEqual({
      provider: 'google',
      eventId: 'evt:1',
      startsAt: START,
      connectionId: null,
      calendarId: null
    })
  })
})
