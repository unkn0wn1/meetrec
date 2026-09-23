import { describe, expect, it } from 'vitest'
import {
  OPENAI_CHAT_MODEL,
  OPENAI_STT_MODEL,
  XAI_CHAT_MODEL,
  XAI_STT_MODEL
} from '../providers/models'
import { defaultAppSettings, parseAppSettings } from './settings-file'

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
})
