import { CalendarHttpError } from './google-events'
import { readJson, shortTokenError } from './redact'
import type { ListedCalendar } from './selection'

const LIST_URL = 'https://graph.microsoft.com/v1.0/me/calendars?$top=100'

export function parseMicrosoftCalendars(payload: unknown): ListedCalendar[] {
  if (!payload || typeof payload !== 'object') return []
  const items = (payload as Record<string, unknown>).value
  if (!Array.isArray(items)) return []
  const calendars: ListedCalendar[] = []
  for (const item of items) {
    const parsed = parseCalendar(item)
    if (parsed && !calendars.some((calendar) => calendar.id === parsed.id)) calendars.push(parsed)
  }
  return calendars
}

export async function listMicrosoftCalendars(
  accessToken: string,
  fetchImpl: typeof fetch = fetch
): Promise<ListedCalendar[]> {
  const response = await fetchImpl(LIST_URL, {
    headers: { Authorization: `Bearer ${accessToken}` }
  })
  const payload = await readJson(response)
  if (!response.ok) {
    throw new CalendarHttpError(
      response.status,
      shortTokenError(payload, `Microsoft Calendar returned ${response.status}.`)
    )
  }
  return parseMicrosoftCalendars(payload)
}

function parseCalendar(value: unknown): ListedCalendar | null {
  if (!value || typeof value !== 'object') return null
  const record = value as Record<string, unknown>
  const id = text(record.id)
  if (!id) return null
  return {
    id,
    summary: text(record.name) ?? id,
    primary: record.isDefaultCalendar === true
  }
}

function text(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed || null
}
