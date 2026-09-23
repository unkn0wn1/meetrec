import { describe, expect, it } from 'vitest'
import {
  canUseProvider,
  providerAuthStatus,
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

  it('marks only the active provider as configured', () => {
    const secrets = { xaiApiKey: 'xai', openaiApiKey: 'openai', xaiOAuth: true }
    expect(providerAuthStatus({ provider: 'xai-key', secrets }).configured).toBe(true)
    expect(providerAuthStatus({ provider: 'openai', secrets }).configured).toBe(true)
    expect(providerAuthStatus({ provider: 'xai-oauth', secrets }).configured).toBe(true)
    expect(providerAuthStatus({ provider: 'openai', secrets: empty }).configured).toBe(false)
    expect(
      providerAuthStatus({ provider: 'xai-oauth', secrets: { ...empty, xaiApiKey: 'xai' } })
        .configured
    ).toBe(false)
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
    const status = providerAuthStatus({
      provider: 'openai',
      secrets: empty,
      env: { OPENAI_API_KEY: 'from-env' }
    })
    expect(status.configured).toBe(true)
    expect(status.openaiKeySource).toBe('env')
  })

  it('gates actions on the active provider being configured and validated', () => {
    expect(canUseProvider(true, true)).toBe(true)
    expect(canUseProvider(true, false)).toBe(false)
    expect(canUseProvider(false, true)).toBe(false)
    expect(providerGateHint('xai-oauth')).toContain('Sign in')
    expect(providerGateHint('openai')).toContain('OpenAI')
  })
})
