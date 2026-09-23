import { describe, expect, it } from 'vitest'
import { decodeSecretBag, encodeSecretBag, emptySecretBag } from './secret-codec'

describe('secret bag codec', () => {
  it('reads a legacy xAI-only payload', () => {
    expect(decodeSecretBag(JSON.stringify({ xaiApiKey: '  saved  ' }))).toEqual({
      xaiApiKey: 'saved',
      openaiApiKey: null,
      xaiOAuth: null,
      googleClientSecret: null,
      googleConnections: [],
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

  it('round-trips Google connections and does not write the legacy field', () => {
    const bag = {
      ...emptySecretBag(),
      googleClientSecret: 'secret',
      googleConnections: [
        {
          id: 'gid',
          accessToken: 'access',
          refreshToken: 'refresh',
          expiresAt: 80,
          tokenType: 'Bearer',
          scope: 'openid email',
          accountEmail: 'ada@example.com'
        }
      ],
      microsoftOAuth: {
        accessToken: 'ms-access',
        refreshToken: 'ms-refresh',
        expiresAt: 90,
        tokenType: 'Bearer',
        scope: 'Calendars.Read',
        accountEmail: 'ada@contoso.com'
      }
    }
    const encoded = encodeSecretBag(bag)
    expect(encoded).not.toContain('googleOAuth')
    expect(decodeSecretBag(encoded)).toEqual(bag)
  })

  it('migrates a legacy googleOAuth token into one connection', () => {
    const decoded = decodeSecretBag(
      JSON.stringify({
        googleOAuth: {
          accessToken: 'access',
          refreshToken: 'refresh',
          expiresAt: 80,
          tokenType: 'Bearer',
          scope: 'openid email',
          accountEmail: 'Ada@Example.com'
        }
      })
    )
    expect(decoded?.googleConnections).toEqual([
      {
        id: 'email:ada@example.com',
        accessToken: 'access',
        refreshToken: 'refresh',
        expiresAt: 80,
        tokenType: 'Bearer',
        scope: 'openid email',
        accountEmail: 'Ada@Example.com'
      }
    ])
    expect(
      decodeSecretBag(JSON.stringify({ googleOAuth: { accessToken: 'only', refreshToken: '  ' } }))
        ?.googleConnections
    ).toEqual([])
    expect(
      decodeSecretBag(
        JSON.stringify({
          googleConnections: [
            {
              id: 'ok',
              accessToken: 'a',
              refreshToken: 'r',
              expiresAt: 1,
              tokenType: 'Bearer',
              scope: '',
              accountEmail: null
            },
            { id: '', accessToken: 'a', refreshToken: 'r' },
            { id: 'nope', accessToken: 'a', refreshToken: ' ' }
          ]
        })
      )?.googleConnections
    ).toEqual([
      {
        id: 'ok',
        accessToken: 'a',
        refreshToken: 'r',
        expiresAt: 1,
        tokenType: 'Bearer',
        scope: '',
        accountEmail: null
      }
    ])
  })
})
