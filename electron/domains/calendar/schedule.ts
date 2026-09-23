import { AUTO_ARM_LEAD_MS, PROMPT_LEAD_MS, SNAPSHOT_MAX_AGE_MS } from './constants'
import type { CalendarEvent } from './source'
import type { CalendarArm, CalendarRuntimeState } from './state-file'

export function occurrenceSkipped(
  occurrenceKey: string,
  seriesId: string | null,
  state: CalendarRuntimeState
): boolean {
  if (state.disabledOccurrences.includes(occurrenceKey)) return true
  return Boolean(seriesId && state.disabledSeries.includes(seriesId))
}

export function armSkipped(
  arm: CalendarArm,
  events: CalendarEvent[],
  state: CalendarRuntimeState
): boolean {
  if (occurrenceSkipped(arm.occurrenceKey, arm.seriesId, state)) return true
  const event = events.find((item) => item.occurrenceKey === arm.occurrenceKey)
  if (!event) return false
  return occurrenceSkipped(event.occurrenceKey, event.seriesId, state)
}

export interface SchedulePrompt {
  occurrenceKey: string
  provider: 'google' | 'microsoft'
  title: string
  startsAt: string
  endsAt: string | null
  minutesUntil: number
}

export interface ScheduleDecision {
  /** Prompt window. Null when auto-record is on. */
  prompt: SchedulePrompt | null
  /** Notification payload, including when the prompt window stays closed. */
  notice: SchedulePrompt | null
  notify: boolean
  dueArm: CalendarArm | null
  graceDue: boolean
  startAllowed: boolean
}

export function mergeEvents(groups: CalendarEvent[][]): CalendarEvent[] {
  return groups.flat().sort((left, right) => Date.parse(left.startsAt) - Date.parse(right.startsAt))
}

export function decideSchedule(input: {
  now: number
  events: CalendarEvent[]
  state: CalendarRuntimeState
  recording: boolean
  snapshotAt: number | null
  autoRecord: boolean
}): ScheduleDecision {
  const fresh = input.snapshotAt != null && input.now - input.snapshotAt <= SNAPSHOT_MAX_AGE_MS
  const blocked = blockedKeys(input.events, input.state)
  const candidate = fresh ? soonestPrompt(input.events, input.now, blocked) : null
  const prompt = input.autoRecord ? null : candidate
  const notify = Boolean(candidate && !input.state.notified.includes(candidate.occurrenceKey))
  const arm = input.state.arm
  const armIsDue = Boolean(
    arm && !Number.isNaN(Date.parse(arm.fireAt)) && Date.parse(arm.fireAt) <= input.now
  )
  const skipArm = arm ? armSkipped(arm, input.events, input.state) : false
  const manualDue = arm && armIsDue && !input.recording && !skipArm ? arm : null
  const implicit =
    input.autoRecord && !input.recording ? implicitArm(input.events, input.now, blocked) : null
  const link = input.state.linkedStop
  const graceDue = Boolean(
    link && !Number.isNaN(Date.parse(link.stopAt)) && Date.parse(link.stopAt) <= input.now
  )
  return {
    prompt,
    notice: candidate,
    notify,
    dueArm: manualDue ?? implicit,
    graceDue,
    startAllowed: Boolean(prompt) && !input.recording
  }
}

export function noticeBody(notice: SchedulePrompt, autoRecord: boolean): string {
  if (!autoRecord) return `Starts in ${notice.minutesUntil} min.`
  const when = new Date(notice.startsAt)
  const label = Number.isNaN(when.getTime())
    ? notice.startsAt
    : when.toLocaleString(undefined, { hour: 'numeric', minute: '2-digit' })
  return `${label} · recording will start 1 minute before`
}

export function armFromEvent(event: CalendarEvent): CalendarArm {
  return {
    occurrenceKey: event.occurrenceKey,
    fireAt: new Date(Date.parse(event.startsAt) - AUTO_ARM_LEAD_MS).toISOString(),
    title: event.title,
    endsAt: event.endsAt,
    seriesId: event.seriesId
  }
}

function implicitArm(
  events: CalendarEvent[],
  now: number,
  blocked: Set<string>
): CalendarArm | null {
  const candidates = events
    .filter((event) => {
      const start = Date.parse(event.startsAt)
      if (Number.isNaN(start) || blocked.has(event.occurrenceKey)) return false
      const delta = start - now
      return delta >= 0 && delta <= AUTO_ARM_LEAD_MS
    })
    .sort((left, right) => Date.parse(left.startsAt) - Date.parse(right.startsAt))
  const soonest = candidates[0]
  return soonest ? armFromEvent(soonest) : null
}

function blockedKeys(events: CalendarEvent[], state: CalendarRuntimeState): Set<string> {
  const blocked = new Set<string>(state.dismissed)
  if (state.arm) blocked.add(state.arm.occurrenceKey)
  for (const event of events) {
    if (occurrenceSkipped(event.occurrenceKey, event.seriesId, state)) {
      blocked.add(event.occurrenceKey)
    }
  }
  return blocked
}

function soonestPrompt(
  events: CalendarEvent[],
  now: number,
  blocked: Set<string>
): SchedulePrompt | null {
  const candidates = events
    .filter((event) => {
      const start = Date.parse(event.startsAt)
      if (Number.isNaN(start) || blocked.has(event.occurrenceKey)) return false
      const delta = start - now
      return delta > 0 && delta <= PROMPT_LEAD_MS
    })
    .sort((left, right) => Date.parse(left.startsAt) - Date.parse(right.startsAt))
  const soonest = candidates[0]
  if (!soonest) return null
  const delta = Date.parse(soonest.startsAt) - now
  return {
    occurrenceKey: soonest.occurrenceKey,
    provider: soonest.provider,
    title: soonest.title,
    startsAt: soonest.startsAt,
    endsAt: soonest.endsAt,
    minutesUntil: Math.max(1, Math.ceil(delta / 60_000))
  }
}
