import { describe, expect, it } from 'vitest'
import {
  canUseRole,
  isProviderConfigured,
  providerGateHint,
  resolveActiveAuth,
  resolveOpenAiApiKey
} from './auth'
import { parseProviderId } from './ids'

const empty = { xaiApiKey: null, openaiApiKey: null, xaiOAuth: false }

describe('provider selection', () => {
  it('falls back to the xAI key when the stored id is unknown', () => {
    expect(parseProviderId('anthropic')).toBe('xai-key')
    expect(parseProviderId('openai')).toBe('openai')
    expect(parseProviderId(null)).toBe('xai-key')
  })

  it('marks a provider configured only from its own credentials', () => {
    const secrets = { xaiApiKey: 'xai', openaiApiKey: 'openai', xaiOAuth: true }
    expect(isProviderConfigured('xai-key', secrets)).toBe(true)
    expect(isProviderConfigured('openai', secrets)).toBe(true)
    expect(isProviderConfigured('xai-oauth', secrets)).toBe(true)
    expect(isProviderConfigured('openai', empty)).toBe(false)
    expect(isProviderConfigured('xai-oauth', { ...empty, xaiApiKey: 'xai' })).toBe(false)
    expect(isProviderConfigured('xai-key', { ...empty, xaiOAuth: true })).toBe(false)
  })

  it('does not fall across providers when resolving a bearer', () => {
    const secrets = { xaiApiKey: 'xai-saved', openaiApiKey: 'oa-saved', xaiOAuth: true }
    expect(
      resolveActiveAuth({ provider: 'openai', secrets, oauthAccessToken: 'oauth-token' })
    ).toEqual({ provider: 'openai', token: 'oa-saved' })
    expect(
      resolveActiveAuth({ provider: 'xai-key', secrets, oauthAccessToken: 'oauth-token' })
    ).toEqual({ provider: 'xai-key', token: 'xai-saved' })
    expect(
      resolveActiveAuth({ provider: 'xai-oauth', secrets, oauthAccessToken: '  bearer  ' })
    ).toEqual({
      provider: 'xai-oauth',
      token: 'bearer'
    })
    expect(resolveActiveAuth({ provider: 'xai-oauth', secrets: empty })).toBeNull()
  })

  it('prefers a saved OpenAI key over the environment', () => {
    expect(resolveOpenAiApiKey(' saved ', 'env')).toBe('saved')
    expect(resolveOpenAiApiKey(null, ' env ')).toBe('env')
    expect(resolveOpenAiApiKey('  ', '  ')).toBeNull()
    expect(isProviderConfigured('openai', empty, { OPENAI_API_KEY: 'from-env' })).toBe(true)
    expect(isProviderConfigured('openai', empty, {})).toBe(false)
  })

  it('gates a role on that provider being configured and live', () => {
    expect(canUseRole(true, true)).toBe(true)
    expect(canUseRole(true, false)).toBe(false)
    expect(canUseRole(false, true)).toBe(false)
    expect(providerGateHint('xai-oauth')).toContain('Sign in')
    expect(providerGateHint('openai')).toContain('OpenAI')
  })
})
