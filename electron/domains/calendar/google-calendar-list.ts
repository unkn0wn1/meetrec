import { CalendarHttpError } from './google-events'
import { readJson, shortTokenError } from './redact'
import type { ListedCalendar } from './selection'

const LIST_URL = 'https://www.googleapis.com/calendar/v3/users/me/calendarList'

export function googleCalendarListUrl(pageToken?: string): string {
  const url = new URL(LIST_URL)
  url.searchParams.set('minAccessRole', 'reader')
  url.searchParams.set('showDeleted', 'false')
  url.searchParams.set('maxResults', '250')
  if (pageToken) url.searchParams.set('pageToken', pageToken)
  return url.toString()
}

export function parseGoogleCalendarList(payload: unknown): {
  calendars: ListedCalendar[]
  nextPageToken: string | null
} {
  if (!payload || typeof payload !== 'object') return { calendars: [], nextPageToken: null }
  const record = payload as Record<string, unknown>
  const items = Array.isArray(record.items) ? record.items : []
  const calendars: ListedCalendar[] = []
  for (const item of items) {
    const parsed = parseCalendar(item)
    if (parsed && !calendars.some((calendar) => calendar.id === parsed.id)) calendars.push(parsed)
  }
  const token = record.nextPageToken
  return { calendars, nextPageToken: typeof token === 'string' && token ? token : null }
}

export async function listGoogleCalendars(
  accessToken: string,
  fetchImpl: typeof fetch = fetch
): Promise<ListedCalendar[]> {
  const first = parseGoogleCalendarList(
    await getJson(googleCalendarListUrl(), accessToken, fetchImpl)
  )
  const calendars = first.calendars
  if (first.nextPageToken) {
    const second = parseGoogleCalendarList(
      await getJson(googleCalendarListUrl(first.nextPageToken), accessToken, fetchImpl)
    )
    for (const calendar of second.calendars) {
      if (!calendars.some((item) => item.id === calendar.id)) calendars.push(calendar)
    }
  }
  return calendars
}

function parseCalendar(value: unknown): ListedCalendar | null {
  if (!value || typeof value !== 'object') return null
  const record = value as Record<string, unknown>
  const id = text(record.id)
  if (!id) return null
  return {
    id,
    summary: text(record.summary) ?? id,
    primary: record.primary === true
  }
}

async function getJson(
  url: string,
  accessToken: string,
  fetchImpl: typeof fetch
): Promise<unknown> {
  const response = await fetchImpl(url, { headers: { Authorization: `Bearer ${accessToken}` } })
  const payload = await readJson(response)
  if (!response.ok) {
    throw new CalendarHttpError(
      response.status,
      shortTokenError(payload, `Google Calendar returned ${response.status}.`)
    )
  }
  return payload
}

function text(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed || null
}
