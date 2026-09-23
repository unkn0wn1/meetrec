export interface CalendarAttendee {
  name: string
  email: string | null
}

export interface CalendarEvent {
  provider: 'google' | 'microsoft'
  eventId: string
  occurrenceKey: string
  /** Google recurringEventId or Microsoft seriesMasterId. Null for a one-off event. */
  seriesId: string | null
  title: string
  startsAt: string
  endsAt: string | null
  attendees: CalendarAttendee[]
  connectionId?: string | null
  calendarId?: string | null
  accountEmail?: string | null
  calendarLabel?: string | null
  calendarPrimary?: boolean
}

export interface CalendarSource {
  id: 'google' | 'microsoft'
  listEvents(
    accessToken: string,
    from: Date,
    to: Date,
    fetchImpl?: typeof fetch
  ): Promise<CalendarEvent[]>
}
