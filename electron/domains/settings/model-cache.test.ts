import { describe, expect, it } from 'vitest'
import {
  OPENAI_CHAT_MODEL,
  OPENAI_STT_MODEL,
  XAI_CHAT_MODEL,
  XAI_STT_MODEL
} from '../providers/models'
import { applyRoleList, mergeListedModels, roleIdsOrSeed } from './model-cache'
import { defaultAppSettings } from './settings-file'

const fetchedAt = '2026-09-23T18:00:00.000Z'

describe('applyRoleList', () => {
  it('updates Voice without changing AI', () => {
    const base = defaultAppSettings()
    const next = applyRoleList(base, 'xai-key', 'voice', ['grok-voice-transcribe-1.0'], fetchedAt)
    expect(next.modelCache['xai-key'].voice).toEqual({
      ids: ['grok-voice-transcribe-1.0'],
      fetchedAt
    })
    expect(next.models['xai-key'].voice).toBe('grok-voice-transcribe-1.0')
    expect(next.modelCache['xai-key'].ai).toEqual(base.modelCache['xai-key'].ai)
    expect(next.models['xai-key'].ai).toBe(XAI_CHAT_MODEL)
    expect(next.modelCache.openai).toEqual(base.modelCache.openai)
  })

  it('leaves settings alone for an empty list or a missing list', () => {
    const base = defaultAppSettings()
    expect(applyRoleList(base, 'openai', 'ai', [], fetchedAt)).toBe(base)
    expect(applyRoleList(base, 'openai', 'ai', null, fetchedAt)).toBe(base)
  })

  it('keeps the current id, else the seed in the list, else the first id', () => {
    const base = defaultAppSettings()
    const kept = applyRoleList(base, 'openai', 'ai', ['gpt-4.1', OPENAI_CHAT_MODEL], fetchedAt)
    expect(kept.models.openai.ai).toBe(OPENAI_CHAT_MODEL)

    const stored = defaultAppSettings()
    stored.models = {
      ...stored.models,
      openai: { ...stored.models.openai, ai: 'gpt-4o' }
    }
    const seeded = applyRoleList(stored, 'openai', 'ai', ['gpt-4.1', OPENAI_CHAT_MODEL], fetchedAt)
    expect(seeded.models.openai.ai).toBe(OPENAI_CHAT_MODEL)

    const first = applyRoleList(base, 'openai', 'ai', ['gpt-4.1', 'gpt-4o'], fetchedAt)
    expect(first.models.openai.ai).toBe('gpt-4.1')
    expect(first.models.openai.voice).toBe(base.models.openai.voice)
  })
})

describe('roleIdsOrSeed', () => {
  it('falls back to registry seeds when the catalog request failed', () => {
    expect(roleIdsOrSeed('xai-key', 'voice', null)).toEqual([XAI_STT_MODEL])
    expect(roleIdsOrSeed('xai-key', 'ai', null)).toEqual([XAI_CHAT_MODEL])
    expect(roleIdsOrSeed('xai-oauth', 'voice', null)).toEqual([XAI_STT_MODEL])
    expect(roleIdsOrSeed('openai', 'voice', null)).toEqual([OPENAI_STT_MODEL])
    expect(roleIdsOrSeed('openai', 'ai', null)).toEqual([OPENAI_CHAT_MODEL])
  })

  it('prefers live ids when the role matched', () => {
    expect(roleIdsOrSeed('openai', 'voice', { voice: ['whisper-1'], ai: ['gpt-4.1'] })).toEqual([
      'whisper-1'
    ])
    expect(roleIdsOrSeed('openai', 'ai', { voice: ['whisper-1'], ai: ['gpt-4.1'] })).toEqual([
      'gpt-4.1'
    ])
  })

  it('falls back to registry seeds when a role matched nothing', () => {
    expect(roleIdsOrSeed('xai-key', 'voice', { voice: [], ai: ['grok-4.5'] })).toEqual([
      XAI_STT_MODEL
    ])
    expect(roleIdsOrSeed('xai-oauth', 'voice', { voice: [], ai: ['grok-4.5'] })).toEqual([
      XAI_STT_MODEL
    ])
  })
})

describe('mergeListedModels', () => {
  it('skips a role whose probe did not pass', () => {
    const base = defaultAppSettings()
    const next = mergeListedModels(
      base,
      'openai',
      {
        voice: { state: 'fail', message: 'Voice check failed (401).' },
        ai: { state: 'pass', message: 'AI check passed.' }
      },
      { voice: ['whisper-1'], ai: ['gpt-4.1'] },
      fetchedAt
    )
    expect(next.modelCache.openai.voice.ids).toEqual([])
    expect(next.models.openai.voice).toBe(base.models.openai.voice)
    expect(next.modelCache.openai.ai.ids).toEqual(['gpt-4.1'])
    expect(next.models.openai.ai).toBe('gpt-4.1')
  })

  it('seeds both roles from the registry when the list request failed', () => {
    const base = defaultAppSettings()
    const probes = {
      voice: { state: 'pass' as const, message: 'Voice check passed.' },
      ai: { state: 'pass' as const, message: 'AI check passed.' }
    }
    const next = mergeListedModels(base, 'xai-key', probes, null, fetchedAt)
    expect(next).not.toBe(base)
    expect(next.modelCache['xai-key'].voice).toEqual({ ids: [XAI_STT_MODEL], fetchedAt })
    expect(next.modelCache['xai-key'].ai).toEqual({ ids: [XAI_CHAT_MODEL], fetchedAt })
    expect(next.models['xai-key'].voice).toBe(XAI_STT_MODEL)
    expect(next.models['xai-key'].ai).toBe(XAI_CHAT_MODEL)
    expect(next.modelCache.openai).toEqual(base.modelCache.openai)
  })

  it('seeds only the role whose probe passed when the list request failed', () => {
    const base = defaultAppSettings()
    const next = mergeListedModels(
      base,
      'openai',
      {
        voice: { state: 'fail', message: 'Voice check failed (401).' },
        ai: { state: 'pass', message: 'AI check passed.' }
      },
      null,
      fetchedAt
    )
    expect(next.modelCache.openai.voice).toEqual(base.modelCache.openai.voice)
    expect(next.models.openai.voice).toBe(base.models.openai.voice)
    expect(next.modelCache.openai.ai).toEqual({ ids: [OPENAI_CHAT_MODEL], fetchedAt })
    expect(next.models.openai.ai).toBe(OPENAI_CHAT_MODEL)
  })

  it('seeds Voice from the registry when the catalog omitted speech ids', () => {
    const base = defaultAppSettings()
    const next = mergeListedModels(
      base,
      'xai-key',
      {
        voice: { state: 'pass', message: 'Voice check passed.' },
        ai: { state: 'pass', message: 'AI check passed.' }
      },
      { voice: [], ai: ['grok-4.5', 'grok-4.7'] },
      fetchedAt
    )
    expect(next.modelCache['xai-key'].voice).toEqual({ ids: [XAI_STT_MODEL], fetchedAt })
    expect(next.models['xai-key'].voice).toBe(XAI_STT_MODEL)
    expect(next.modelCache['xai-key'].ai.ids).toEqual(['grok-4.5', 'grok-4.7'])
    expect(next.models['xai-key'].ai).toBe(XAI_CHAT_MODEL)
  })

  it('does not apply a role that is not available', () => {
    const base = defaultAppSettings()
    const next = mergeListedModels(
      base,
      'xai-oauth',
      {
        voice: { state: 'na', message: 'This provider does not transcribe.' },
        ai: { state: 'pass', message: 'AI check passed.' }
      },
      { voice: ['grok-voice-transcribe-2.0'], ai: ['grok-4.5', 'grok-4.7'] },
      fetchedAt
    )
    expect(next.modelCache['xai-oauth'].voice.ids).toEqual([])
    expect(next.modelCache['xai-oauth'].ai.ids).toEqual(['grok-4.5', 'grok-4.7'])
  })
})
