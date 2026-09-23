/** Publisher OAuth clients. Set at CI/release or in local `.env`. Never paste in Settings. */

export const OAUTH_CLIENT_MISSING = 'This build has no OAuth client configured'

const CLIENT_ID_MAX = 200
const SECRET_MAX = 500

/**
 * Static `process.env.NAME` so electron-vite can inject values at build
 * (see electron.vite.config.ts). Do not invent placeholder ids.
 */
export function publisherGoogleClientId(): string | null {
  return cleanId(process.env.MEETREC_GOOGLE_CLIENT_ID)
}

export function publisherGoogleClientSecret(): string | null {
  return cleanSecret(process.env.MEETREC_GOOGLE_CLIENT_SECRET)
}

export function publisherMicrosoftClientId(): string | null {
  return cleanId(process.env.MEETREC_MICROSOFT_CLIENT_ID)
}

function cleanId(value: string | undefined): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed || trimmed.length > CLIENT_ID_MAX || /[\r\n]/.test(trimmed)) return null
  return trimmed
}

function cleanSecret(value: string | undefined): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed || trimmed.length > SECRET_MAX || /[\r\n]/.test(trimmed)) return null
  return trimmed
}
