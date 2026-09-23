export const GOOGLE_AUTHORIZE_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
export const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
export const MICROSOFT_AUTHORIZE_URL =
  'https://login.microsoftonline.com/common/oauth2/v2.0/authorize'
export const MICROSOFT_TOKEN_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/token'

export function authorizeUrl(input: {
  provider: 'google' | 'microsoft'
  clientId: string
  redirectUri: string
  scope: string
  state: string
  codeChallenge: string
  /** Google only. Asks the browser to pick an account and still returns a refresh token. */
  selectAccount?: boolean
  loginHint?: string | null
}): string {
  const url = new URL(input.provider === 'google' ? GOOGLE_AUTHORIZE_URL : MICROSOFT_AUTHORIZE_URL)
  url.searchParams.set('client_id', input.clientId)
  url.searchParams.set('redirect_uri', input.redirectUri)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', input.scope)
  url.searchParams.set('state', input.state)
  url.searchParams.set('code_challenge', input.codeChallenge)
  url.searchParams.set('code_challenge_method', 'S256')
  if (input.provider === 'google') {
    url.searchParams.set('access_type', 'offline')
    url.searchParams.set('prompt', input.selectAccount ? 'consent select_account' : 'consent')
    url.searchParams.set('include_granted_scopes', 'true')
    if (input.loginHint) url.searchParams.set('login_hint', input.loginHint)
  } else {
    url.searchParams.set('prompt', 'select_account')
    url.searchParams.set('response_mode', 'query')
  }
  return url.toString()
}

export function tokenRequestBody(input: {
  code: string
  redirectUri: string
  clientId: string
  codeVerifier: string
  clientSecret?: string | null
}): string {
  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    code: input.code,
    redirect_uri: input.redirectUri,
    client_id: input.clientId,
    code_verifier: input.codeVerifier
  })
  if (input.clientSecret) params.set('client_secret', input.clientSecret)
  return params.toString()
}

export function refreshRequestBody(input: {
  refreshToken: string
  clientId: string
  clientSecret?: string | null
}): string {
  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: input.refreshToken,
    client_id: input.clientId
  })
  if (input.clientSecret) params.set('client_secret', input.clientSecret)
  return params.toString()
}
