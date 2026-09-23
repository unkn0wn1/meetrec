import { AUTO_ARM_LEAD_MS, PROMPT_LEAD_MS, SNAPSHOT_MAX_AGE_MS } from './constants'
import type { CalendarEvent } from './source'
import type { CalendarArm, CalendarRuntimeState } from './state-file'

export interface SchedulePrompt {
  occurrenceKey: string
  provider: 'google' | 'microsoft'
  title: string
  startsAt: string
  endsAt: string | null
  minutesUntil: number
}

export interface ScheduleDecision {
  prompt: SchedulePrompt | null
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
}): ScheduleDecision {
  const fresh = input.snapshotAt != null && input.now - input.snapshotAt <= SNAPSHOT_MAX_AGE_MS
  const blocked = new Set(input.state.dismissed)
  if (input.state.arm) blocked.add(input.state.arm.occurrenceKey)
  const prompt = fresh ? soonestPrompt(input.events, input.now, blocked) : null
  const notify = Boolean(prompt && !input.state.notified.includes(prompt.occurrenceKey))
  const arm = input.state.arm
  const armIsDue = Boolean(
    arm && !Number.isNaN(Date.parse(arm.fireAt)) && Date.parse(arm.fireAt) <= input.now
  )
  const link = input.state.linkedStop
  const graceDue = Boolean(
    link && !Number.isNaN(Date.parse(link.stopAt)) && Date.parse(link.stopAt) <= input.now
  )
  return {
    prompt,
    notify,
    dueArm: arm && armIsDue && !input.recording ? arm : null,
    graceDue,
    startAllowed: Boolean(prompt) && !input.recording
  }
}

export function armFromEvent(event: CalendarEvent): CalendarArm {
  return {
    occurrenceKey: event.occurrenceKey,
    fireAt: new Date(Date.parse(event.startsAt) - AUTO_ARM_LEAD_MS).toISOString(),
    title: event.title,
    endsAt: event.endsAt
  }
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
