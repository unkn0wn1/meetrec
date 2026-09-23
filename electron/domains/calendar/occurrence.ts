const ISO_PATTERN = String.raw`\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z`
const KEY_PATTERN = new RegExp(`^(google|microsoft):(.*):(${ISO_PATTERN})$`)

export function occurrenceKey(input: {
  provider: 'google' | 'microsoft'
  eventId: string
  startsAt: string
  connectionId?: string | null
  calendarId?: string | null
}): string {
  const { provider, eventId, startsAt } = input
  if (provider === 'google' && input.connectionId && input.calendarId) {
    return `google:v2:${encodeURIComponent(input.connectionId)}:${encodeURIComponent(input.calendarId)}:${encodeURIComponent(eventId)}:${startsAt}`
  }
  if (provider === 'microsoft' && input.calendarId) {
    return `microsoft:v2:${encodeURIComponent(input.calendarId)}:${encodeURIComponent(eventId)}:${startsAt}`
  }
  return `${provider}:${eventId}:${startsAt}`
}

export function parseOccurrenceKey(key: string): {
  provider: 'google' | 'microsoft'
  eventId: string
  startsAt: string
  connectionId: string | null
  calendarId: string | null
} | null {
  const match = KEY_PATTERN.exec(key)
  if (!match) return null
  const provider = match[1]
  if (provider !== 'google' && provider !== 'microsoft') return null
  const middle = match[2] ?? ''
  const startsAt = match[3] ?? ''
  if (!middle.startsWith('v2:')) {
    return { provider, eventId: middle, startsAt, connectionId: null, calendarId: null }
  }
  const parts = middle.slice(3).split(':')
  if (provider === 'google' && parts.length === 3) {
    return {
      provider,
      connectionId: decodePart(parts[0]),
      calendarId: decodePart(parts[1]),
      eventId: decodePart(parts[2]),
      startsAt
    }
  }
  if (provider === 'microsoft' && parts.length === 2) {
    return {
      provider,
      connectionId: null,
      calendarId: decodePart(parts[0]),
      eventId: decodePart(parts[1]),
      startsAt
    }
  }
  return { provider, eventId: middle, startsAt, connectionId: null, calendarId: null }
}

export function startMsFromKey(key: string): number | null {
  const parsed = parseOccurrenceKey(key)
  if (!parsed) return null
  const ms = Date.parse(parsed.startsAt)
  return Number.isNaN(ms) ? null : ms
}

function decodePart(value: string | undefined): string {
  if (!value) return ''
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

export function toUtcIso(value: string): string | null {
  const ms = Date.parse(value)
  if (Number.isNaN(ms)) return null
  return new Date(ms).toISOString()
}
