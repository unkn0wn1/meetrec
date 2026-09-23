export interface CalendarChoice {
  id: string
  summary: string
  primary: boolean
  selected: boolean
}

export interface CalendarAccountStatus {
  connected: boolean
  accountEmail: string | null
  uploadEnabled: boolean
  uploadScopeGranted: boolean
  error: string | null
}

export interface GoogleConnectionStatus {
  id: string
  accountEmail: string | null
  error: string | null
  uploadScopeGranted: boolean
  calendars: CalendarChoice[]
}

export interface CalendarEventView {
  occurrenceKey: string
  provider: 'google' | 'microsoft'
  title: string
  startsAt: string
  endsAt: string | null
  attendeeNames: string[]
  seriesId: string | null
  /** Email, plus the calendar name when it is not the primary calendar. */
  hint: string | null
  /** False when this occurrence or its series is opted out. */
  record: boolean
  /** True when the whole series is opted out. */
  seriesSkipped: boolean
}

export interface CalendarPrompt {
  occurrenceKey: string
  provider: 'google' | 'microsoft'
  title: string
  startsAt: string
  endsAt: string | null
  minutesUntil: number
  hint: string | null
}

export interface CalendarArmView {
  occurrenceKey: string
  title: string
  fireAt: string
}

export interface CalendarStatus {
  connectPending: 'google' | 'microsoft' | null
  /** Google card a reconnect or Drive consent is updating. Null adds an account. */
  connectTargetId: string | null
  /** True when Google or Microsoft calendar has a refresh token. */
  connected: boolean
  /** Aggregate used by upload and the Calendar tab gate. */
  google: CalendarAccountStatus
  googleAccounts: GoogleConnectionStatus[]
  microsoft: CalendarAccountStatus & { calendars: CalendarChoice[] }
  upcoming: CalendarEventView[]
  prompt: CalendarPrompt | null
  arm: CalendarArmView | null
}

export interface CalendarList {
  connected: boolean
  events: CalendarEventView[]
}

export interface CalendarConnectInput {
  provider: 'google' | 'microsoft'
  purpose: 'calendar' | 'drive'
  /** Reconnect or Drive consent for one Google account. Omit to add an account. */
  connectionId?: string | null
}

export interface CalendarProviderInput {
  provider: 'google' | 'microsoft'
  connectionId?: string | null
}

export interface CalendarSelectionInput {
  provider: 'google' | 'microsoft'
  connectionId?: string | null
  calendarIds: string[]
}

export interface OccurrenceInput {
  occurrenceKey: string
}

export interface CalendarRecordInput {
  occurrenceKey: string
  enabled: boolean
  scope: 'occurrence' | 'series'
}
