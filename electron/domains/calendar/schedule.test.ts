import { describe, expect, it } from 'vitest'
import { CALENDAR_END_GRACE_MS } from './constants'
import { armFromEvent, decideSchedule, noticeBody } from './schedule'
import type { CalendarEvent } from './source'
import type { CalendarRuntimeState } from './state-file'

const START = Date.parse('2026-09-23T15:00:00.000Z')

function eventAt(
  startMs: number,
  id = 'evt',
  provider: CalendarEvent['provider'] = 'google',
  seriesId: string | null = null
): CalendarEvent {
  const startsAt = new Date(startMs).toISOString()
  return {
    provider,
    eventId: id,
    occurrenceKey: `${provider}:${id}:${startsAt}`,
    seriesId,
    title: id,
    startsAt,
    endsAt: new Date(startMs + 30 * 60 * 1000).toISOString(),
    attendees: []
  }
}

function state(partial: Partial<CalendarRuntimeState> = {}): CalendarRuntimeState {
  return {
    dismissed: [],
    notified: [],
    disabledOccurrences: [],
    disabledSeries: [],
    arm: null,
    linkedStop: null,
    ...partial
  }
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
    autoRecord: false,
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

  it('skips an opted-out occurrence and still prompts the next one', () => {
    const skipped = eventAt(START, 'skip')
    const kept = eventAt(START + 120_000, 'keep')
    const decision = decide(START - 60_000, {
      events: [skipped, kept],
      state: state({ disabledOccurrences: [skipped.occurrenceKey] })
    })
    expect(decision.prompt?.title).toBe('keep')
    expect(decision.startAllowed).toBe(true)
  })

  it('skips every occurrence in an opted-out series', () => {
    const skipped = eventAt(START, 'skip', 'google', 'series-1')
    const kept = eventAt(START + 60_000, 'keep', 'microsoft', 'series-2')
    const decision = decide(START - 60_000, {
      events: [skipped, kept],
      state: state({ disabledSeries: ['series-1'] })
    })
    expect(decision.prompt?.title).toBe('keep')
    expect(
      decide(START - 60_000, {
        events: [skipped],
        state: state({ disabledSeries: ['series-1'] })
      }).prompt
    ).toBeNull()
  })

  it('does not auto-arm an opted-out occurrence or series', () => {
    const event = eventAt(START, 'evt', 'google', 'series-1')
    const armed = armFromEvent(event)
    expect(armed.seriesId).toBe('series-1')
    expect(
      decide(START - 60_000, {
        events: [],
        state: state({ arm: armed, disabledOccurrences: [event.occurrenceKey] })
      }).dueArm
    ).toBeNull()
    expect(
      decide(START - 60_000, {
        events: [],
        state: state({ arm: armed, disabledSeries: ['series-1'] })
      }).dueArm
    ).toBeNull()
    expect(
      decide(START - 60_000, {
        events: [],
        state: state({ arm: armed, disabledSeries: ['other-series'] })
      }).dueArm?.occurrenceKey
    ).toBe(event.occurrenceKey)
  })

  it('auto-record notifies without the prompt and starts at one minute', () => {
    const ten = decide(START - 600_000, { autoRecord: true })
    expect(ten.prompt).toBeNull()
    expect(ten.notice?.minutesUntil).toBe(10)
    expect(ten.notify).toBe(true)
    expect(ten.dueArm).toBeNull()
    expect(ten.startAllowed).toBe(false)
    expect(noticeBody(ten.notice!, true)).toContain('recording will start 1 minute before')
    const manual = decide(START - 60_000)
    expect(manual.prompt?.minutesUntil).toBe(1)
    expect(manual.dueArm).toBeNull()
    expect(noticeBody(manual.notice!, false)).toBe('Starts in 1 min.')
    const armed = decide(START - 60_000, { autoRecord: true })
    expect(armed.prompt).toBeNull()
    expect(armed.dueArm?.occurrenceKey).toBe(eventAt(START).occurrenceKey)
    const skipped = eventAt(START, 'skip', 'google', 'series-1')
    expect(
      decide(START - 60_000, {
        autoRecord: true,
        events: [skipped],
        state: state({ disabledOccurrences: [skipped.occurrenceKey] })
      }).dueArm
    ).toBeNull()
    expect(
      decide(START - 60_000, {
        autoRecord: true,
        events: [skipped],
        state: state({ disabledSeries: ['series-1'] })
      }).notice
    ).toBeNull()
  })
})
