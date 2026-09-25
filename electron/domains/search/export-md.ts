import type { Speaker } from '../recording/meta'
import type { TranscriptDocument, TranscriptSegment } from '../transcript/parse'

export interface ExportSpeaker {
  id: string
  label: string
  name: string
}

export interface ExportAttendee {
  name: string
  email: string | null
}

export interface MeetingExportInput {
  id: string
  title: string
  startedAt: string
  attendees: ExportAttendee[] | null
  speakers: ExportSpeaker[]
  transcript: TranscriptDocument
  summary: string | null
}

export type MeetingExport = { kind: 'skip' } | { kind: 'markdown'; markdown: string }

export function sourceToken(input: {
  transcriptMtimeMs: number | null
  transcriptSize: number | null
  summaryMtimeMs: number | null
  summarySize: number | null
  speakerNames: readonly string[]
}): string {
  return `${statPart(input.transcriptMtimeMs, input.transcriptSize)}|${statPart(input.summaryMtimeMs, input.summarySize)}|${input.speakerNames.join(',')}`
}

export function buildMeetingExport(input: MeetingExportInput): MeetingExport {
  const segments = input.transcript.segments.filter((segment) => segment.text.trim())
  const text = input.transcript.text.trim()
  if (segments.length === 0 && !text) return { kind: 'skip' }
  const summary = input.summary?.trim() ?? ''
  const lines: string[] = [
    '---',
    `title: ${quoteYaml(input.title)}`,
    `date: ${quoteYaml(input.startedAt)}`
  ]
  if (input.attendees) {
    lines.push('attendees:')
    for (const attendee of input.attendees) {
      const label = attendee.email ? `${attendee.name} <${attendee.email}>` : attendee.name
      lines.push(`  - ${quoteYaml(label)}`)
    }
  }
  lines.push(`meetrec_id: ${quoteYaml(input.id)}`, 'transcript: "transcript.json"')
  if (summary) lines.push('summary: "summary.md"')
  lines.push('---', '', '## Transcript', '')
  if (segments.length === 0) {
    lines.push(text)
  } else {
    lines.push(segments.map((segment) => segmentLine(segment, input.speakers)).join('\n\n'))
  }
  if (summary) {
    lines.push('', '## Summary', '', summary)
  }
  lines.push('')
  return { kind: 'markdown', markdown: lines.join('\n') }
}

export function speakersForExport(speakers: Speaker[]): ExportSpeaker[] {
  return speakers.map((speaker) => ({
    id: speaker.id,
    label: speaker.label,
    name: speaker.name
  }))
}

function segmentLine(segment: TranscriptSegment, speakers: ExportSpeaker[]): string {
  const name = speakerDisplay(segment, speakers)
  const seconds = Number.isFinite(segment.start) ? String(segment.start) : '0'
  const clock = formatClock(Math.round((Number.isFinite(segment.start) ? segment.start : 0) * 1000))
  return `[t=${seconds}] [${clock}] ${name}: ${segment.text.trim()}`
}

function speakerDisplay(segment: TranscriptSegment, speakers: ExportSpeaker[]): string {
  const match = speakers.find((speaker) => speaker.id === segment.speakerId)
  return match?.name.trim() || match?.label || segment.speakerLabel
}

function quoteYaml(value: string): string {
  const flattened = value.replace(/\r?\n/g, ' ')
  const escaped = flattened.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
  return `"${escaped}"`
}

function statPart(mtimeMs: number | null, size: number | null): string {
  const mtime = mtimeMs === null ? 0 : Math.round(mtimeMs)
  const bytes = size === null ? 0 : size
  return `${mtime}:${bytes}`
}

/** Same clock as `formatClock` in the renderer. Main does not import `src/`. */
function formatClock(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const clock = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  if (hours > 0) return `${hours}:${clock}`
  return clock
}
