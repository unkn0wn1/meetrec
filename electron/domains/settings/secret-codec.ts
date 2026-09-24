export const SECRET_MAGIC = 'meetrec-secret-v1'
export const PLAIN_MAGIC = 'meetrec-plain-v1'

export interface OAuthTokenSet {
  accessToken: string
  refreshToken: string
  expiresAt: number
  tokenType: string
}

export interface CalendarTokenSet {
  accessToken: string
  refreshToken: string
  expiresAt: number
  tokenType: string
  scope: string
  accountEmail: string | null
}

/** One signed-in Google account. `id` is the Google user id when known. */
export interface GoogleConnection extends CalendarTokenSet {
  id: string
}

/** One signed-in Microsoft account. `id` is the Graph user id when known. */
export interface MicrosoftConnection extends CalendarTokenSet {
  id: string
}

export interface SecretBag {
  xaiApiKey: string | null
  openaiApiKey: string | null
  xaiOAuth: OAuthTokenSet | null
  googleClientSecret: string | null
  googleConnections: GoogleConnection[]
  microsoftConnections: MicrosoftConnection[]
}

export function emptySecretBag(): SecretBag {
  return {
    xaiApiKey: null,
    openaiApiKey: null,
    xaiOAuth: null,
    googleClientSecret: null,
    googleConnections: [],
    microsoftConnections: []
  }
}

export function encodeSecretBag(bag: SecretBag): string {
  return JSON.stringify({
    xaiApiKey: bag.xaiApiKey,
    openaiApiKey: bag.openaiApiKey,
    xaiOAuth: bag.xaiOAuth,
    googleClientSecret: bag.googleClientSecret,
    googleConnections: bag.googleConnections,
    microsoftConnections: bag.microsoftConnections
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
    xaiOAuth: parseOAuth(record.xaiOAuth),
    googleClientSecret: trimOrNull(record.googleClientSecret),
    googleConnections: parseGoogleConnections(record),
    microsoftConnections: parseMicrosoftConnections(record)
  }
}

/** Legacy single-account files used `email:<address>` until userinfo returned an id. */
export function legacyGoogleConnectionId(email: string | null): string {
  if (!email) return 'legacy'
  return `email:${email.toLowerCase()}`
}

/** Legacy Microsoft files used `email:<address>` until Graph returned a user id. */
export function legacyMicrosoftConnectionId(email: string | null): string {
  if (!email) return 'legacy'
  return `email:${email.toLowerCase()}`
}

function parseGoogleConnections(record: Record<string, unknown>): GoogleConnection[] {
  if (Array.isArray(record.googleConnections)) {
    const connections: GoogleConnection[] = []
    for (const item of record.googleConnections) {
      const parsed = parseGoogleConnection(item)
      if (parsed) connections.push(parsed)
    }
    return connections
  }
  const legacy = parseCalendarToken(record.googleOAuth)
  if (!legacy) return []
  return [{ ...legacy, id: legacyGoogleConnectionId(legacy.accountEmail) }]
}

function parseGoogleConnection(value: unknown): GoogleConnection | null {
  const token = parseCalendarToken(value)
  if (!token || !value || typeof value !== 'object') return null
  const id = trimOrNull((value as Record<string, unknown>).id)
  if (!id) return null
  return { ...token, id }
}

/**
 * A missing `microsoftConnections` array promotes `microsoftOAuth`.
 * A present array is authoritative, including when it is empty.
 */
function parseMicrosoftConnections(record: Record<string, unknown>): MicrosoftConnection[] {
  if (Array.isArray(record.microsoftConnections)) {
    const connections: MicrosoftConnection[] = []
    for (const item of record.microsoftConnections) {
      const parsed = parseMicrosoftConnection(item)
      if (parsed) connections.push(parsed)
    }
    return connections
  }
  const legacy = parseCalendarToken(record.microsoftOAuth)
  if (!legacy) return []
  return [{ ...legacy, id: legacyMicrosoftConnectionId(legacy.accountEmail) }]
}

function parseMicrosoftConnection(value: unknown): MicrosoftConnection | null {
  const token = parseCalendarToken(value)
  if (!token || !value || typeof value !== 'object') return null
  const id = trimOrNull((value as Record<string, unknown>).id)
  if (!id) return null
  return { ...token, id }
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

export function parseCalendarToken(value: unknown): CalendarTokenSet | null {
  if (!value || typeof value !== 'object') return null
  const record = value as Record<string, unknown>
  const accessToken = trimOrNull(record.accessToken)
  const refreshToken = trimOrNull(record.refreshToken)
  if (!accessToken || !refreshToken) return null
  const expiresAt = typeof record.expiresAt === 'number' ? record.expiresAt : 0
  const tokenType = typeof record.tokenType === 'string' ? record.tokenType : 'Bearer'
  const scope = typeof record.scope === 'string' ? record.scope : ''
  return {
    accessToken,
    refreshToken,
    expiresAt,
    tokenType,
    scope,
    accountEmail: trimOrNull(record.accountEmail)
  }
}

function trimOrNull(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed || null
}
