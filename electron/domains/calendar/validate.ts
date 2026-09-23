import { CLIENT_ID_MAX } from './constants'
import type { CalendarEvent } from './source'

export function cleanProvider(value: unknown): 'google' | 'microsoft' {
  if (value === 'google' || value === 'microsoft') return value
  throw new Error('Choose Google or Microsoft.')
}

export function cleanPurpose(value: unknown): 'calendar' | 'drive' {
  if (value === 'calendar' || value === 'drive') return value
  throw new Error('Choose a connect purpose.')
}

export function cleanClientId(value: unknown): string {
  if (typeof value !== 'string') throw new Error('Enter a client id.')
  const trimmed = value.trim()
  if (!trimmed) throw new Error('Enter a client id.')
  if (trimmed.length > CLIENT_ID_MAX) throw new Error('Client id is too long.')
  if (/[\r\n]/.test(trimmed)) throw new Error('Client id cannot contain a new line.')
  return trimmed
}

export function cleanClientSecret(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) throw new Error('Enter a client secret.')
  if (trimmed.length > 500) throw new Error('Client secret is too long.')
  if (/[\r\n]/.test(trimmed)) throw new Error('Client secret cannot contain a new line.')
  return trimmed
}

export function requireEvent(events: CalendarEvent[], value: unknown): CalendarEvent {
  if (typeof value !== 'string') throw new Error('That event is not in the list.')
  const found = events.find((event) => event.occurrenceKey === value)
  if (!found) throw new Error('That event is not in the list.')
  return found
}
