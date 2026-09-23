import { resolveXaiApiKey, xaiKeyStatus, type XaiKeySource } from '../settings/key-status'
import type { ProviderId } from './ids'

export interface StoredSecretsView {
  xaiApiKey: string | null
  openaiApiKey: string | null
  xaiOAuth: boolean
}

export interface ProviderToken {
  provider: ProviderId
  token: string
}

export interface ActiveAuth extends ProviderToken {
  model: string
}

export interface ProviderKeySources {
  xaiKeySource: XaiKeySource
  openaiKeySource: 'settings' | 'env' | 'none'
}

const MISSING: Record<ProviderId, string> = {
  'xai-oauth': 'Sign in with xAI in Settings.',
  'xai-key': 'Add a working xAI API key in Settings.',
  openai: 'Add a working OpenAI API key in Settings.'
}

export function providerGateHint(provider: ProviderId): string {
  return MISSING[provider]
}

export function canUseRole(configured: boolean, liveOk: boolean): boolean {
  return configured && liveOk
}

export function resolveOpenAiApiKey(
  saved: string | null,
  envValue: string | undefined
): string | null {
  return resolveXaiApiKey(saved, envValue)
}

export function providerKeySources(
  secrets: StoredSecretsView,
  env?: NodeJS.ProcessEnv
): ProviderKeySources {
  const envVars = env ?? {}
  const xai = xaiKeyStatus(secrets.xaiApiKey, envVars.XAI_API_KEY)
  const openaiSaved = secrets.openaiApiKey?.trim() ?? ''
  const openaiEnv = envVars.OPENAI_API_KEY?.trim() ?? ''
  return {
    xaiKeySource: xai.xaiKeySource,
    openaiKeySource: openaiSaved ? 'settings' : openaiEnv ? 'env' : 'none'
  }
}

export function isProviderConfigured(
  provider: ProviderId,
  secrets: StoredSecretsView,
  env?: NodeJS.ProcessEnv
): boolean {
  const envVars = env ?? {}
  if (provider === 'xai-oauth') return secrets.xaiOAuth
  if (provider === 'openai') {
    return Boolean(resolveOpenAiApiKey(secrets.openaiApiKey, envVars.OPENAI_API_KEY))
  }
  return Boolean(resolveXaiApiKey(secrets.xaiApiKey, envVars.XAI_API_KEY))
}

export function resolveActiveAuth(input: {
  provider: ProviderId
  secrets: StoredSecretsView
  env?: NodeJS.ProcessEnv
  oauthAccessToken?: string | null
}): ProviderToken | null {
  const env = input.env ?? {}
  if (input.provider === 'xai-oauth') {
    const token = input.oauthAccessToken?.trim() ?? ''
    return token ? { provider: 'xai-oauth', token } : null
  }
  if (input.provider === 'openai') {
    const token = resolveOpenAiApiKey(input.secrets.openaiApiKey, env.OPENAI_API_KEY)
    return token ? { provider: 'openai', token } : null
  }
  const token = resolveXaiApiKey(input.secrets.xaiApiKey, env.XAI_API_KEY)
  return token ? { provider: 'xai-key', token } : null
}

export function emptySecrets(): StoredSecretsView {
  return { xaiApiKey: null, openaiApiKey: null, xaiOAuth: false }
}
