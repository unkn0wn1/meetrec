import { describe, expect, it } from 'vitest'
import { emptyMemory, type CalendarCore } from './deps'
import { emptyPreferences } from './preferences'
import { setRecordOptOut } from './record-opt'
import type { CalendarEvent } from './source'
import { emptyRuntimeState, type CalendarRuntimeState } from './state-file'

const START = '2026-09-23T15:00:00.000Z'

function event(seriesId: string | null = 'series-1', id = 'evt'): CalendarEvent {
  return {
    provider: 'google',
    eventId: id,
    occurrenceKey: `google:${id}:${START}`,
    seriesId,
    title: id,
    startsAt: START,
    endsAt: '2026-09-23T15:30:00.000Z',
    attendees: []
  }
}

function harness(item: CalendarEvent, runtime: Partial<CalendarRuntimeState> = {}) {
  const memory = emptyMemory(emptyPreferences(), { ...emptyRuntimeState(), ...runtime })
  memory.events.googleByConnection = { acct: [item] }
  let saves = 0
  const core = {
    memory,
    async saveRuntime() {
      saves += 1
    },
    async publish() {
      return undefined
    }
  } as CalendarCore
  return {
    core,
    saved: () => saves
  }
}

describe('record opt-out', () => {
  it('opts out of one occurrence and clears a matching arm', async () => {
    const item = event('series-1')
    const { core, saved } = harness(item, {
      arm: {
        occurrenceKey: item.occurrenceKey,
        fireAt: START,
        title: item.title,
        endsAt: item.endsAt,
        seriesId: item.seriesId
      }
    })
    await setRecordOptOut(core, {
      occurrenceKey: item.occurrenceKey,
      enabled: false,
      scope: 'occurrence'
    })
    expect(core.memory.runtime.disabledOccurrences).toEqual([item.occurrenceKey])
    expect(core.memory.runtime.disabledSeries).toEqual([])
    expect(core.memory.runtime.arm).toBeNull()
    expect(saved()).toBe(1)
  })

  it('opts out of a series and clears an arm for that series', async () => {
    const item = event('series-1')
    const { core } = harness(item, {
      arm: {
        occurrenceKey: 'google:other:2026-09-24T15:00:00.000Z',
        fireAt: START,
        title: 'Other',
        endsAt: null,
        seriesId: 'series-1'
      }
    })
    await setRecordOptOut(core, {
      occurrenceKey: item.occurrenceKey,
      enabled: false,
      scope: 'series'
    })
    expect(core.memory.runtime.disabledSeries).toEqual(['series-1'])
    expect(core.memory.runtime.arm).toBeNull()
  })

  it('turns a series back on without clearing other occurrence opt-outs', async () => {
    const item = event('series-1', 'evt')
    const other = 'google:other:2026-09-24T15:00:00.000Z'
    const { core } = harness(item, {
      disabledSeries: ['series-1'],
      disabledOccurrences: [item.occurrenceKey, other]
    })
    await setRecordOptOut(core, {
      occurrenceKey: item.occurrenceKey,
      enabled: true,
      scope: 'series'
    })
    expect(core.memory.runtime.disabledSeries).toEqual([])
    expect(core.memory.runtime.disabledOccurrences).toEqual([other])
  })

  it('rejects a series opt-out when the event does not repeat', async () => {
    const item = event(null)
    const { core } = harness(item)
    await expect(
      setRecordOptOut(core, { occurrenceKey: item.occurrenceKey, enabled: false, scope: 'series' })
    ).rejects.toThrow('not part of a series')
    expect(core.memory.runtime.disabledSeries).toEqual([])
  })
})
