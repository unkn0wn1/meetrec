import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const FILE_NAME = 'calendar.json'

export interface CalendarPreferences {
  uploadGoogle: boolean
  uploadMicrosoft: boolean
  /** Missing key means the user has not chosen yet. An empty array means none. */
  googleCalendars: Record<string, string[]>
  /** Null means the user has not chosen yet. */
  microsoftCalendarIds: string[] | null
}

export function emptyPreferences(): CalendarPreferences {
  return {
    uploadGoogle: false,
    uploadMicrosoft: false,
    googleCalendars: {},
    microsoftCalendarIds: null
  }
}

export function parsePreferences(raw: string): CalendarPreferences | null {
  let value: unknown
  try {
    value = JSON.parse(raw)
  } catch {
    return null
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const record = value as Record<string, unknown>
  return {
    uploadGoogle: record.uploadGoogle === true,
    uploadMicrosoft: record.uploadMicrosoft === true,
    googleCalendars: calendarMap(record.googleCalendars),
    microsoftCalendarIds: calendarIdList(record.microsoftCalendarIds)
  }
}

export function googleCalendarSelection(
  prefs: CalendarPreferences,
  connectionId: string
): string[] | undefined {
  if (!Object.hasOwn(prefs.googleCalendars, connectionId)) return undefined
  return prefs.googleCalendars[connectionId]
}

export function moveGoogleCalendarSelection(
  prefs: CalendarPreferences,
  fromId: string,
  toId: string
): CalendarPreferences {
  if (fromId === toId || !Object.hasOwn(prefs.googleCalendars, fromId)) return prefs
  const googleCalendars = { ...prefs.googleCalendars }
  const moved = googleCalendars[fromId] ?? []
  delete googleCalendars[fromId]
  if (!Object.hasOwn(googleCalendars, toId)) googleCalendars[toId] = moved
  return { ...prefs, googleCalendars }
}

export function dropGoogleCalendarSelection(
  prefs: CalendarPreferences,
  connectionId: string
): CalendarPreferences {
  if (!Object.hasOwn(prefs.googleCalendars, connectionId)) return prefs
  const googleCalendars = { ...prefs.googleCalendars }
  delete googleCalendars[connectionId]
  return { ...prefs, googleCalendars }
}

export async function readPreferences(dir: string): Promise<CalendarPreferences> {
  let raw: string
  try {
    raw = await readFile(join(dir, FILE_NAME), 'utf8')
  } catch {
    return emptyPreferences()
  }
  const parsed = parsePreferences(raw)
  if (!parsed) {
    const empty = emptyPreferences()
    await writePreferences(dir, empty)
    return empty
  }
  return parsed
}

export async function writePreferences(dir: string, prefs: CalendarPreferences): Promise<void> {
  await writeFile(join(dir, FILE_NAME), `${JSON.stringify(prefs, null, 2)}\n`, 'utf8')
}

function calendarMap(value: unknown): Record<string, string[]> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const map: Record<string, string[]> = {}
  for (const [key, entry] of Object.entries(value)) {
    const id = key.trim()
    const ids = calendarIdList(entry)
    if (!id || !ids) continue
    map[id] = ids
  }
  return map
}

function calendarIdList(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null
  const ids: string[] = []
  for (const item of value) {
    if (typeof item !== 'string') continue
    const trimmed = item.trim()
    if (!trimmed || ids.includes(trimmed)) continue
    ids.push(trimmed)
  }
  return ids
}
