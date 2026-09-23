/** Clocks for the calendar prompt, poll, grace stop, and the Calendar tab. */
export const PROMPT_LEAD_MS = 600_000
export const AUTO_ARM_LEAD_MS = 60_000
export const CALENDAR_END_GRACE_MS = 120_000
export const FETCH_INTERVAL_MS = 60_000
export const TICK_INTERVAL_MS = 15_000
export const LOOKAHEAD_MS = 14 * 24 * 60 * 60 * 1000
export const FETCH_LOOKBEHIND_MS = 60_000
export const OAUTH_TIMEOUT_MS = 300_000
export const REFRESH_SKEW_MS = 60_000
export const MAX_EVENTS = 100
export const SNAPSHOT_MAX_AGE_MS = 15 * 60 * 1000
export const STATE_PRUNE_MS = 6 * 60 * 60 * 1000
export const STATE_CAP = 200
export const GOOGLE_CALENDAR_SCOPE = [
  'openid',
  'email',
  'https://www.googleapis.com/auth/calendar.readonly'
].join(' ')

export const GOOGLE_DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file'

export const MICROSOFT_CALENDAR_SCOPE = [
  'openid',
  'profile',
  'email',
  'offline_access',
  'User.Read',
  'Calendars.Read'
].join(' ')

export const MICROSOFT_APPFOLDER_SCOPE = 'Files.ReadWrite.AppFolder'
