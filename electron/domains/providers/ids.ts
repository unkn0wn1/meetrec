export const PROVIDER_IDS = ['xai-oauth', 'xai-key', 'openai'] as const

export type ProviderId = (typeof PROVIDER_IDS)[number]

export const DEFAULT_PROVIDER: ProviderId = 'xai-key'

export function isProviderId(value: unknown): value is ProviderId {
  return typeof value === 'string' && (PROVIDER_IDS as readonly string[]).includes(value)
}

export function parseProviderId(value: unknown): ProviderId {
  return isProviderId(value) ? value : DEFAULT_PROVIDER
}
