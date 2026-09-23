import type { CalendarTokenSet } from '../settings/secret-codec'
import { GOOGLE_TOKEN_URL, refreshRequestBody, tokenRequestBody } from './oauth-request'
import { readJson } from './redact'
import { mergeCalendarRefresh, postToken } from './tokens'

const USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo'
const REVOKE_URL = 'https://oauth2.googleapis.com/revoke'

export async function exchangeGoogleCode(input: {
  code: string
  redirectUri: string
  clientId: string
  codeVerifier: string
  clientSecret?: string | null
  fetchImpl?: typeof fetch
  now?: number
}): Promise<CalendarTokenSet> {
  return postToken({
    url: GOOGLE_TOKEN_URL,
    body: tokenRequestBody(input),
    fetchImpl: input.fetchImpl,
    now: input.now,
    requireRefresh: true,
    fallback: 'Google sign-in did not return tokens.'
  })
}

export async function refreshGoogleTokens(input: {
  tokens: CalendarTokenSet
  clientId: string
  clientSecret?: string | null
  fetchImpl?: typeof fetch
  now?: number
}): Promise<CalendarTokenSet> {
  const next = await postToken({
    url: GOOGLE_TOKEN_URL,
    body: refreshRequestBody({
      refreshToken: input.tokens.refreshToken,
      clientId: input.clientId,
      clientSecret: input.clientSecret
    }),
    fetchImpl: input.fetchImpl,
    now: input.now,
    requireRefresh: false,
    fallback: 'Connect again'
  })
  return mergeCalendarRefresh(input.tokens, next)
}

export async function fetchGoogleEmail(
  accessToken: string,
  fetchImpl: typeof fetch = fetch
): Promise<string | null> {
  const response = await fetchImpl(USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` }
  })
  const payload = await readJson(response)
  if (!response.ok || !payload || typeof payload !== 'object') return null
  const email = (payload as Record<string, unknown>).email
  if (typeof email !== 'string') return null
  const trimmed = email.trim()
  return trimmed || null
}

export async function revokeGoogleRefresh(
  refreshToken: string,
  fetchImpl: typeof fetch = fetch
): Promise<void> {
  try {
    await fetchImpl(REVOKE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token: refreshToken }).toString()
    })
  } catch {
    // Revoke is best-effort. Local sign-out still clears the slot.
  }
}
