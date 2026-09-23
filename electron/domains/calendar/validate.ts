import type { CalendarRecordInput } from '../../shared/calendar-contract'
import { MAX_SELECTED_CALENDARS } from './constants'
import type { CalendarEvent } from './source'

export function cleanProvider(value: unknown): 'google' | 'microsoft' {
  if (value === 'google' || value === 'microsoft') return value
  throw new Error('Choose Google or Microsoft.')
}

export function cleanPurpose(value: unknown): 'calendar' | 'drive' {
  if (value === 'calendar' || value === 'drive') return value
  throw new Error('Choose a connect purpose.')
}

export function cleanConnectionId(value: unknown): string | null {
  if (value == null || value === '') return null
  if (typeof value !== 'string') throw new Error('Choose a Google account.')
  const trimmed = value.trim()
  return trimmed || null
}

export function cleanCalendarIds(value: unknown): string[] {
  if (!Array.isArray(value)) throw new Error('Choose calendars.')
  const ids: string[] = []
  for (const item of value) {
    if (typeof item !== 'string') throw new Error('Choose calendars.')
    const trimmed = item.trim()
    if (!trimmed || ids.includes(trimmed)) continue
    ids.push(trimmed)
  }
  if (ids.length > MAX_SELECTED_CALENDARS) throw new Error('Select at most 20 calendars.')
  return ids
}

export function cleanEnabled(value: unknown): boolean {
  if (typeof value === 'boolean') return value
  throw new Error('Choose whether to record.')
}

export function cleanRecordScope(value: unknown): CalendarRecordInput['scope'] {
  if (value === 'occurrence' || value === 'series') return value
  throw new Error('Choose this occurrence or the entire series.')
}

export function requireEvent(events: CalendarEvent[], value: unknown): CalendarEvent {
  if (typeof value !== 'string') throw new Error('That event is not in the list.')
  const found = events.find((event) => event.occurrenceKey === value)
  if (!found) throw new Error('That event is not in the list.')
  return found
}
