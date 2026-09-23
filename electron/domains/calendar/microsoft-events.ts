import { MAX_EVENTS } from './constants'
import { occurrenceKey, toUtcIso } from './occurrence'
import { readJson, shortTokenError } from './redact'
import type { CalendarAttendee, CalendarEvent, CalendarSource } from './source'
import { CalendarHttpError } from './google-events'

const VIEW_URL = 'https://graph.microsoft.com/v1.0/me/calendarView'

export function microsoftEventsUrl(from: Date, to: Date): string {
  const url = new URL(VIEW_URL)
  url.searchParams.set('startDateTime', from.toISOString())
  url.searchParams.set('endDateTime', to.toISOString())
  url.searchParams.set('$top', String(MAX_EVENTS))
  return url.toString()
}

export function parseMicrosoftEvents(payload: unknown): CalendarEvent[] {
  if (!payload || typeof payload !== 'object') return []
  const items = (payload as Record<string, unknown>).value
  if (!Array.isArray(items)) return []
  const events: CalendarEvent[] = []
  for (const item of items) {
    const parsed = parseMicrosoftEvent(item)
    if (parsed) events.push(parsed)
  }
  return events
    .sort((left, right) => Date.parse(left.startsAt) - Date.parse(right.startsAt))
    .slice(0, MAX_EVENTS)
}

export async function listMicrosoftEvents(
  accessToken: string,
  from: Date,
  to: Date,
  fetchImpl: typeof fetch = fetch
): Promise<CalendarEvent[]> {
  const response = await fetchImpl(microsoftEventsUrl(from, to), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Prefer: 'outlook.timezone="UTC"'
    }
  })
  const payload = await readJson(response)
  if (!response.ok) {
    throw new CalendarHttpError(
      response.status,
      shortTokenError(payload, `Microsoft Calendar returned ${response.status}.`)
    )
  }
  return parseMicrosoftEvents(payload)
}

export const microsoftCalendarSource: CalendarSource = {
  id: 'microsoft',
  listEvents: listMicrosoftEvents
}

function parseMicrosoftEvent(value: unknown): CalendarEvent | null {
  if (!value || typeof value !== 'object') return null
  const record = value as Record<string, unknown>
  if (record.isAllDay === true || record.isCancelled === true || isDeclined(record)) return null
  const eventId = text(record.id)
  if (!eventId) return null
  const start = dateField(record.start)
  if (!start) return null
  const subject = text(record.subject)
  return {
    provider: 'microsoft',
    eventId,
    occurrenceKey: occurrenceKey('microsoft', eventId, start),
    seriesId: text(record.seriesMasterId),
    title: subject ?? 'Busy',
    startsAt: start,
    endsAt: dateField(record.end),
    attendees: readAttendees(record.attendees)
  }
}

function isDeclined(record: Record<string, unknown>): boolean {
  const status = record.responseStatus
  if (!status || typeof status !== 'object') return false
  return (status as Record<string, unknown>).response === 'declined'
}

function dateField(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null
  const record = value as Record<string, unknown>
  const dateTime = text(record.dateTime)
  if (!dateTime) return null
  const timeZone = text(record.timeZone)
  return graphInstant(dateTime, timeZone)
}

function graphInstant(dateTime: string, timeZone: string | null): string | null {
  let value = dateTime
  if (!/[zZ]$|[+-]\d{2}:\d{2}$/.test(value)) {
    const zone = (timeZone ?? 'UTC').toUpperCase()
    if (zone !== 'UTC' && zone !== 'GMT') return null
    value = `${value}Z`
  }
  value = value.replace(
    /\.(\d+)(Z|[+-]\d{2}:\d{2})$/,
    (_match, fraction: string, zone: string) => `.${fraction.slice(0, 3)}${zone}`
  )
  return toUtcIso(value)
}

function readAttendees(value: unknown): CalendarAttendee[] {
  if (!Array.isArray(value)) return []
  const attendees: CalendarAttendee[] = []
  for (const item of value) {
    if (!item || typeof item !== 'object') continue
    const emailAddress = (item as Record<string, unknown>).emailAddress
    if (!emailAddress || typeof emailAddress !== 'object') continue
    const record = emailAddress as Record<string, unknown>
    const email = text(record.address)
    const name = text(record.name) ?? ''
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
