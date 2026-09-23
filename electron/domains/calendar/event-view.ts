import type { CalendarEventView } from '../../shared/calendar-contract'
import { LOOKAHEAD_MS } from './constants'
import { occurrenceSkipped } from './schedule'
import type { CalendarEvent } from './source'
import type { CalendarRuntimeState } from './state-file'

export function upcomingEvents(
  events: CalendarEvent[],
  state: CalendarRuntimeState,
  now: number
): CalendarEventView[] {
  return events.filter((event) => inWindow(event, now)).map((event) => toView(event, state))
}

export function nextRecordableEvent(
  events: CalendarEvent[],
  state: CalendarRuntimeState,
  now: number
): CalendarEvent | null {
  return (
    events.find((event) => {
      const start = Date.parse(event.startsAt)
      if (Number.isNaN(start) || start < now) return false
      return !occurrenceSkipped(event.occurrenceKey, event.seriesId, state)
    }) ?? null
  )
}

function inWindow(event: CalendarEvent, now: number): boolean {
  const start = Date.parse(event.startsAt)
  if (Number.isNaN(start) || start > now + LOOKAHEAD_MS) return false
  const end = event.endsAt ? Date.parse(event.endsAt) : start
  return !Number.isNaN(end) && end >= now
}

function toView(event: CalendarEvent, state: CalendarRuntimeState): CalendarEventView {
  const names: string[] = []
  for (const attendee of event.attendees) {
    const name = attendee.name.trim()
    if (!name || name.includes('@') || names.includes(name)) continue
    names.push(name)
  }
  return {
    occurrenceKey: event.occurrenceKey,
    provider: event.provider,
    title: event.title,
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    attendeeNames: names,
    seriesId: event.seriesId,
    record: !occurrenceSkipped(event.occurrenceKey, event.seriesId, state),
    seriesSkipped: Boolean(event.seriesId && state.disabledSeries.includes(event.seriesId))
  }
}
