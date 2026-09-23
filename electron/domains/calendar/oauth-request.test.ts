import { describe, expect, it } from 'vitest'
import { authorizeUrl, refreshRequestBody, tokenRequestBody } from './oauth-request'
import { mergeCalendarRefresh } from './tokens'

const shared = {
  clientId: 'client',
  redirectUri: 'http://127.0.0.1:9/callback',
  scope: 'openid email',
  state: 'state-1',
  codeChallenge: 'challenge'
}

describe('oauth requests', () => {
  it('builds a Google authorize URL with PKCE and offline consent', () => {
    const url = new URL(authorizeUrl({ ...shared, provider: 'google' }))
    expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth')
    expect(url.searchParams.get('response_type')).toBe('code')
    expect(url.searchParams.get('code_challenge')).toBe('challenge')
    expect(url.searchParams.get('code_challenge_method')).toBe('S256')
    expect(url.searchParams.get('access_type')).toBe('offline')
    expect(url.searchParams.get('prompt')).toBe('consent')
    expect(url.searchParams.get('include_granted_scopes')).toBe('true')
    expect(url.searchParams.get('login_hint')).toBeNull()
    expect(url.searchParams.get('state')).toBe('state-1')
  })

  it('asks Google to pick an account and can hint a Drive reconnect', () => {
    const picked = new URL(authorizeUrl({ ...shared, provider: 'google', selectAccount: true }))
    expect(picked.searchParams.get('prompt')).toBe('consent select_account')
    const drive = new URL(
      authorizeUrl({
        ...shared,
        provider: 'google',
        selectAccount: false,
        loginHint: 'ada@example.com'
      })
    )
    expect(drive.searchParams.get('prompt')).toBe('consent')
    expect(drive.searchParams.get('login_hint')).toBe('ada@example.com')
  })

  it('builds a Microsoft authorize URL with account selection', () => {
    const url = new URL(
      authorizeUrl({ ...shared, provider: 'microsoft', redirectUri: 'http://localhost:9/callback' })
    )
    expect(url.origin + url.pathname).toBe(
      'https://login.microsoftonline.com/common/oauth2/v2.0/authorize'
    )
    expect(url.searchParams.get('code_challenge_method')).toBe('S256')
    expect(url.searchParams.get('prompt')).toBe('select_account')
    expect(url.searchParams.get('response_mode')).toBe('query')
    expect(url.searchParams.get('access_type')).toBeNull()
  })

  it('includes client_secret in the token body only when one is provided', () => {
    const without = tokenRequestBody({
      code: 'code',
      redirectUri: shared.redirectUri,
      clientId: 'client',
      codeVerifier: 'verifier'
    })
    expect(without).not.toContain('client_secret')
    const withSecret = tokenRequestBody({
      code: 'code',
      redirectUri: shared.redirectUri,
      clientId: 'client',
      codeVerifier: 'verifier',
      clientSecret: 'sekret'
    })
    expect(withSecret).toContain('client_secret=sekret')
  })

  it('form-encodes the refresh body and keeps a previous refresh token', () => {
    const body = refreshRequestBody({ refreshToken: 'refresh/token', clientId: 'client' })
    expect(body).toContain('grant_type=refresh_token')
    expect(body).toContain('refresh_token=refresh%2Ftoken')
    expect(body).not.toContain('client_secret')
    const merged = mergeCalendarRefresh(
      {
        accessToken: 'old',
        refreshToken: 'keep',
        expiresAt: 10,
        tokenType: 'Bearer',
        scope: 'openid',
        accountEmail: 'ada@example.com'
      },
      {
        accessToken: 'new',
        refreshToken: '',
        expiresAt: 20,
        tokenType: 'Bearer',
        scope: '',
        accountEmail: null
      }
    )
    expect(merged.accessToken).toBe('new')
    expect(merged.refreshToken).toBe('keep')
    expect(merged.scope).toBe('openid')
    expect(merged.accountEmail).toBe('ada@example.com')
  })
})
