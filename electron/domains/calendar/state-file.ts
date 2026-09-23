import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { STATE_CAP, STATE_PRUNE_MS } from './constants'
import { parseOccurrenceKey, startMsFromKey } from './occurrence'

const FILE_NAME = 'calendar-state.json'

export interface CalendarArm {
  occurrenceKey: string
  fireAt: string
  title: string
  endsAt: string | null
  seriesId: string | null
}

export interface CalendarLinkedStop {
  recordingId: string
  stopAt: string
  occurrenceKey: string
}

export interface CalendarRuntimeState {
  dismissed: string[]
  notified: string[]
  disabledOccurrences: string[]
  disabledSeries: string[]
  arm: CalendarArm | null
  linkedStop: CalendarLinkedStop | null
}

export function emptyRuntimeState(): CalendarRuntimeState {
  return {
    dismissed: [],
    notified: [],
    disabledOccurrences: [],
    disabledSeries: [],
    arm: null,
    linkedStop: null
  }
}

export function normalizeState(state: CalendarRuntimeState, now: number): CalendarRuntimeState {
  return {
    dismissed: pruneKeys(state.dismissed, now),
    notified: pruneKeys(state.notified, now),
    disabledOccurrences: pruneKeys(state.disabledOccurrences, now),
    // Series ids are not occurrence keys, so they are capped but not time-pruned.
    disabledSeries: capIds(state.disabledSeries),
    arm: state.arm && keyIsCurrent(state.arm.occurrenceKey, now) ? state.arm : null,
    linkedStop: state.linkedStop
  }
}

export function rememberKey(keys: string[], key: string): string[] {
  return [key, ...keys.filter((item) => item !== key)]
}

export function dropProviderKeys(
  state: CalendarRuntimeState,
  provider: 'google' | 'microsoft'
): CalendarRuntimeState {
  const prefix = `${provider}:`
  return {
    ...state,
    dismissed: state.dismissed.filter((key) => !key.startsWith(prefix)),
    notified: state.notified.filter((key) => !key.startsWith(prefix)),
    disabledOccurrences: state.disabledOccurrences.filter((key) => !key.startsWith(prefix)),
    arm: state.arm?.occurrenceKey.startsWith(prefix) ? null : state.arm,
    linkedStop: state.linkedStop?.occurrenceKey.startsWith(prefix) ? null : state.linkedStop
  }
}

/** Drop dismissals and arms whose occurrence key belongs to one Google connection. */
export function dropGoogleConnectionKeys(
  state: CalendarRuntimeState,
  connectionId: string
): CalendarRuntimeState {
  const drop = (key: string): boolean => {
    const parsed = parseOccurrenceKey(key)
    return parsed?.provider === 'google' && parsed.connectionId === connectionId
  }
  return {
    ...state,
    dismissed: state.dismissed.filter((key) => !drop(key)),
    notified: state.notified.filter((key) => !drop(key)),
    disabledOccurrences: state.disabledOccurrences.filter((key) => !drop(key)),
    arm: state.arm && drop(state.arm.occurrenceKey) ? null : state.arm,
    linkedStop: state.linkedStop && drop(state.linkedStop.occurrenceKey) ? null : state.linkedStop
  }
}

export function parseRuntimeState(raw: string): CalendarRuntimeState | null {
  let value: unknown
  try {
    value = JSON.parse(raw)
  } catch {
    return null
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const record = value as Record<string, unknown>
  return {
    dismissed: stringList(record.dismissed),
    notified: stringList(record.notified),
    disabledOccurrences: stringList(record.disabledOccurrences),
    disabledSeries: stringList(record.disabledSeries),
    arm: parseArm(record.arm),
    linkedStop: parseLink(record.linkedStop)
  }
}

export async function readState(dir: string, now = Date.now()): Promise<CalendarRuntimeState> {
  let raw: string
  try {
    raw = await readFile(join(dir, FILE_NAME), 'utf8')
  } catch {
    return emptyRuntimeState()
  }
  const parsed = parseRuntimeState(raw)
  if (!parsed) {
    const empty = emptyRuntimeState()
    await writeState(dir, empty, now)
    return empty
  }
  return normalizeState(parsed, now)
}

export async function writeState(
  dir: string,
  state: CalendarRuntimeState,
  now = Date.now()
): Promise<void> {
  const normalized = normalizeState(state, now)
  await writeFile(join(dir, FILE_NAME), `${JSON.stringify(normalized, null, 2)}\n`, 'utf8')
}

function pruneKeys(keys: string[], now: number): string[] {
  return keys.filter((key) => keyIsCurrent(key, now)).slice(0, STATE_CAP)
}

function capIds(ids: string[]): string[] {
  const seen = new Set<string>()
  const kept: string[] = []
  for (const id of ids) {
    if (seen.has(id)) continue
    seen.add(id)
    kept.push(id)
    if (kept.length === STATE_CAP) break
  }
  return kept
}

function keyIsCurrent(key: string, now: number): boolean {
  const start = startMsFromKey(key)
  if (start == null) return false
  return start > now - STATE_PRUNE_MS
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string' && item.length > 0)
}

function parseArm(value: unknown): CalendarArm | null {
  if (!value || typeof value !== 'object') return null
  const record = value as Record<string, unknown>
  if (typeof record.occurrenceKey !== 'string' || typeof record.fireAt !== 'string') return null
  if (typeof record.title !== 'string' || !record.title.trim()) return null
  return {
    occurrenceKey: record.occurrenceKey,
    fireAt: record.fireAt,
    title: record.title,
    endsAt: typeof record.endsAt === 'string' ? record.endsAt : null,
    seriesId: typeof record.seriesId === 'string' && record.seriesId.trim() ? record.seriesId : null
  }
}

function parseLink(value: unknown): CalendarLinkedStop | null {
  if (!value || typeof value !== 'object') return null
  const record = value as Record<string, unknown>
  if (typeof record.recordingId !== 'string' || typeof record.stopAt !== 'string') return null
  if (typeof record.occurrenceKey !== 'string') return null
  return {
    recordingId: record.recordingId,
    stopAt: record.stopAt,
    occurrenceKey: record.occurrenceKey
  }
}
