import type { CalendarPreferences } from './preferences'

export function readEnv(name: string): string | null {
  const value = process.env[name]
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed || trimmed.length > 500 || /[\r\n]/.test(trimmed)) return null
  return trimmed
}

export function effectiveGoogleClientId(prefs: CalendarPreferences): string | null {
  return prefs.googleClientId ?? readEnv('MEETREC_GOOGLE_CLIENT_ID')
}

export function effectiveMicrosoftClientId(prefs: CalendarPreferences): string | null {
  return prefs.microsoftClientId ?? readEnv('MEETREC_MICROSOFT_CLIENT_ID')
}

/** Saved secret wins. The environment is used only when nothing is saved. */
export function effectiveGoogleSecret(saved: string | null): string | null {
  if (saved) return saved
  return readEnv('MEETREC_GOOGLE_CLIENT_SECRET')
}
