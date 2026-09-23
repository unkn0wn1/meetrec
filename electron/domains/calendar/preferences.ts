import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { CLIENT_ID_MAX } from './constants'

const FILE_NAME = 'calendar.json'

export interface CalendarPreferences {
  googleClientId: string | null
  microsoftClientId: string | null
  uploadGoogle: boolean
  uploadMicrosoft: boolean
}

export function emptyPreferences(): CalendarPreferences {
  return {
    googleClientId: null,
    microsoftClientId: null,
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
    googleClientId: cleanId(record.googleClientId),
    microsoftClientId: cleanId(record.microsoftClientId),
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

function cleanId(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed || trimmed.length > CLIENT_ID_MAX || /[\r\n]/.test(trimmed)) return null
  return trimmed
}
