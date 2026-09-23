import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { normalizeState, readState, writeState, type CalendarRuntimeState } from './state-file'

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
      arm: {
        occurrenceKey: keyAt(startsAt, 'armed'),
        fireAt: new Date(NOW).toISOString(),
        title: 'Standup',
        endsAt: new Date(NOW + 30 * 60_000).toISOString()
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
      { dismissed: keys, notified: keys, arm: null, linkedStop: null },
      NOW
    )
    expect(normalized.dismissed).toHaveLength(200)
    expect(normalized.dismissed).toContain(keyAt(recent, 'keep'))
    expect(normalized.dismissed).not.toContain(keyAt(old, 'drop'))
    expect(normalized.notified).toHaveLength(200)
  })
})
