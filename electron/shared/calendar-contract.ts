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
  google: CalendarAccountStatus
  microsoft: CalendarAccountStatus
  upcoming: CalendarEventView[]
  prompt: CalendarPrompt | null
  arm: CalendarArmView | null
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
