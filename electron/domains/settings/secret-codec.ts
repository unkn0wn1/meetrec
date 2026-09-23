export const SECRET_MAGIC = 'meetrec-secret-v1'
export const PLAIN_MAGIC = 'meetrec-plain-v1'

export interface OAuthTokenSet {
  accessToken: string
  refreshToken: string
  expiresAt: number
  tokenType: string
}

export interface SecretBag {
  xaiApiKey: string | null
  openaiApiKey: string | null
  xaiOAuth: OAuthTokenSet | null
}

export function emptySecretBag(): SecretBag {
  return { xaiApiKey: null, openaiApiKey: null, xaiOAuth: null }
}

export function encodeSecretBag(bag: SecretBag): string {
  return JSON.stringify({
    xaiApiKey: bag.xaiApiKey,
    openaiApiKey: bag.openaiApiKey,
    xaiOAuth: bag.xaiOAuth
  })
}

/** Accepts a legacy `{ xaiApiKey }` object and the current secret bag. */
export function decodeSecretBag(raw: string): SecretBag | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  if (!parsed || typeof parsed !== 'object') return null
  const record = parsed as Record<string, unknown>
  return {
    xaiApiKey: trimOrNull(record.xaiApiKey),
    openaiApiKey: trimOrNull(record.openaiApiKey),
    xaiOAuth: parseOAuth(record.xaiOAuth)
  }
}

export function encodeSecretPayload(key: string): string {
  return encodeSecretBag({ ...emptySecretBag(), xaiApiKey: key })
}

export function decodeSecretPayload(raw: string): string | null {
  return decodeSecretBag(raw)?.xaiApiKey ?? null
}

export function parseOAuth(value: unknown): OAuthTokenSet | null {
  if (!value || typeof value !== 'object') return null
  const record = value as Record<string, unknown>
  const accessToken = trimOrNull(record.accessToken)
  const refreshToken = trimOrNull(record.refreshToken)
  const expiresAt = typeof record.expiresAt === 'number' ? record.expiresAt : 0
  if (!accessToken || !refreshToken) return null
  const tokenType = typeof record.tokenType === 'string' ? record.tokenType : 'Bearer'
  return { accessToken, refreshToken, expiresAt, tokenType }
}

function trimOrNull(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed || null
}
