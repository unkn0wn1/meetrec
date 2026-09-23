import { describe, expect, it } from 'vitest'
import { decodeSecretBag, encodeSecretBag, emptySecretBag } from './secret-codec'

describe('secret bag codec', () => {
  it('reads a legacy xAI-only payload', () => {
    expect(decodeSecretBag(JSON.stringify({ xaiApiKey: '  saved  ' }))).toEqual({
      xaiApiKey: 'saved',
      openaiApiKey: null,
      xaiOAuth: null,
      googleClientSecret: null,
      googleOAuth: null,
      microsoftOAuth: null
    })
  })

  it('round-trips keys and oauth tokens without dropping either', () => {
    const bag = {
      ...emptySecretBag(),
      xaiApiKey: 'xai',
      openaiApiKey: 'openai',
      xaiOAuth: {
        accessToken: 'access',
        refreshToken: 'refresh',
        expiresAt: 50,
        tokenType: 'Bearer'
      }
    }
    expect(decodeSecretBag(encodeSecretBag(bag))).toEqual(bag)
  })

  it('drops an oauth record that has no refresh token', () => {
    expect(
      decodeSecretBag(JSON.stringify({ xaiOAuth: { accessToken: 'only', refreshToken: '' } }))
        ?.xaiOAuth
    ).toBeNull()
  })

  it('round-trips a Google calendar token and drops one without a refresh token', () => {
    const bag = {
      ...emptySecretBag(),
      googleClientSecret: 'secret',
      googleOAuth: {
        accessToken: 'access',
        refreshToken: 'refresh',
        expiresAt: 80,
        tokenType: 'Bearer',
        scope: 'openid email',
        accountEmail: 'ada@example.com'
      },
      microsoftOAuth: {
        accessToken: 'ms-access',
        refreshToken: 'ms-refresh',
        expiresAt: 90,
        tokenType: 'Bearer',
        scope: 'Calendars.Read',
        accountEmail: 'ada@contoso.com'
      }
    }
    expect(decodeSecretBag(encodeSecretBag(bag))).toEqual(bag)
    expect(
      decodeSecretBag(JSON.stringify({ googleOAuth: { accessToken: 'only', refreshToken: '  ' } }))
        ?.googleOAuth
    ).toBeNull()
  })
})
