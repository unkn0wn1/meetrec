export interface Speaker {
  id: string
  label: string
  name: string
}

export interface UploadFileIds {
  audio?: string
  transcript?: string
  summary?: string
}

export interface RecordingUploads {
  google?: { folderId: string; files: UploadFileIds }
  microsoft?: { files: UploadFileIds }
}

export interface RecordingCalendarLink {
  provider: 'google' | 'microsoft'
  occurrenceKey: string
  title: string
  startsAt: string
  endsAt: string | null
  attendees: { name: string; email: string | null }[]
}

export interface CalendarSummary {
  title: string
  attendees: { name: string; email: string | null }[]
}

export interface RecordingMeta {
  id: string
  startedAt: string
  endedAt: string | null
  durationMs: number
  speakers: Speaker[]
  topic: string | null
  captureMode: 'mix' | 'mic-only' | null
  note: string | null
  title: string | null
  calendar: RecordingCalendarLink | null
  uploads?: RecordingUploads
  paths: {
    audio: string
    transcript: string
    summary: string
  }
}

export function emptyMeta(input: {
  id: string
  startedAt: string
  endedAt?: string | null
  durationMs?: number
  captureMode?: RecordingMeta['captureMode']
  note?: string | null
  title?: string | null
  calendar?: RecordingCalendarLink | null
}): RecordingMeta {
  return {
    id: input.id,
    startedAt: input.startedAt,
    endedAt: input.endedAt ?? null,
    durationMs: input.durationMs ?? 0,
    speakers: [],
    topic: null,
    captureMode: input.captureMode ?? null,
    note: input.note ?? null,
    title: input.title ?? null,
    calendar: input.calendar ?? null,
    paths: {
      audio: 'audio.wav',
      transcript: 'transcript.json',
      summary: 'summary.md'
    }
  }
}

export function uploadFlags(uploads: RecordingUploads | undefined): {
  hasGoogleDrive: boolean
  hasOneDrive: boolean
} {
  return {
    hasGoogleDrive: hasUploadId(uploads?.google?.files),
    hasOneDrive: hasUploadId(uploads?.microsoft?.files)
  }
}

function hasUploadId(files: UploadFileIds | undefined): boolean {
  return Boolean(files?.audio || files?.transcript || files?.summary)
}

/** Slim calendar payload for the renderer. Omits provider ids and event times. */
export function calendarSummary(calendar: RecordingCalendarLink | null): CalendarSummary | null {
  if (!calendar) return null
  return {
    title: calendar.title,
    attendees: calendar.attendees.map((attendee) => ({
      name: attendee.name,
      email: attendee.email
    }))
  }
}

export function displayTitle(meta: Pick<RecordingMeta, 'id' | 'title' | 'startedAt'>): string {
  const title = meta.title?.trim()
  if (title) return title
  const parsed = Date.parse(meta.startedAt)
  if (Number.isNaN(parsed)) return meta.id
  return new Date(parsed).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  })
}

export function applySpeakerNames(speakers: Speaker[], names: Record<string, string>): Speaker[] {
  return speakers.map((speaker) => {
    const next = names[speaker.id]
    if (next === undefined) return speaker
    return { ...speaker, name: next.trim() }
  })
}

export function mergeSpeakerLabels(
  existing: Speaker[],
  incoming: { id: string; label: string }[]
): Speaker[] {
  const fresh: Speaker[] = []
  for (const speaker of incoming) {
    if (fresh.some((item) => item.id === speaker.id)) continue
    const prior = existing.find((item) => item.id === speaker.id)
    fresh.push({
      id: speaker.id,
      label: speaker.label,
      name: prior?.name ?? ''
    })
  }
  return fresh
}

export function parseMeta(raw: string): RecordingMeta | null {
  let value: unknown
  try {
    value = JSON.parse(raw)
  } catch {
    return null
  }
  if (!value || typeof value !== 'object') return null
  const record = value as Record<string, unknown>
  if (typeof record.id !== 'string' || typeof record.startedAt !== 'string') return null
  const speakers = Array.isArray(record.speakers) ? record.speakers.flatMap(parseSpeaker) : []
  const paths = record.paths
  const pathRecord = paths && typeof paths === 'object' ? (paths as Record<string, unknown>) : {}
  return {
    id: record.id,
    startedAt: record.startedAt,
    endedAt: typeof record.endedAt === 'string' ? record.endedAt : null,
    durationMs:
      typeof record.durationMs === 'number' && Number.isFinite(record.durationMs)
        ? record.durationMs
        : 0,
    speakers,
    topic: typeof record.topic === 'string' && record.topic.trim() ? record.topic : null,
    captureMode:
      record.captureMode === 'mix' || record.captureMode === 'mic-only' ? record.captureMode : null,
    note: typeof record.note === 'string' ? record.note : null,
    title: typeof record.title === 'string' && record.title.trim() ? record.title : null,
    calendar: parseCalendarLink(record.calendar),
    ...uploadField(parseUploads(record.uploads)),
    paths: {
      audio: typeof pathRecord.audio === 'string' ? pathRecord.audio : 'audio.wav',
      transcript:
        typeof pathRecord.transcript === 'string' ? pathRecord.transcript : 'transcript.json',
      summary: typeof pathRecord.summary === 'string' ? pathRecord.summary : 'summary.md'
    }
  }
}

function uploadField(uploads: RecordingUploads | undefined): { uploads?: RecordingUploads } {
  return uploads ? { uploads } : {}
}

function parseUploads(value: unknown): RecordingUploads | undefined {
  if (!value || typeof value !== 'object') return undefined
  const record = value as Record<string, unknown>
  const uploads: RecordingUploads = {}
  const google = record.google
  if (google && typeof google === 'object') {
    const folderId = (google as Record<string, unknown>).folderId
    if (typeof folderId === 'string' && folderId) {
      uploads.google = {
        folderId,
        files: parseFileIds((google as Record<string, unknown>).files)
      }
    }
  }
  const microsoft = record.microsoft
  if (microsoft && typeof microsoft === 'object') {
    uploads.microsoft = { files: parseFileIds((microsoft as Record<string, unknown>).files) }
  }
  return uploads.google || uploads.microsoft ? uploads : undefined
}

function parseFileIds(value: unknown): UploadFileIds {
  if (!value || typeof value !== 'object') return {}
  const record = value as Record<string, unknown>
  const ids: UploadFileIds = {}
  if (typeof record.audio === 'string' && record.audio) ids.audio = record.audio
  if (typeof record.transcript === 'string' && record.transcript) ids.transcript = record.transcript
  if (typeof record.summary === 'string' && record.summary) ids.summary = record.summary
  return ids
}

function parseCalendarLink(value: unknown): RecordingCalendarLink | null {
  if (!value || typeof value !== 'object') return null
  const record = value as Record<string, unknown>
  if (record.provider !== 'google' && record.provider !== 'microsoft') return null
  if (typeof record.occurrenceKey !== 'string' || typeof record.startsAt !== 'string') return null
  if (typeof record.title !== 'string' || !record.title.trim()) return null
  const attendees = Array.isArray(record.attendees) ? record.attendees.flatMap(parseAttendee) : []
  return {
    provider: record.provider,
    occurrenceKey: record.occurrenceKey,
    title: record.title,
    startsAt: record.startsAt,
    endsAt: typeof record.endsAt === 'string' ? record.endsAt : null,
    attendees
  }
}

function parseAttendee(value: unknown): { name: string; email: string | null }[] {
  if (!value || typeof value !== 'object') return []
  const record = value as Record<string, unknown>
  if (typeof record.name !== 'string') return []
  const email = typeof record.email === 'string' && record.email.trim() ? record.email.trim() : null
  return [{ name: record.name, email }]
}

function parseSpeaker(value: unknown): Speaker[] {
  if (!value || typeof value !== 'object') return []
  const record = value as Record<string, unknown>
  if (typeof record.id !== 'string' || typeof record.label !== 'string') return []
  return [
    {
      id: record.id,
      label: record.label,
      name: typeof record.name === 'string' ? record.name : ''
    }
  ]
}
