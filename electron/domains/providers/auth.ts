import { resolveXaiApiKey, xaiKeyStatus, type XaiKeySource } from '../settings/key-status'
import { DEFAULT_PROVIDER, type ProviderId } from './ids'

export interface StoredSecretsView {
  xaiApiKey: string | null
  openaiApiKey: string | null
  xaiOAuth: boolean
}

export interface ProviderAuthStatus {
  provider: ProviderId
  configured: boolean
  xaiKeySource: XaiKeySource
  openaiKeySource: 'settings' | 'env' | 'none'
  oauthPending: boolean
}

export interface ActiveAuth {
  provider: ProviderId
  token: string
}

const MISSING: Record<ProviderId, string> = {
  'xai-oauth': 'Sign in with xAI in Settings.',
  'xai-key': 'Add a working xAI API key in Settings.',
  openai: 'Add a working OpenAI API key in Settings.'
}

export function providerGateHint(provider: ProviderId): string {
  return MISSING[provider]
}

export function canUseProvider(configured: boolean, validated: boolean): boolean {
  return configured && validated
}

export function resolveOpenAiApiKey(
  saved: string | null,
  envValue: string | undefined
): string | null {
  return resolveXaiApiKey(saved, envValue)
}

export function providerAuthStatus(input: {
  provider: ProviderId
  secrets: StoredSecretsView
  env?: NodeJS.ProcessEnv
  oauthPending?: boolean
}): ProviderAuthStatus {
  const env = input.env ?? {}
  const xai = xaiKeyStatus(input.secrets.xaiApiKey, env.XAI_API_KEY)
  const openaiSaved = input.secrets.openaiApiKey?.trim() ?? ''
  const openaiEnv = env.OPENAI_API_KEY?.trim() ?? ''
  const openaiKeySource = openaiSaved ? 'settings' : openaiEnv ? 'env' : 'none'
  return {
    provider: input.provider,
    configured: isConfigured(
      input.provider,
      xai.hasXaiKey,
      openaiKeySource !== 'none',
      input.secrets.xaiOAuth
    ),
    xaiKeySource: xai.xaiKeySource,
    openaiKeySource,
    oauthPending: input.provider === 'xai-oauth' && Boolean(input.oauthPending)
  }
}

export function resolveActiveAuth(input: {
  provider: ProviderId
  secrets: StoredSecretsView
  env?: NodeJS.ProcessEnv
  oauthAccessToken?: string | null
}): ActiveAuth | null {
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

function isConfigured(
  provider: ProviderId,
  hasXaiKey: boolean,
  hasOpenAiKey: boolean,
  hasOAuth: boolean
): boolean {
  if (provider === 'xai-oauth') return hasOAuth
  if (provider === 'openai') return hasOpenAiKey
  return hasXaiKey
}

export function emptySecrets(): StoredSecretsView {
  return { xaiApiKey: null, openaiApiKey: null, xaiOAuth: false }
}

export { DEFAULT_PROVIDER }
