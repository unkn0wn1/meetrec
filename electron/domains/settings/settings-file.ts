import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { DEFAULT_PROVIDER, parseProviderId, type ProviderId } from '../providers/ids'

export interface AppSettings {
  provider: ProviderId
}

export function defaultAppSettings(): AppSettings {
  return { provider: DEFAULT_PROVIDER }
}

export function settingsFilePath(userDataDir: string): string {
  return join(userDataDir, 'settings.json')
}

export function parseAppSettings(raw: string): AppSettings {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return defaultAppSettings()
  }
  if (!parsed || typeof parsed !== 'object') return defaultAppSettings()
  return { provider: parseProviderId((parsed as { provider?: unknown }).provider) }
}

export async function readAppSettings(userDataDir: string): Promise<AppSettings> {
  try {
    return parseAppSettings(await readFile(settingsFilePath(userDataDir), 'utf8'))
  } catch {
    return defaultAppSettings()
  }
}

export async function writeAppSettings(userDataDir: string, settings: AppSettings): Promise<void> {
  const body = `${JSON.stringify({ provider: parseProviderId(settings.provider) }, null, 2)}\n`
  await writeFile(settingsFilePath(userDataDir), body, 'utf8')
}
