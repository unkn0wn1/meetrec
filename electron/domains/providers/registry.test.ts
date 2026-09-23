import { describe, expect, it } from 'vitest'
import { PROVIDER_IDS } from './ids'
import { OPENAI_CHAT_MODEL, OPENAI_STT_MODEL, XAI_CHAT_MODEL, XAI_STT_MODEL } from './models'
import {
  PROVIDER_REGISTRY,
  defaultModel,
  isAllowedModel,
  registryMatchesIds,
  supportsRole
} from './registry'

describe('provider registry', () => {
  it('lists the three current providers in settings order', () => {
    expect(PROVIDER_IDS).toEqual(['xai-oauth', 'xai-key', 'openai'])
    expect(registryMatchesIds()).toBe(true)
    expect(PROVIDER_REGISTRY.map((row) => row.id)).toEqual([...PROVIDER_IDS])
  })

  it('gives every provider both roles and an allowlisted default model', () => {
    for (const row of PROVIDER_REGISTRY) {
      expect(row.supportsVoice).toBe(true)
      expect(row.supportsAi).toBe(true)
      expect(supportsRole(row.id, 'voice')).toBe(true)
      expect(supportsRole(row.id, 'ai')).toBe(true)
      expect(isAllowedModel(row.id, 'voice', defaultModel(row.id, 'voice'))).toBe(true)
      expect(isAllowedModel(row.id, 'ai', defaultModel(row.id, 'ai'))).toBe(true)
    }
    expect(defaultModel('xai-key', 'voice')).toBe(XAI_STT_MODEL)
    expect(defaultModel('xai-oauth', 'ai')).toBe(XAI_CHAT_MODEL)
    expect(defaultModel('openai', 'voice')).toBe(OPENAI_STT_MODEL)
    expect(defaultModel('openai', 'ai')).toBe(OPENAI_CHAT_MODEL)
  })

  it('rejects a model from the other family', () => {
    expect(isAllowedModel('openai', 'voice', XAI_STT_MODEL)).toBe(false)
    expect(isAllowedModel('xai-key', 'ai', OPENAI_CHAT_MODEL)).toBe(false)
    expect(isAllowedModel('openai', 'ai', 'claude-3')).toBe(false)
  })
})
