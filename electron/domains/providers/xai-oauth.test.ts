import { describe, expect, it } from 'vitest'
import {
  accessNeedsRefresh,
  deviceCodeBody,
  mergeRefresh,
  parseDevicePoll,
  parseDeviceStart,
  parseTokenResponse,
  refreshBody,
  tokenPollBody
} from './xai-oauth'
import {
  XAI_OAUTH_CLIENT_ID,
  XAI_OAUTH_GRANT_DEVICE,
  XAI_REFRESH_SKEW_MS
} from './xai-oauth-constants'

describe('xAI device-code helpers', () => {
  it('builds the public client device and token bodies', () => {
    expect(deviceCodeBody()).toContain(`client_id=${XAI_OAUTH_CLIENT_ID}`)
    expect(deviceCodeBody()).toContain('grok-cli%3Aaccess')
    expect(tokenPollBody('dev-1')).toContain(
      `grant_type=${encodeURIComponent(XAI_OAUTH_GRANT_DEVICE)}`
    )
    expect(refreshBody('refresh-1')).toContain('grant_type=refresh_token')
  })

  it('parses a device start and prefers the complete verification URL', () => {
    const start = parseDeviceStart(
      {
        device_code: 'dev',
        user_code: 'ABCD-EF',
        verification_uri: 'https://accounts.x.ai/oauth2/device',
        verification_uri_complete: 'https://accounts.x.ai/oauth2/device?user_code=ABCD-EF',
        interval: 5,
        expires_in: 600
      },
      1_000
    )
    expect(start).toEqual({
      deviceCode: 'dev',
      userCode: 'ABCD-EF',
      verificationUrl: 'https://accounts.x.ai/oauth2/device?user_code=ABCD-EF',
      intervalSec: 5,
      expiresAt: 601_000
    })
  })

  it('keeps polling on authorization_pending and slows down when asked', () => {
    expect(parseDevicePoll({ error: 'authorization_pending' }, 5).kind).toBe('pending')
    expect(parseDevicePoll({ error: 'slow_down' }, 5)).toEqual({
      kind: 'slow_down',
      intervalSec: 10
    })
    expect(parseDevicePoll({ error: 'expired_token' }, 5).kind).toBe('expired')
    expect(parseDevicePoll({ error: 'access_denied' }, 5).kind).toBe('denied')
  })

  it('requires a refresh token on the device grant and refreshes before expiry skew', () => {
    expect(parseTokenResponse({ access_token: 'a', expires_in: 10 }, 0, true)).toBeNull()
    const tokens = parseTokenResponse(
      { access_token: 'a', refresh_token: 'r', expires_in: 100, token_type: 'Bearer' },
      1_000,
      true
    )
    expect(tokens?.expiresAt).toBe(101_000)
    expect(accessNeedsRefresh(tokens!, 101_000 - XAI_REFRESH_SKEW_MS)).toBe(true)
    expect(accessNeedsRefresh(tokens!, 101_000 - XAI_REFRESH_SKEW_MS - 1)).toBe(false)
    const merged = mergeRefresh(tokens!, {
      accessToken: 'next',
      refreshToken: '',
      expiresAt: 200_000,
      tokenType: 'Bearer'
    })
    expect(merged.refreshToken).toBe('r')
    expect(merged.accessToken).toBe('next')
  })
})
