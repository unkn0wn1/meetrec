import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  OPENAI_CHAT_MODEL,
  OPENAI_STT_MODEL,
  XAI_CHAT_MODEL,
  XAI_STT_MODEL
} from '../providers/models'
import { defaultAppSettings, parseAppSettings, readSilenceAutoStop } from './settings-file'

const xaiModels = { voice: XAI_STT_MODEL, ai: XAI_CHAT_MODEL }
const openaiModels = { voice: OPENAI_STT_MODEL, ai: OPENAI_CHAT_MODEL }

describe('app settings', () => {
  it('migrates a legacy provider to both voice and AI defaults', () => {
    const openai = parseAppSettings('{"provider":"openai"}')
    expect(openai.legacy).toBe(true)
    expect(openai.settings.voiceProviderId).toBe('openai')
    expect(openai.settings.aiProviderId).toBe('openai')
    expect(openai.settings.models.openai).toEqual(openaiModels)
    expect(openai.settings.models['xai-key']).toEqual(xaiModels)

    const oauth = parseAppSettings('{"provider":"xai-oauth"}')
    expect(oauth.settings.voiceProviderId).toBe('xai-oauth')
    expect(oauth.settings.aiProviderId).toBe('xai-oauth')
  })

  it('falls back to the xAI key when the legacy provider is missing or unknown', () => {
    for (const raw of ['{"provider":"anthropic"}', 'not-json', '{}']) {
      const parsed = parseAppSettings(raw)
      expect(parsed.legacy).toBe(true)
      expect(parsed.settings.voiceProviderId).toBe('xai-key')
      expect(parsed.settings.aiProviderId).toBe('xai-key')
    }
  })

  it('keeps a new shape and ignores a leftover provider field', () => {
    const parsed = parseAppSettings(
      JSON.stringify({
        provider: 'xai-oauth',
        voiceProviderId: 'openai',
        aiProviderId: 'xai-key',
        models: defaultAppSettings().models
      })
    )
    expect(parsed.legacy).toBe(false)
    expect(parsed.settings.voiceProviderId).toBe('openai')
    expect(parsed.settings.aiProviderId).toBe('xai-key')
    expect(parsed.settings.models).toEqual(defaultAppSettings().models)
  })

  it('replaces an unknown model and an unknown role id on their own', () => {
    const models = defaultAppSettings().models
    models.openai.voice = 'whisper-1'
    const badModel = parseAppSettings(
      JSON.stringify({
        voiceProviderId: 'openai',
        aiProviderId: 'openai',
        models
      })
    )
    expect(badModel.settings.models.openai.voice).toBe(OPENAI_STT_MODEL)
    expect(badModel.legacy).toBe(true)

    const badRole = parseAppSettings(
      JSON.stringify({ voiceProviderId: 'nope', aiProviderId: 'openai' })
    )
    expect(badRole.settings.voiceProviderId).toBe('xai-key')
    expect(badRole.settings.aiProviderId).toBe('openai')
    expect(badRole.legacy).toBe(true)
  })

  it('treats a missing model cache as empty without marking the file legacy', () => {
    const parsed = parseAppSettings(
      JSON.stringify({
        voiceProviderId: 'openai',
        aiProviderId: 'xai-key',
        models: defaultAppSettings().models
      })
    )
    expect(parsed.legacy).toBe(false)
    expect(parsed.settings.modelCache['xai-key'].voice).toEqual({ ids: [], fetchedAt: null })
    expect(parsed.settings.modelCache.openai.ai).toEqual({ ids: [], fetchedAt: null })
  })

  it('keeps a cached catalog and its fetchedAt', () => {
    const settings = defaultAppSettings()
    settings.modelCache.openai.voice = {
      ids: ['whisper-1'],
      fetchedAt: '2026-09-23T18:00:00.000Z'
    }
    settings.models.openai.voice = 'whisper-1'
    const parsed = parseAppSettings(JSON.stringify(settings))
    expect(parsed.legacy).toBe(false)
    expect(parsed.settings.modelCache.openai.voice).toEqual({
      ids: ['whisper-1'],
      fetchedAt: '2026-09-23T18:00:00.000Z'
    })
    expect(parsed.settings.models.openai.voice).toBe('whisper-1')
  })

  it('drops blank, duplicate, and non-string cache ids', () => {
    const parsed = parseAppSettings(
      JSON.stringify({
        voiceProviderId: 'xai-key',
        aiProviderId: 'xai-key',
        models: defaultAppSettings().models,
        modelCache: {
          ...defaultAppSettings().modelCache,
          openai: {
            voice: {
              ids: ['whisper-1', '', 'whisper-1', 3, '  gpt-4o-transcribe '],
              fetchedAt: '  '
            },
            ai: { ids: 'nope', fetchedAt: 5 }
          }
        }
      })
    )
    expect(parsed.settings.modelCache.openai.voice.ids).toEqual(['whisper-1', 'gpt-4o-transcribe'])
    expect(parsed.settings.modelCache.openai.voice.fetchedAt).toBeNull()
    expect(parsed.settings.modelCache.openai.ai).toEqual({ ids: [], fetchedAt: null })
    expect(parsed.legacy).toBe(true)
  })

  it('coerces a stored id against the cached catalog', () => {
    const models = defaultAppSettings().models
    const cache = defaultAppSettings().modelCache
    models.openai.ai = 'gpt-4o'
    cache.openai.ai = {
      ids: ['gpt-4.1', OPENAI_CHAT_MODEL],
      fetchedAt: '2026-09-23T18:00:00.000Z'
    }
    const seeded = parseAppSettings(
      JSON.stringify({
        voiceProviderId: 'openai',
        aiProviderId: 'openai',
        models,
        modelCache: cache
      })
    )
    expect(seeded.settings.models.openai.ai).toBe(OPENAI_CHAT_MODEL)
    expect(seeded.legacy).toBe(true)

    models.openai.ai = OPENAI_CHAT_MODEL
    cache.openai.ai = { ids: ['gpt-4.1', 'gpt-4o'], fetchedAt: '2026-09-23T18:00:00.000Z' }
    const first = parseAppSettings(
      JSON.stringify({
        voiceProviderId: 'openai',
        aiProviderId: 'openai',
        models,
        modelCache: cache
      })
    )
    expect(first.settings.models.openai.ai).toBe('gpt-4.1')
    expect(first.legacy).toBe(true)
  })

  it('defaults destination and auto-record, and keeps an explicit choice', () => {
    const missing = parseAppSettings(
      JSON.stringify({
        voiceProviderId: 'openai',
        aiProviderId: 'xai-key',
        models: defaultAppSettings().models
      })
    )
    expect(missing.legacy).toBe(false)
    expect(missing.settings.destination).toBe('local')
    expect(missing.settings.autoRecord).toBe(false)

    const chosen = parseAppSettings(
      JSON.stringify({
        ...defaultAppSettings(),
        destination: 'microsoft',
        autoRecord: true
      })
    )
    expect(chosen.legacy).toBe(false)
    expect(chosen.settings.destination).toBe('microsoft')
    expect(chosen.settings.autoRecord).toBe(true)

    const unknown = parseAppSettings(
      JSON.stringify({
        voiceProviderId: 'xai-key',
        aiProviderId: 'xai-key',
        models: defaultAppSettings().models,
        destination: 'dropbox',
        autoRecord: 'yes'
      })
    )
    expect(unknown.settings.destination).toBe('local')
    expect(unknown.settings.autoRecord).toBe(false)
    expect(unknown.legacy).toBe(true)
  })

  it('defaults silence auto-stop for a legacy file and clamps the threshold', () => {
    const missing = parseAppSettings(
      JSON.stringify({
        voiceProviderId: 'openai',
        aiProviderId: 'xai-key',
        models: defaultAppSettings().models
      })
    )
    expect(missing.legacy).toBe(false)
    expect(missing.settings.silenceAutoStop).toBe(false)
    expect(missing.settings.silenceAutoStopSeconds).toBe(120)

    const chosen = parseAppSettings(
      JSON.stringify({
        ...defaultAppSettings(),
        silenceAutoStop: true,
        silenceAutoStopSeconds: 90
      })
    )
    expect(chosen.legacy).toBe(false)
    expect(chosen.settings.silenceAutoStop).toBe(true)
    expect(chosen.settings.silenceAutoStopSeconds).toBe(90)

    const clamped = parseAppSettings(
      JSON.stringify({
        voiceProviderId: 'xai-key',
        aiProviderId: 'xai-key',
        models: defaultAppSettings().models,
        silenceAutoStop: 'yes',
        silenceAutoStopSeconds: 10
      })
    )
    expect(clamped.legacy).toBe(true)
    expect(clamped.settings.silenceAutoStop).toBe(false)
    expect(clamped.settings.silenceAutoStopSeconds).toBe(30)

    const high = parseAppSettings(
      JSON.stringify({
        ...defaultAppSettings(),
        silenceAutoStopSeconds: 90.2
      })
    )
    expect(high.legacy).toBe(true)
    expect(high.settings.silenceAutoStop).toBe(false)
    expect(high.settings.silenceAutoStopSeconds).toBe(90)

    const maxed = parseAppSettings(
      JSON.stringify({
        ...defaultAppSettings(),
        silenceAutoStop: true,
        silenceAutoStopSeconds: 9000
      })
    )
    expect(maxed.legacy).toBe(true)
    expect(maxed.settings.silenceAutoStop).toBe(true)
    expect(maxed.settings.silenceAutoStopSeconds).toBe(600)

    const dir = mkdtempSync(join(tmpdir(), 'meetrec-silence-'))
    try {
      expect(readSilenceAutoStop(dir)).toEqual({ enabled: false, seconds: 120 })
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
