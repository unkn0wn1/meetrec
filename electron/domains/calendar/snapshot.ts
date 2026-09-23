import { MAX_EVENTS, SNAPSHOT_MAX_AGE_MS } from './constants'
import type { CalendarMemory } from './deps'
import { mergeEvents } from './schedule'
import type { CalendarEvent } from './source'

export { fetchGoogleSnapshot } from './google-fetch'
export { fetchMicrosoftSnapshot } from './microsoft-fetch'

export function cachedEvents(memory: CalendarMemory): CalendarEvent[] {
  return mergeEvents([
    ...Object.values(memory.events.googleByConnection),
    memory.events.microsoft
  ]).slice(0, MAX_EVENTS)
}

export function freshEvents(
  memory: CalendarMemory,
  now: number
): { events: CalendarEvent[]; snapshotAt: number | null } {
  const groups: CalendarEvent[][] = []
  let snapshotAt: number | null = null
  for (const [id, events] of Object.entries(memory.events.googleByConnection)) {
    const fetchedAt = memory.fetchedAt.googleByConnection[id]
    if (fetchedAt == null || now - fetchedAt > SNAPSHOT_MAX_AGE_MS) continue
    groups.push(events)
    snapshotAt = snapshotAt == null ? fetchedAt : Math.min(snapshotAt, fetchedAt)
  }
  const microsoftAt = memory.fetchedAt.microsoft
  if (microsoftAt != null && now - microsoftAt <= SNAPSHOT_MAX_AGE_MS) {
    groups.push(memory.events.microsoft)
    snapshotAt = snapshotAt == null ? microsoftAt : Math.min(snapshotAt, microsoftAt)
  }
  return { events: mergeEvents(groups).slice(0, MAX_EVENTS), snapshotAt }
}
