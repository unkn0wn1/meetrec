export interface CalendarAccountStatus {
  connected: boolean
  accountEmail: string | null
  uploadEnabled: boolean
  uploadScopeGranted: boolean
  error: string | null
}

export interface CalendarEventView {
  occurrenceKey: string
  provider: 'google' | 'microsoft'
  title: string
  startsAt: string
  endsAt: string | null
  attendeeNames: string[]
  seriesId: string | null
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
}

export interface CalendarArmView {
  occurrenceKey: string
  title: string
  fireAt: string
}

export interface CalendarStatus {
  connectPending: 'google' | 'microsoft' | null
  /** True when Google or Microsoft calendar has a refresh token. */
  connected: boolean
  google: CalendarAccountStatus
  microsoft: CalendarAccountStatus
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
}

export interface CalendarProviderInput {
  provider: 'google' | 'microsoft'
}

export interface OccurrenceInput {
  occurrenceKey: string
}

export interface CalendarRecordInput {
  occurrenceKey: string
  enabled: boolean
  scope: 'occurrence' | 'series'
}
