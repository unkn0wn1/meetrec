import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  normalizeState,
  parseRuntimeState,
  readState,
  writeState,
  type CalendarRuntimeState
} from './state-file'

const NOW = Date.parse('2026-09-23T18:00:00.000Z')

function keyAt(iso: string, id = 'event'): string {
  return `google:${id}:${iso}`
}

describe('calendar runtime state', () => {
  it('round-trips an arm and a linked stop', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'meetrec-state-'))
    const startsAt = new Date(NOW + 60_000).toISOString()
    const state: CalendarRuntimeState = {
      dismissed: [keyAt(startsAt, 'dismissed')],
      notified: [],
      disabledOccurrences: [keyAt(startsAt, 'skip')],
      disabledSeries: ['series-1'],
      arm: {
        occurrenceKey: keyAt(startsAt, 'armed'),
        fireAt: new Date(NOW).toISOString(),
        title: 'Standup',
        endsAt: new Date(NOW + 30 * 60_000).toISOString(),
        seriesId: 'series-1'
      },
      linkedStop: {
        recordingId: 'rec-1',
        stopAt: new Date(NOW + 32 * 60_000).toISOString(),
        occurrenceKey: keyAt(startsAt, 'armed')
      }
    }
    await writeState(dir, state, NOW)
    expect(await readState(dir, NOW)).toEqual(state)
  })

  it('prunes old keys and caps each list at 200', () => {
    const recent = new Date(NOW - 60 * 60 * 1000).toISOString()
    const old = new Date(NOW - 7 * 60 * 60 * 1000).toISOString()
    const keys = [keyAt(recent, 'keep'), keyAt(old, 'drop')]
    for (let index = 0; index < 210; index += 1) {
      keys.push(keyAt(new Date(NOW + (index + 1) * 60_000).toISOString(), `n${index}`))
    }
    const normalized = normalizeState(
      {
        dismissed: keys,
        notified: keys,
        disabledOccurrences: [],
        disabledSeries: [],
        arm: null,
        linkedStop: null
      },
      NOW
    )
    expect(normalized.dismissed).toHaveLength(200)
    expect(normalized.dismissed).toContain(keyAt(recent, 'keep'))
    expect(normalized.dismissed).not.toContain(keyAt(old, 'drop'))
    expect(normalized.notified).toHaveLength(200)
  })

  it('keeps series ids that are not occurrence keys and still prunes occurrence opt-outs', () => {
    const recent = new Date(NOW - 60 * 60 * 1000).toISOString()
    const old = new Date(NOW - 7 * 60 * 60 * 1000).toISOString()
    const normalized = normalizeState(
      {
        dismissed: [],
        notified: [],
        disabledOccurrences: [keyAt(old, 'drop'), keyAt(recent, 'keep')],
        disabledSeries: ['master-1', keyAt(old, 'drop')],
        arm: null,
        linkedStop: null
      },
      NOW
    )
    expect(normalized.disabledOccurrences).toEqual([keyAt(recent, 'keep')])
    expect(normalized.disabledSeries).toEqual(['master-1', keyAt(old, 'drop')])
  })

  it('reads older state files that have no opt-out lists', () => {
    const parsed = parseRuntimeState(
      JSON.stringify({ dismissed: [], notified: [], arm: null, linkedStop: null })
    )
    expect(parsed?.disabledOccurrences).toEqual([])
    expect(parsed?.disabledSeries).toEqual([])
  })
})
