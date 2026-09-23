import {
  XAI_OAUTH_CLIENT_ID,
  XAI_OAUTH_DEVICE_URL,
  XAI_OAUTH_GRANT_DEVICE,
  XAI_OAUTH_SCOPE,
  XAI_OAUTH_TOKEN_URL,
  XAI_REFRESH_SKEW_MS
} from './xai-oauth-constants'
import type { OAuthTokenSet } from '../settings/secret-codec'

export interface DeviceCodeStart {
  deviceCode: string
  userCode: string
  verificationUrl: string
  intervalSec: number
  expiresAt: number
}

export type DevicePoll =
  | { kind: 'pending'; intervalSec: number }
  | { kind: 'slow_down'; intervalSec: number }
  | { kind: 'tokens'; tokens: OAuthTokenSet }
  | { kind: 'denied'; message: string }
  | { kind: 'expired'; message: string }

export function deviceCodeBody(): string {
  return new URLSearchParams({
    client_id: XAI_OAUTH_CLIENT_ID,
    scope: XAI_OAUTH_SCOPE
  }).toString()
}

export function tokenPollBody(deviceCode: string): string {
  return new URLSearchParams({
    grant_type: XAI_OAUTH_GRANT_DEVICE,
    device_code: deviceCode,
    client_id: XAI_OAUTH_CLIENT_ID
  }).toString()
}

export function refreshBody(refreshToken: string): string {
  return new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: XAI_OAUTH_CLIENT_ID
  }).toString()
}

export function parseDeviceStart(payload: unknown, now = Date.now()): DeviceCodeStart | null {
  if (!payload || typeof payload !== 'object') return null
  const record = payload as Record<string, unknown>
  const deviceCode = stringField(record, 'device_code')
  const userCode = stringField(record, 'user_code')
  const verificationUrl =
    stringField(record, 'verification_uri_complete') || stringField(record, 'verification_uri')
  if (!deviceCode || !userCode || !verificationUrl) return null
  const intervalSec = positiveNumber(record.interval) ?? 5
  const expiresIn = positiveNumber(record.expires_in) ?? 600
  return {
    deviceCode,
    userCode,
    verificationUrl,
    intervalSec,
    expiresAt: now + expiresIn * 1000
  }
}

export function parseDevicePoll(
  payload: unknown,
  intervalSec: number,
  now = Date.now()
): DevicePoll {
  if (!payload || typeof payload !== 'object') {
    return { kind: 'denied', message: 'xAI sign-in returned an unexpected response.' }
  }
  const record = payload as Record<string, unknown>
  const tokens = tokensFrom(record, now, true)
  if (tokens) return { kind: 'tokens', tokens }
  const error = stringField(record, 'error')
  if (error === 'authorization_pending') return { kind: 'pending', intervalSec }
  if (error === 'slow_down') return { kind: 'slow_down', intervalSec: intervalSec + 5 }
  if (error === 'expired_token') {
    return { kind: 'expired', message: 'The sign-in code expired. Start again.' }
  }
  if (error === 'access_denied') {
    return { kind: 'denied', message: 'xAI sign-in was denied.' }
  }
  const description = stringField(record, 'error_description')
  return { kind: 'denied', message: description || 'xAI sign-in failed.' }
}

export function parseTokenResponse(
  payload: unknown,
  now = Date.now(),
  requireRefresh = false
): OAuthTokenSet | null {
  if (!payload || typeof payload !== 'object') return null
  return tokensFrom(payload as Record<string, unknown>, now, requireRefresh)
}

export function accessNeedsRefresh(tokens: OAuthTokenSet, now = Date.now()): boolean {
  if (!tokens.expiresAt) return false
  return now >= tokens.expiresAt - XAI_REFRESH_SKEW_MS
}

export function mergeRefresh(previous: OAuthTokenSet, next: OAuthTokenSet): OAuthTokenSet {
  return {
    accessToken: next.accessToken,
    refreshToken: next.refreshToken || previous.refreshToken,
    expiresAt: next.expiresAt || previous.expiresAt,
    tokenType: next.tokenType || previous.tokenType
  }
}

export async function requestDeviceCode(input: {
  fetchImpl?: typeof fetch
  now?: number
}): Promise<DeviceCodeStart> {
  const fetchImpl = input.fetchImpl ?? fetch
  const response = await fetchImpl(XAI_OAUTH_DEVICE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: deviceCodeBody()
  })
  const payload = await readJson(response)
  const start = parseDeviceStart(payload, input.now ?? Date.now())
  if (!response.ok || !start) {
    throw new Error('Could not start xAI sign-in.')
  }
  return start
}

export async function pollDeviceCode(input: {
  deviceCode: string
  intervalSec: number
  fetchImpl?: typeof fetch
  now?: number
}): Promise<DevicePoll> {
  const fetchImpl = input.fetchImpl ?? fetch
  const response = await fetchImpl(XAI_OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: tokenPollBody(input.deviceCode)
  })
  const payload = await readJson(response)
  if (response.ok) {
    const tokens = parseTokenResponse(payload, input.now ?? Date.now(), true)
    if (!tokens) return { kind: 'denied', message: 'xAI sign-in did not return tokens.' }
    return { kind: 'tokens', tokens }
  }
  return parseDevicePoll(payload, input.intervalSec, input.now ?? Date.now())
}

export async function refreshAccessToken(input: {
  tokens: OAuthTokenSet
  fetchImpl?: typeof fetch
  now?: number
}): Promise<OAuthTokenSet> {
  const fetchImpl = input.fetchImpl ?? fetch
  const response = await fetchImpl(XAI_OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: refreshBody(input.tokens.refreshToken)
  })
  const payload = await readJson(response)
  const next = parseTokenResponse(payload, input.now ?? Date.now())
  if (!response.ok || !next) {
    throw new Error('xAI sign-in expired. Sign in again in Settings.')
  }
  return mergeRefresh(input.tokens, next)
}

function tokensFrom(
  record: Record<string, unknown>,
  now: number,
  requireRefresh: boolean
): OAuthTokenSet | null {
  const accessToken = stringField(record, 'access_token')
  const refreshToken = stringField(record, 'refresh_token') ?? ''
  if (!accessToken) return null
  if (requireRefresh && !refreshToken) return null
  const expiresIn = positiveNumber(record.expires_in) ?? 3600
  return {
    accessToken,
    refreshToken,
    expiresAt: now + expiresIn * 1000,
    tokenType: stringField(record, 'token_type') || 'Bearer'
  }
}

function stringField(record: Record<string, unknown>, key: string): string | null {
  const value = record[key]
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed || null
}

function positiveNumber(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null
  return value
}

async function readJson(response: Response): Promise<unknown> {
  const raw = await response.text()
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}
