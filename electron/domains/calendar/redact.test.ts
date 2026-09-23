import { describe, expect, it } from 'vitest'
import { shortTokenError } from './redact'

describe('redact', () => {
  it('turns token JSON into a short error without the token strings', () => {
    const message = shortTokenError(
      {
        access_token: 'SECRET-ACCESS',
        refresh_token: 'SECRET-REFRESH',
        id_token: 'SECRET-ID',
        code: 'SECRET-CODE',
        client_secret: 'SECRET-CLIENT',
        error: 'invalid_grant',
        error_description: 'expired SECRET-ACCESS'
      },
      'fallback'
    )
    expect(message).toContain('invalid_grant')
    expect(message).not.toContain('SECRET-ACCESS')
    expect(message).not.toContain('SECRET-REFRESH')
    expect(message).not.toContain('SECRET-ID')
    expect(message).not.toContain('SECRET-CODE')
    expect(message).not.toContain('SECRET-CLIENT')
  })
})
