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

export interface RoleModelCache {
  ids: string[]
  fetchedAt: string | null
}

export interface ProviderModelCache {
  voice: RoleModelCache
  ai: RoleModelCache
}

export interface AppSettings {
  voiceProviderId: ProviderId
  aiProviderId: ProviderId
  models: Record<ProviderId, ProviderModels>
  modelCache: Record<ProviderId, ProviderModelCache>
}

export interface ParsedAppSettings {
  settings: AppSettings
  legacy: boolean
}

export function defaultAppSettings(): AppSettings {
  return {
    voiceProviderId: DEFAULT_PROVIDER,
    aiProviderId: DEFAULT_PROVIDER,
    models: defaultModels(),
    modelCache: emptyModelCache()
  }
}

function emptyModelCache(): Record<ProviderId, ProviderModelCache> {
  const cache = {} as Record<ProviderId, ProviderModelCache>
  for (const id of PROVIDER_IDS) {
    cache[id] = { voice: emptyRoleCache(), ai: emptyRoleCache() }
  }
  return cache
}

function emptyRoleCache(): RoleModelCache {
  return { ids: [], fetchedAt: null }
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
  const modelCache = parseModelCache(record.modelCache)
  if (!hasBoth) {
    const provider = isProviderId(record.provider) ? record.provider : DEFAULT_PROVIDER
    return {
      settings: {
        voiceProviderId: provider,
        aiProviderId: provider,
        models: parseModels(record.models, modelCache),
        modelCache
      },
      legacy: true
    }
  }
  const settings: AppSettings = {
    voiceProviderId: parseProviderId(record.voiceProviderId),
    aiProviderId: parseProviderId(record.aiProviderId),
    models: parseModels(record.models, modelCache),
    modelCache
  }
  const legacy =
    record.voiceProviderId !== settings.voiceProviderId ||
    record.aiProviderId !== settings.aiProviderId ||
    !modelsMatch(record.models, settings.models) ||
    cacheIsLegacy(record.modelCache, settings.modelCache)
  return { settings, legacy }
}

function parseModels(
  value: unknown,
  cache: Record<ProviderId, ProviderModelCache>
): Record<ProviderId, ProviderModels> {
  const source = value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
  const models = {} as Record<ProviderId, ProviderModels>
  for (const id of PROVIDER_IDS) {
    const row = source[id]
    const record = row && typeof row === 'object' ? (row as Record<string, unknown>) : {}
    models[id] = {
      voice: coerceModel(id, 'voice', record.voice, cache[id].voice.ids),
      ai: coerceModel(id, 'ai', record.ai, cache[id].ai.ids)
    }
  }
  return models
}

function parseModelCache(value: unknown): Record<ProviderId, ProviderModelCache> {
  const source = value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
  const cache = {} as Record<ProviderId, ProviderModelCache>
  for (const id of PROVIDER_IDS) {
    const row = source[id]
    const record = row && typeof row === 'object' ? (row as Record<string, unknown>) : {}
    cache[id] = {
      voice: parseRoleCache(record.voice),
      ai: parseRoleCache(record.ai)
    }
  }
  return cache
}

function parseRoleCache(value: unknown): RoleModelCache {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return emptyRoleCache()
  const record = value as Record<string, unknown>
  const fetched = typeof record.fetchedAt === 'string' ? record.fetchedAt.trim() : ''
  return {
    ids: parseIdList(record.ids),
    fetchedAt: fetched || null
  }
}

function parseIdList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const ids: string[] = []
  const seen = new Set<string>()
  for (const item of value) {
    if (typeof item !== 'string') continue
    const trimmed = item.trim()
    if (!trimmed || seen.has(trimmed)) continue
    seen.add(trimmed)
    ids.push(trimmed)
  }
  return ids
}

function cacheIsLegacy(value: unknown, cache: Record<ProviderId, ProviderModelCache>): boolean {
  if (value === undefined) return false
  if (!value || typeof value !== 'object') return true
  const source = value as Record<string, unknown>
  for (const id of PROVIDER_IDS) {
    const row = source[id]
    if (!row || typeof row !== 'object') return true
    const record = row as Record<string, unknown>
    if (!roleCacheMatches(record.voice, cache[id].voice)) return true
    if (!roleCacheMatches(record.ai, cache[id].ai)) return true
  }
  return false
}

function roleCacheMatches(value: unknown, role: RoleModelCache): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const record = value as Record<string, unknown>
  if (record.fetchedAt !== role.fetchedAt) return false
  if (!Array.isArray(record.ids) || record.ids.length !== role.ids.length) return false
  return record.ids.every((id, index) => id === role.ids[index])
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
