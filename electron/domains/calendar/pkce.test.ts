import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { codeChallenge, codeVerifier, oauthState } from './pkce'

describe('pkce', () => {
  it('builds a 43-character unpadded verifier and a matching challenge', () => {
    const verifier = codeVerifier()
    expect(verifier).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(codeChallenge(verifier)).toBe(createHash('sha256').update(verifier).digest('base64url'))
  })

  it('matches the RFC 7636 SHA-256 challenge vector', () => {
    const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk'
    expect(codeChallenge(verifier)).toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM')
  })

  it('does not repeat state', () => {
    expect(oauthState()).not.toBe(oauthState())
  })
})
