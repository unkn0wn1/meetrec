import { afterEach, describe, expect, it } from 'vitest'
import {
  OAUTH_CLIENT_MISSING,
  publisherGoogleClientId,
  publisherGoogleClientSecret,
  publisherMicrosoftClientId
} from './oauth-clients'

const KEYS = [
  'MEETREC_GOOGLE_CLIENT_ID',
  'MEETREC_GOOGLE_CLIENT_SECRET',
  'MEETREC_MICROSOFT_CLIENT_ID'
] as const

const saved: Partial<Record<(typeof KEYS)[number], string | undefined>> = {}

afterEach(() => {
  for (const key of KEYS) {
    if (key in saved) {
      const previous = saved[key]
      if (previous === undefined) delete process.env[key]
      else process.env[key] = previous
      delete saved[key]
    }
  }
})

function setEnv(key: (typeof KEYS)[number], value: string | undefined): void {
  if (!(key in saved)) saved[key] = process.env[key]
  if (value === undefined) delete process.env[key]
  else process.env[key] = value
}

describe('publisher oauth clients', () => {
  it('reads trimmed env values and rejects blanks', () => {
    setEnv('MEETREC_GOOGLE_CLIENT_ID', '  google-id  ')
    setEnv('MEETREC_GOOGLE_CLIENT_SECRET', '  sekret  ')
    setEnv('MEETREC_MICROSOFT_CLIENT_ID', '  ms-id  ')
    expect(publisherGoogleClientId()).toBe('google-id')
    expect(publisherGoogleClientSecret()).toBe('sekret')
    expect(publisherMicrosoftClientId()).toBe('ms-id')
  })

  it('returns null when unset so Connect can show the maintainer error', () => {
    setEnv('MEETREC_GOOGLE_CLIENT_ID', undefined)
    setEnv('MEETREC_GOOGLE_CLIENT_SECRET', '   ')
    setEnv('MEETREC_MICROSOFT_CLIENT_ID', undefined)
    expect(publisherGoogleClientId()).toBeNull()
    expect(publisherGoogleClientSecret()).toBeNull()
    expect(publisherMicrosoftClientId()).toBeNull()
    expect(OAUTH_CLIENT_MISSING).toBe('This build has no OAuth client configured')
  })
})
