import type { ProviderRole } from '../../shared/ipc-contract'
import { OPENAI_MODELS_URL, XAI_MODELS_URL } from './models'
import { defaultModel, type ProviderFamily } from './registry'

export interface ListedModels {
  voice: string[]
  ai: string[]
}

const CHAT_EXCLUDED = [
  'embedding',
  'moderation',
  'dall-e',
  'tts',
  'realtime',
  'image',
  'audio',
  'video',
  'imagine'
]

export async function listProviderModels(input: {
  family: ProviderFamily
  token: string
  fetchImpl?: typeof fetch
}): Promise<ListedModels | null> {
  const token = input.token.trim()
  if (!token) return null
  const fetchImpl = input.fetchImpl ?? fetch
  const url = input.family === 'openai' ? OPENAI_MODELS_URL : XAI_MODELS_URL
  try {
    const response = await fetchImpl(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` }
    })
    if (!response.ok) {
      await response.text().catch(() => undefined)
      return null
    }
    const ids = parseModelIds(await response.text())
    if (!ids) return null
    return splitModelIds(input.family, ids)
  } catch {
    return null
  }
}

export function parseModelIds(raw: string): string[] | null {
  let payload: unknown
  try {
    payload = JSON.parse(raw)
  } catch {
    return null
  }
  if (!payload || typeof payload !== 'object') return null
  const record = payload as Record<string, unknown>
  const rows = Array.isArray(record.data)
    ? record.data
    : Array.isArray(record.models)
      ? record.models
      : null
  if (!rows) return null
  const ids: string[] = []
  const seen = new Set<string>()
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue
    const id = (row as { id?: unknown }).id
    if (typeof id !== 'string') continue
    const trimmed = id.trim()
    if (!trimmed || seen.has(trimmed)) continue
    seen.add(trimmed)
    ids.push(trimmed)
  }
  return ids
}

/** Voice vs AI is a best effort. A role stays empty when the other role matched. */
export function splitModelIds(family: ProviderFamily, ids: readonly string[]): ListedModels {
  const voiceHits = ids.filter((id) => isVoiceId(id))
  const aiHits = ids.filter((id) => isChatId(family, id))
  if (voiceHits.length === 0 && aiHits.length === 0 && ids.length > 0) {
    return { voice: [...ids], ai: [...ids] }
  }
  return {
    voice: withSeed(family, 'voice', voiceHits, ids),
    ai: withSeed(family, 'ai', aiHits, ids)
  }
}

function withSeed(
  family: ProviderFamily,
  role: ProviderRole,
  hits: string[],
  raw: readonly string[]
): string[] {
  const seed = defaultModel(family === 'openai' ? 'openai' : 'xai-key', role)
  if (!raw.includes(seed) || hits.includes(seed)) return hits
  return [...hits, seed]
}

function isVoiceId(id: string): boolean {
  const key = id.toLowerCase()
  if (key.includes('realtime') || key.includes('tts')) return false
  return (
    key.includes('transcribe') || key.includes('whisper') || key.includes('grok-voice-transcribe')
  )
}

function isChatId(family: ProviderFamily, id: string): boolean {
  if (isVoiceId(id) || isExcludedFromChat(id)) return false
  const key = id.toLowerCase()
  if (family === 'openai') return /^(gpt-|o\d|chatgpt-)/.test(key)
  return key.startsWith('grok-')
}

function isExcludedFromChat(id: string): boolean {
  const key = id.toLowerCase()
  return CHAT_EXCLUDED.some((word) => key.includes(word))
}
