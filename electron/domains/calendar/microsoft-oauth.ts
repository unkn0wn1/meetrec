import type { CalendarTokenSet } from '../settings/secret-codec'
import { MICROSOFT_TOKEN_URL, refreshRequestBody, tokenRequestBody } from './oauth-request'
import { readJson } from './redact'
import { mergeCalendarRefresh, postToken } from './tokens'

const PROFILE_URL = 'https://graph.microsoft.com/v1.0/me?$select=id,mail,userPrincipalName'

export async function exchangeMicrosoftCode(input: {
  code: string
  redirectUri: string
  clientId: string
  codeVerifier: string
  fetchImpl?: typeof fetch
  now?: number
}): Promise<CalendarTokenSet> {
  return postToken({
    url: MICROSOFT_TOKEN_URL,
    body: tokenRequestBody(input),
    fetchImpl: input.fetchImpl,
    now: input.now,
    requireRefresh: true,
    fallback: 'Microsoft sign-in did not return tokens.'
  })
}

export async function refreshMicrosoftTokens(input: {
  tokens: CalendarTokenSet
  clientId: string
  fetchImpl?: typeof fetch
  now?: number
}): Promise<CalendarTokenSet> {
  const next = await postToken({
    url: MICROSOFT_TOKEN_URL,
    body: refreshRequestBody({
      refreshToken: input.tokens.refreshToken,
      clientId: input.clientId
    }),
    fetchImpl: input.fetchImpl,
    now: input.now,
    requireRefresh: false,
    fallback: 'Connect again'
  })
  return mergeCalendarRefresh(input.tokens, next)
}

export async function fetchMicrosoftProfile(
  accessToken: string,
  fetchImpl: typeof fetch = fetch
): Promise<{ id: string | null; email: string | null }> {
  const response = await fetchImpl(PROFILE_URL, {
    headers: { Authorization: `Bearer ${accessToken}` }
  })
  const payload = await readJson(response)
  if (!response.ok || !payload || typeof payload !== 'object') return { id: null, email: null }
  const record = payload as Record<string, unknown>
  return {
    id: text(record.id),
    email: text(record.mail) ?? text(record.userPrincipalName)
  }
}

export async function fetchMicrosoftEmail(
  accessToken: string,
  fetchImpl: typeof fetch = fetch
): Promise<string | null> {
  return (await fetchMicrosoftProfile(accessToken, fetchImpl)).email
}

function text(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed || null
}
