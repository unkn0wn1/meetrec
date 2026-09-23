import { MAX_EVENTS } from './constants'
import { occurrenceKey, toUtcIso } from './occurrence'
import { readJson, shortTokenError } from './redact'
import type { CalendarAttendee, CalendarEvent, CalendarSource } from './source'

const EVENTS_URL = 'https://www.googleapis.com/calendar/v3/calendars/primary/events'

export function googleEventsUrl(from: Date, to: Date, pageToken?: string): string {
  const url = new URL(EVENTS_URL)
  url.searchParams.set('singleEvents', 'true')
  url.searchParams.set('orderBy', 'startTime')
  url.searchParams.set('showDeleted', 'false')
  url.searchParams.set('maxResults', String(MAX_EVENTS))
  url.searchParams.set('timeMin', from.toISOString())
  url.searchParams.set('timeMax', to.toISOString())
  if (pageToken) url.searchParams.set('pageToken', pageToken)
  return url.toString()
}

export function parseGoogleEventList(payload: unknown): {
  events: CalendarEvent[]
  nextPageToken: string | null
} {
  if (!payload || typeof payload !== 'object') return { events: [], nextPageToken: null }
  const record = payload as Record<string, unknown>
  const items = Array.isArray(record.items) ? record.items : []
  const events: CalendarEvent[] = []
  for (const item of items) {
    const parsed = parseGoogleEvent(item)
    if (parsed) events.push(parsed)
  }
  const token = record.nextPageToken
  return { events, nextPageToken: typeof token === 'string' && token ? token : null }
}

export async function listGoogleEvents(
  accessToken: string,
  from: Date,
  to: Date,
  fetchImpl: typeof fetch = fetch
): Promise<CalendarEvent[]> {
  const first = parseGoogleEventList(
    await getJson(googleEventsUrl(from, to), accessToken, fetchImpl)
  )
  let events = first.events
  if (first.nextPageToken) {
    const second = parseGoogleEventList(
      await getJson(googleEventsUrl(from, to, first.nextPageToken), accessToken, fetchImpl)
    )
    events = events.concat(second.events)
  }
  return events.slice(0, MAX_EVENTS)
}

export const googleCalendarSource: CalendarSource = {
  id: 'google',
  listEvents: listGoogleEvents
}

export class CalendarHttpError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message)
    this.name = 'CalendarHttpError'
  }
}

async function getJson(
  url: string,
  accessToken: string,
  fetchImpl: typeof fetch
): Promise<unknown> {
  const response = await fetchImpl(url, {
    headers: { Authorization: `Bearer ${accessToken}` }
  })
  const payload = await readJson(response)
  if (!response.ok) {
    throw new CalendarHttpError(
      response.status,
      shortTokenError(payload, `Google Calendar returned ${response.status}.`)
    )
  }
  return payload
}

function parseGoogleEvent(value: unknown): CalendarEvent | null {
  if (!value || typeof value !== 'object') return null
  const record = value as Record<string, unknown>
  if (record.status === 'cancelled') return null
  const eventId = text(record.id)
  if (!eventId) return null
  const start = record.start
  if (!start || typeof start !== 'object') return null
  const startRaw = text((start as Record<string, unknown>).dateTime)
  if (!startRaw) return null
  const startsAt = toUtcIso(startRaw)
  if (!startsAt) return null
  if (selfDeclined(record.attendees)) return null
  const end = record.end
  const endRaw =
    end && typeof end === 'object' ? text((end as Record<string, unknown>).dateTime) : null
  const summary = text(record.summary)
  return {
    provider: 'google',
    eventId,
    occurrenceKey: occurrenceKey('google', eventId, startsAt),
    seriesId: text(record.recurringEventId),
    title: summary ?? 'Busy',
    startsAt,
    endsAt: endRaw ? toUtcIso(endRaw) : null,
    attendees: readAttendees(record.attendees)
  }
}

function selfDeclined(value: unknown): boolean {
  if (!Array.isArray(value)) return false
  return value.some((item) => {
    if (!item || typeof item !== 'object') return false
    const record = item as Record<string, unknown>
    return record.self === true && record.responseStatus === 'declined'
  })
}

function readAttendees(value: unknown): CalendarAttendee[] {
  if (!Array.isArray(value)) return []
  const attendees: CalendarAttendee[] = []
  for (const item of value) {
    if (!item || typeof item !== 'object') continue
    const record = item as Record<string, unknown>
    const email = text(record.email)
    const name = text(record.displayName) ?? ''
    if (!name && !email) continue
    attendees.push({ name, email })
  }
  return attendees
}

function text(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed || null
}
