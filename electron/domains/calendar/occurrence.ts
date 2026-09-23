export function occurrenceKey(
  provider: 'google' | 'microsoft',
  eventId: string,
  startsAt: string
): string {
  return `${provider}:${eventId}:${startsAt}`
}

const KEY_PATTERN = /^(google|microsoft):(.*):(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z)$/

export function parseOccurrenceKey(key: string): {
  provider: 'google' | 'microsoft'
  eventId: string
  startsAt: string
} | null {
  const match = KEY_PATTERN.exec(key)
  if (!match) return null
  const provider = match[1]
  if (provider !== 'google' && provider !== 'microsoft') return null
  return { provider, eventId: match[2], startsAt: match[3] }
}

export function startMsFromKey(key: string): number | null {
  const parsed = parseOccurrenceKey(key)
  if (!parsed) return null
  const ms = Date.parse(parsed.startsAt)
  return Number.isNaN(ms) ? null : ms
}

export function toUtcIso(value: string): string | null {
  const ms = Date.parse(value)
  if (Number.isNaN(ms)) return null
  return new Date(ms).toISOString()
}
