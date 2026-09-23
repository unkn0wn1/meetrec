import type { CalendarTokenSet } from '../settings/secret-codec'
import { REFRESH_SKEW_MS } from './constants'
import { readJson, shortTokenError } from './redact'

export function needsRefresh(tokens: CalendarTokenSet, now: number): boolean {
  if (!tokens.expiresAt) return true
  return now >= tokens.expiresAt - REFRESH_SKEW_MS
}

export function scopeIncludes(scope: string, needle: string): boolean {
  return scope.split(/\s+/).filter(Boolean).includes(needle)
}

export function parseCalendarToken(
  payload: unknown,
  now: number,
  requireRefresh: boolean
): CalendarTokenSet | null {
  if (!payload || typeof payload !== 'object') return null
  const record = payload as Record<string, unknown>
  const accessToken = text(record.access_token)
  const refreshToken = text(record.refresh_token)
  if (!accessToken) return null
  if (requireRefresh && !refreshToken) return null
  const expiresIn = positive(record.expires_in) ?? 3600
  return {
    accessToken,
    refreshToken: refreshToken ?? '',
    expiresAt: now + expiresIn * 1000,
    tokenType: text(record.token_type) ?? 'Bearer',
    scope: text(record.scope) ?? '',
    accountEmail: null
  }
}

export function mergeCalendarRefresh(
  previous: CalendarTokenSet,
  next: CalendarTokenSet
): CalendarTokenSet {
  return {
    accessToken: next.accessToken,
    refreshToken: next.refreshToken || previous.refreshToken,
    expiresAt: next.expiresAt || previous.expiresAt,
    tokenType: next.tokenType || previous.tokenType,
    scope: next.scope || previous.scope,
    accountEmail: next.accountEmail ?? previous.accountEmail
  }
}

export async function postToken(input: {
  url: string
  body: string
  fetchImpl?: typeof fetch
  now?: number
  requireRefresh: boolean
  fallback: string
}): Promise<CalendarTokenSet> {
  const fetchImpl = input.fetchImpl ?? fetch
  const response = await fetchImpl(input.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: input.body
  })
  const payload = await readJson(response)
  const tokens = parseCalendarToken(payload, input.now ?? Date.now(), input.requireRefresh)
  if (!response.ok || !tokens) {
    throw new Error(shortTokenError(payload, input.fallback))
  }
  return tokens
}

function text(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed || null
}

function positive(value: unknown): number | null {
  const number = typeof value === 'string' ? Number(value) : value
  if (typeof number !== 'number' || !Number.isFinite(number) || number <= 0) return null
  return number
}
