import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import {
  DEFAULT_PROVIDER,
  PROVIDER_IDS,
  isProviderId,
  parseProviderId,
  type ProviderId
} from '../providers/ids'
import { coerceModel } from '../providers/registry'

export interface ProviderModels {
  voice: string
  ai: string
}

export interface AppSettings {
  voiceProviderId: ProviderId
  aiProviderId: ProviderId
  models: Record<ProviderId, ProviderModels>
}

export interface ParsedAppSettings {
  settings: AppSettings
  legacy: boolean
}

export function defaultAppSettings(): AppSettings {
  return {
    voiceProviderId: DEFAULT_PROVIDER,
    aiProviderId: DEFAULT_PROVIDER,
    models: defaultModels()
  }
}

function defaultModels(): Record<ProviderId, ProviderModels> {
  const models = {} as Record<ProviderId, ProviderModels>
  for (const id of PROVIDER_IDS) {
    models[id] = {
      voice: coerceModel(id, 'voice', undefined),
      ai: coerceModel(id, 'ai', undefined)
    }
  }
  return models
}

export function parseAppSettings(raw: string): ParsedAppSettings {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { settings: defaultAppSettings(), legacy: true }
  }
  if (!parsed || typeof parsed !== 'object') {
    return { settings: defaultAppSettings(), legacy: true }
  }
  const record = parsed as Record<string, unknown>
  const hasBoth = 'voiceProviderId' in record && 'aiProviderId' in record
  if (!hasBoth) {
    const provider = isProviderId(record.provider) ? record.provider : DEFAULT_PROVIDER
    return {
      settings: {
        voiceProviderId: provider,
        aiProviderId: provider,
        models: parseModels(record.models)
      },
      legacy: true
    }
  }
  const settings: AppSettings = {
    voiceProviderId: parseProviderId(record.voiceProviderId),
    aiProviderId: parseProviderId(record.aiProviderId),
    models: parseModels(record.models)
  }
  const legacy =
    record.voiceProviderId !== settings.voiceProviderId ||
    record.aiProviderId !== settings.aiProviderId ||
    !modelsMatch(record.models, settings.models)
  return { settings, legacy }
}

function parseModels(value: unknown): Record<ProviderId, ProviderModels> {
  const source = value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
  const models = {} as Record<ProviderId, ProviderModels>
  for (const id of PROVIDER_IDS) {
    const row = source[id]
    const record = row && typeof row === 'object' ? (row as Record<string, unknown>) : {}
    models[id] = {
      voice: coerceModel(id, 'voice', record.voice),
      ai: coerceModel(id, 'ai', record.ai)
    }
  }
  return models
}

function modelsMatch(value: unknown, models: Record<ProviderId, ProviderModels>): boolean {
  if (!value || typeof value !== 'object') return false
  const source = value as Record<string, unknown>
  for (const id of PROVIDER_IDS) {
    const row = source[id]
    if (!row || typeof row !== 'object') return false
    const record = row as Record<string, unknown>
    if (record.voice !== models[id].voice || record.ai !== models[id].ai) return false
  }
  return true
}

export function settingsFilePath(userDataDir: string): string {
  return join(userDataDir, 'settings.json')
}

export async function readAppSettings(userDataDir: string): Promise<ParsedAppSettings> {
  try {
    return parseAppSettings(await readFile(settingsFilePath(userDataDir), 'utf8'))
  } catch {
    return { settings: defaultAppSettings(), legacy: false }
  }
}

export function normalizeSettings(settings: AppSettings): AppSettings {
  return parseAppSettings(JSON.stringify(settings)).settings
}

export async function writeAppSettings(userDataDir: string, settings: AppSettings): Promise<void> {
  const body = `${JSON.stringify(normalizeSettings(settings), null, 2)}\n`
  await writeFile(settingsFilePath(userDataDir), body, 'utf8')
}
