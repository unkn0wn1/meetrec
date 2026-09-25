import { readFileSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { parseDestination, type RecordingDestination } from '../../shared/destination'
import {
  SILENCE_AUTO_STOP_SECONDS_DEFAULT,
  SILENCE_AUTO_STOP_SECONDS_MAX,
  SILENCE_AUTO_STOP_SECONDS_MIN
} from '../../shared/ipc-contract'
import {
  DEFAULT_PROVIDER,
  PROVIDER_IDS,
  isProviderId,
  parseProviderId,
  type ProviderId
} from '../providers/ids'
import { coerceModel } from '../providers/registry'
import {
  defaultMeetingSearchPrefs,
  parseMeetingSearchPrefs,
  type MeetingSearchPrefs
} from './meeting-search-prefs'

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
  destination: RecordingDestination
  autoRecord: boolean
  silenceAutoStop: boolean
  silenceAutoStopSeconds: number
  meetingSearch: MeetingSearchPrefs
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
    modelCache: emptyModelCache(),
    destination: 'local',
    autoRecord: false,
    silenceAutoStop: false,
    silenceAutoStopSeconds: SILENCE_AUTO_STOP_SECONDS_DEFAULT,
    meetingSearch: defaultMeetingSearchPrefs()
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
  const meeting = parseMeetingSearchPrefs(record.meetingSearch)
  if (!hasBoth) {
    const provider = isProviderId(record.provider) ? record.provider : DEFAULT_PROVIDER
    const general = generalPrefs(record)
    return {
      settings: {
        voiceProviderId: provider,
        aiProviderId: provider,
        models: parseModels(record.models, modelCache),
        modelCache,
        destination: general.destination,
        autoRecord: general.autoRecord,
        silenceAutoStop: general.silenceAutoStop,
        silenceAutoStopSeconds: general.silenceAutoStopSeconds,
        meetingSearch: meeting.prefs
      },
      legacy: true
    }
  }
  const general = generalPrefs(record)
  const settings: AppSettings = {
    voiceProviderId: parseProviderId(record.voiceProviderId),
    aiProviderId: parseProviderId(record.aiProviderId),
    models: parseModels(record.models, modelCache),
    modelCache,
    destination: general.destination,
    autoRecord: general.autoRecord,
    silenceAutoStop: general.silenceAutoStop,
    silenceAutoStopSeconds: general.silenceAutoStopSeconds,
    meetingSearch: meeting.prefs
  }
  const legacy =
    general.legacy ||
    meeting.legacy ||
    record.voiceProviderId !== settings.voiceProviderId ||
    record.aiProviderId !== settings.aiProviderId ||
    !modelsMatch(record.models, settings.models) ||
    cacheIsLegacy(record.modelCache, settings.modelCache)
  return { settings, legacy }
}

function generalPrefs(record: Record<string, unknown>): {
  destination: RecordingDestination
  autoRecord: boolean
  silenceAutoStop: boolean
  silenceAutoStopSeconds: number
  legacy: boolean
} {
  const destination = parseDestination(record.destination)
  const autoRecord = record.autoRecord === true
  const silence = silencePrefs(record)
  return {
    destination,
    autoRecord,
    silenceAutoStop: silence.enabled,
    silenceAutoStopSeconds: silence.seconds,
    legacy:
      (record.destination !== undefined && record.destination !== destination) ||
      (record.autoRecord !== undefined && typeof record.autoRecord !== 'boolean') ||
      silence.legacy
  }
}

export function clampSilenceSeconds(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return SILENCE_AUTO_STOP_SECONDS_DEFAULT
  const rounded = Math.round(value)
  if (rounded < SILENCE_AUTO_STOP_SECONDS_MIN) return SILENCE_AUTO_STOP_SECONDS_MIN
  if (rounded > SILENCE_AUTO_STOP_SECONDS_MAX) return SILENCE_AUTO_STOP_SECONDS_MAX
  return rounded
}

function silencePrefs(record: Record<string, unknown>): {
  enabled: boolean
  seconds: number
  legacy: boolean
} {
  const enabledRaw = record.silenceAutoStop
  const secondsRaw = record.silenceAutoStopSeconds
  const seconds = clampSilenceSeconds(secondsRaw)
  const secondsLegacy = secondsRaw !== undefined && !silenceSecondsMatch(secondsRaw, seconds)
  return {
    enabled: enabledRaw === true,
    seconds,
    legacy: (enabledRaw !== undefined && typeof enabledRaw !== 'boolean') || secondsLegacy
  }
}

function silenceSecondsMatch(value: unknown, seconds: number): boolean {
  return typeof value === 'number' && Number.isFinite(value) && value === seconds
}

export function readSilenceAutoStop(userDataDir: string): {
  enabled: boolean
  seconds: number
} {
  try {
    const settings = parseAppSettings(readFileSync(settingsFilePath(userDataDir), 'utf8')).settings
    return { enabled: settings.silenceAutoStop, seconds: settings.silenceAutoStopSeconds }
  } catch {
    return { enabled: false, seconds: SILENCE_AUTO_STOP_SECONDS_DEFAULT }
  }
}

export function readAutoRecordFlag(userDataDir: string): boolean {
  try {
    return parseAppSettings(readFileSync(settingsFilePath(userDataDir), 'utf8')).settings.autoRecord
  } catch {
    return false
  }
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
