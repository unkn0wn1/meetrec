import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const FILE_NAME = 'calendar.json'

export interface CalendarPreferences {
  uploadGoogle: boolean
  uploadMicrosoft: boolean
}

export function emptyPreferences(): CalendarPreferences {
  return {
    uploadGoogle: false,
    uploadMicrosoft: false
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
    uploadMicrosoft: record.uploadMicrosoft === true
  }
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
