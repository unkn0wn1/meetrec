import type { CalendarEvent } from './source'

export function cleanProvider(value: unknown): 'google' | 'microsoft' {
  if (value === 'google' || value === 'microsoft') return value
  throw new Error('Choose Google or Microsoft.')
}

export function cleanPurpose(value: unknown): 'calendar' | 'drive' {
  if (value === 'calendar' || value === 'drive') return value
  throw new Error('Choose a connect purpose.')
}

export function requireEvent(events: CalendarEvent[], value: unknown): CalendarEvent {
  if (typeof value !== 'string') throw new Error('That event is not in the list.')
  const found = events.find((event) => event.occurrenceKey === value)
  if (!found) throw new Error('That event is not in the list.')
  return found
}
