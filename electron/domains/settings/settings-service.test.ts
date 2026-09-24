import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  OPENAI_CHAT_URL,
  OPENAI_MODELS_URL,
  OPENAI_STT_URL,
  XAI_CHAT_MODEL,
  XAI_CHAT_URL,
  XAI_MODELS_URL,
  XAI_STT_MODEL,
  XAI_STT_URL
} from '../providers/models'
import { readAppSettings } from './settings-file'
import { SettingsService } from './settings-service'
import { SecretStore, type SafeStorageLike } from './secret-store'

const plainStorage: SafeStorageLike = {
  isEncryptionAvailable: () => false,
  encryptString: (plain: string) => Buffer.from(plain),
  decryptString: (encrypted: Buffer) => encrypted.toString('utf8')
}

const roots: string[] = []

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

describe('SettingsService model catalog', () => {
  it('stores an OpenAI catalog from Test and keeps Voice when a later probe fails', async () => {
    const dir = tempDir()
    let now = 1_700_000_000_000
    const calls: string[] = []
    const routes: Record<string, { status: number; body: string }> = {
      [`GET ${OPENAI_MODELS_URL}`]: {
        status: 200,
        body: JSON.stringify({ data: [{ id: 'whisper-1' }, { id: 'gpt-4.1' }] })
      },
      [`POST ${OPENAI_STT_URL}`]: { status: 200, body: '{"text":""}' },
      [`POST ${OPENAI_CHAT_URL}`]: { status: 200, body: '{"choices":[]}' }
    }
    const service = createService(dir, routedFetch(routes, calls), () => now)
    await service.setOpenAiKey('oa-test-key')

    const status = await service.testProvider('openai')
    const card = status.cards.find((item) => item.id === 'openai')
    expect(card?.voiceModels).toEqual([{ id: 'whisper-1', label: 'whisper-1' }])
    expect(card?.aiModels).toEqual([{ id: 'gpt-4.1', label: 'gpt-4.1' }])
    expect(card?.voiceModel).toBe('whisper-1')
    expect(card?.aiModel).toBe('gpt-4.1')
    expect(card?.voiceProbe.state).toBe('pass')
    expect(card?.aiProbe.state).toBe('pass')

    const saved = await readAppSettings(dir)
    const voiceFetchedAt = new Date(now).toISOString()
    expect(saved.settings.modelCache.openai.voice).toEqual({
      ids: ['whisper-1'],
      fetchedAt: voiceFetchedAt
    })
    expect(saved.settings.modelCache.openai.ai.ids).toEqual(['gpt-4.1'])
    expect(saved.settings.models.openai).toEqual({ voice: 'whisper-1', ai: 'gpt-4.1' })

    await expect(service.setModel('openai', 'voice', 'gpt-4o-transcribe-diarize')).rejects.toThrow(
      'That model is not available.'
    )
    const selected = await service.setModel('openai', 'voice', 'whisper-1')
    expect(selected.cards.find((item) => item.id === 'openai')?.voiceModel).toBe('whisper-1')

    now += 60_000
    routes[`POST ${OPENAI_STT_URL}`] = { status: 401, body: 'secret-voice-body' }
    routes[`GET ${OPENAI_MODELS_URL}`] = {
      status: 200,
      body: JSON.stringify({ data: [{ id: 'gpt-4o-transcribe' }, { id: 'gpt-4o' }] })
    }
    const again = await service.testProvider('openai')
    const updated = again.cards.find((item) => item.id === 'openai')
    expect(updated?.voiceProbe.state).toBe('fail')
    expect(updated?.voiceProbe.message).not.toContain('secret-voice-body')
    expect(updated?.voiceModels).toEqual([{ id: 'whisper-1', label: 'whisper-1' }])
    expect(updated?.voiceModel).toBe('whisper-1')
    expect(updated?.aiModels).toEqual([{ id: 'gpt-4o', label: 'gpt-4o' }])
    expect(updated?.aiModel).toBe('gpt-4o')

    const reread = await readAppSettings(dir)
    expect(reread.settings.modelCache.openai.voice).toEqual({
      ids: ['whisper-1'],
      fetchedAt: voiceFetchedAt
    })
    expect(reread.settings.modelCache.openai.ai).toEqual({
      ids: ['gpt-4o'],
      fetchedAt: new Date(now).toISOString()
    })
    expect(calls.some((call) => call.startsWith(`GET ${OPENAI_MODELS_URL}`))).toBe(true)
  })

  it('seeds xAI Voice from the registry when the catalog is chat-only', async () => {
    const dir = tempDir()
    const token = 'xai-chat-only-token'
    const calls: string[] = []
    const routes: Record<string, { status: number; body: string }> = {
      [`GET ${XAI_MODELS_URL}`]: {
        status: 200,
        body: JSON.stringify({ data: [{ id: 'grok-4.5' }, { id: 'grok-4.7' }] })
      },
      [`POST ${XAI_STT_URL}`]: { status: 200, body: '{"text":""}' },
      [`POST ${XAI_CHAT_URL}`]: { status: 200, body: '{"choices":[]}' }
    }
    const service = createService(dir, routedFetch(routes, calls), () => 1_700_000_000_000)
    await service.setXaiKey(token)

    const status = await service.testProvider('xai-key')
    const card = status.cards.find((item) => item.id === 'xai-key')
    expect(card?.voiceModels).toEqual([
      { id: 'grok-voice-transcribe-2.0', label: 'grok-voice-transcribe-2.0' }
    ])
    expect(card?.aiModels).toEqual([
      { id: 'grok-4.5', label: 'grok-4.5' },
      { id: 'grok-4.7', label: 'grok-4.7' }
    ])
    expect(card?.voiceModel).toBe('grok-voice-transcribe-2.0')
    expect(card?.aiModel).toBe('grok-4.5')
    expect(card?.voiceProbe.state).toBe('pass')
    expect(card?.aiProbe.state).toBe('pass')

    const saved = await readAppSettings(dir)
    expect(saved.settings.modelCache['xai-key'].voice).toEqual({
      ids: ['grok-voice-transcribe-2.0'],
      fetchedAt: new Date(1_700_000_000_000).toISOString()
    })
    expect(saved.settings.modelCache['xai-key'].ai.ids).toEqual(['grok-4.5', 'grok-4.7'])
    expect(calls).toContain(`GET ${XAI_MODELS_URL}`)
  })

  it('seeds registry models when the xAI catalog request fails', async () => {
    const dir = tempDir()
    const token = 'xai-secret-token'
    const calls: string[] = []
    const routes: Record<string, { status: number; body: string }> = {
      [`GET ${XAI_MODELS_URL}`]: { status: 403, body: `rejected ${token}` },
      [`POST ${XAI_STT_URL}`]: { status: 200, body: '{"text":""}' },
      [`POST ${XAI_CHAT_URL}`]: { status: 200, body: '{"choices":[]}' }
    }
    const service = createService(dir, routedFetch(routes, calls), () => 1_700_000_000_000)
    await service.setXaiKey(token)

    const status = await service.testProvider('xai-key')
    const card = status.cards.find((item) => item.id === 'xai-key')
    expect(card?.voiceModels).toEqual([{ id: XAI_STT_MODEL, label: XAI_STT_MODEL }])
    expect(card?.aiModels).toEqual([{ id: XAI_CHAT_MODEL, label: XAI_CHAT_MODEL }])
    expect(card?.voiceModel).toBe(XAI_STT_MODEL)
    expect(card?.aiModel).toBe(XAI_CHAT_MODEL)
    expect(card?.voiceProbe.state).toBe('pass')
    expect(card?.aiProbe.state).toBe('pass')
    expect(JSON.stringify(status)).not.toContain(token)
    expect(card?.voiceProbe.message).not.toContain(token)
    expect(card?.aiProbe.message).not.toContain(token)

    const saved = await readAppSettings(dir)
    const fetchedAt = new Date(1_700_000_000_000).toISOString()
    expect(saved.settings.modelCache['xai-key'].voice).toEqual({
      ids: [XAI_STT_MODEL],
      fetchedAt
    })
    expect(saved.settings.modelCache['xai-key'].ai).toEqual({
      ids: [XAI_CHAT_MODEL],
      fetchedAt
    })
    expect(saved.settings.models['xai-key']).toEqual({
      voice: XAI_STT_MODEL,
      ai: XAI_CHAT_MODEL
    })
    expect(calls).toContain(`GET ${XAI_MODELS_URL}`)
    expect(calls).toContain(`POST ${XAI_STT_URL}`)
    expect(calls).toContain(`POST ${XAI_CHAT_URL}`)
  })
})

function tempDir(): string {
  const root = mkdtempSync(join(tmpdir(), 'meetrec-settings-'))
  roots.push(root)
  return root
}

function createService(dir: string, fetchImpl: typeof fetch, now: () => number): SettingsService {
  return new SettingsService({
    secrets: new SecretStore({
      userDataDir: () => dir,
      safeStorage: plainStorage,
      warn: () => undefined
    }),
    userDataDir: () => dir,
    env: {},
    fetchImpl,
    now
  })
}

function routedFetch(
  routes: Record<string, { status: number; body: string }>,
  calls: string[]
): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    const method = init?.method ?? 'GET'
    calls.push(`${method} ${url}`)
    const route = routes[`${method} ${url}`]
    if (!route) return new Response(`missing ${method} ${url}`, { status: 500 })
    return new Response(route.body, { status: route.status })
  }) as typeof fetch
}
