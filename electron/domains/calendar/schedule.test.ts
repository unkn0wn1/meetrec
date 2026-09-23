import { describe, expect, it } from 'vitest'
import { CALENDAR_END_GRACE_MS } from './constants'
import { armFromEvent, decideSchedule } from './schedule'
import type { CalendarEvent } from './source'
import type { CalendarRuntimeState } from './state-file'

const START = Date.parse('2026-09-23T15:00:00.000Z')

function eventAt(
  startMs: number,
  id = 'evt',
  provider: CalendarEvent['provider'] = 'google'
): CalendarEvent {
  const startsAt = new Date(startMs).toISOString()
  return {
    provider,
    eventId: id,
    occurrenceKey: `${provider}:${id}:${startsAt}`,
    title: id,
    startsAt,
    endsAt: new Date(startMs + 30 * 60 * 1000).toISOString(),
    attendees: []
  }
}

function state(partial: Partial<CalendarRuntimeState> = {}): CalendarRuntimeState {
  return { dismissed: [], notified: [], arm: null, linkedStop: null, ...partial }
}

function decide(
  now: number,
  extra: Partial<Parameters<typeof decideSchedule>[0]> = {}
): ReturnType<typeof decideSchedule> {
  return decideSchedule({
    now,
    events: [eventAt(START)],
    state: state(),
    recording: false,
    snapshotAt: now,
    ...extra
  })
}

describe('schedule', () => {
  it('prompts at 10 minutes and at 1 minute, and notifies once', () => {
    const ten = decide(START - 600_000)
    expect(ten.prompt?.occurrenceKey).toBe(eventAt(START).occurrenceKey)
    expect(ten.prompt?.minutesUntil).toBe(10)
    expect(ten.notify).toBe(true)
    const one = decide(START - 60_000)
    expect(one.prompt?.minutesUntil).toBe(1)
    const seen = decide(START - 600_000, {
      state: state({ notified: [eventAt(START).occurrenceKey] })
    })
    expect(seen.prompt).not.toBeNull()
    expect(seen.notify).toBe(false)
  })

  it('does not prompt from a snapshot older than 15 minutes', () => {
    const now = START - 60_000
    expect(decide(now, { snapshotAt: now - 15 * 60 * 1000 - 1 }).prompt).toBeNull()
  })

  it('does not prompt at 11 minutes, after start, or when dismissed', () => {
    expect(decide(START - 660_000).prompt).toBeNull()
    expect(decide(START + 1).prompt).toBeNull()
    expect(
      decide(START - 60_000, { state: state({ dismissed: [eventAt(START).occurrenceKey] }) }).prompt
    ).toBeNull()
  })

  it('arms at start minus 60 seconds and treats a past fire time as due', () => {
    const armed = armFromEvent(eventAt(START))
    expect(armed.fireAt).toBe(new Date(START - 60_000).toISOString())
    expect(decide(START - 61_000, { state: state({ arm: armed }), events: [] }).dueArm).toBeNull()
    expect(
      decide(START - 60_000, { state: state({ arm: armed }), events: [] }).dueArm?.fireAt
    ).toBe(armed.fireAt)
  })

  it('marks grace due at the event end plus 2 minutes, and not for an unlinked recording', () => {
    const end = START + 30 * 60 * 1000
    const stopAt = new Date(end + CALENDAR_END_GRACE_MS).toISOString()
    const linked = {
      recordingId: 'rec',
      stopAt,
      occurrenceKey: eventAt(START).occurrenceKey
    }
    expect(
      decide(end + CALENDAR_END_GRACE_MS, { state: state({ linkedStop: linked }) }).graceDue
    ).toBe(true)
    expect(
      decide(end + CALENDAR_END_GRACE_MS - 1, { state: state({ linkedStop: linked }) }).graceDue
    ).toBe(false)
    expect(decide(end + CALENDAR_END_GRACE_MS, { recording: true }).graceDue).toBe(false)
  })

  it('suppresses Start and a due arm while a recording is already running', () => {
    const prompted = decide(START - 60_000, { recording: true })
    expect(prompted.prompt).not.toBeNull()
    expect(prompted.startAllowed).toBe(false)
    const armed = armFromEvent(eventAt(START))
    const due = decide(START - 60_000, {
      recording: true,
      state: state({ arm: armed }),
      events: []
    })
    expect(due.dueArm).toBeNull()
  })

  it('keeps the earlier snapshot order when two events start together', () => {
    const first = eventAt(START, 'first', 'google')
    const second = eventAt(START, 'second', 'microsoft')
    const decision = decide(START - 60_000, { events: [first, second] })
    expect(decision.prompt?.title).toBe('first')
  })
})
