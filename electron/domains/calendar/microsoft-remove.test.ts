import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { emptySecretBag, type SecretBag } from '../settings/secret-codec'
import type { CalendarDeps, CalendarMemory } from './deps'
import { emptyMemory } from './deps'
import { removeMicrosoftConnection } from './microsoft-fetch'
import { occurrenceKey } from './occurrence'
import { emptyPreferences } from './preferences'
import { emptyRuntimeState } from './state-file'

const NOW = Date.parse('2026-09-23T12:00:00.000Z')
const START = '2026-09-23T18:00:00.000Z'

function key(connectionId: string | null, eventId: string): string {
  return occurrenceKey({
    provider: 'microsoft',
    eventId,
    startsAt: START,
    connectionId,
    calendarId: 'cal'
  })
}

describe('microsoft disconnect', () => {
  it('removes one account and leaves the other', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'meetrec-ms-'))
    let bag: SecretBag = {
      ...emptySecretBag(),
      microsoftConnections: [
        {
          id: 'a',
          accessToken: 'access',
          refreshToken: 'refresh',
          expiresAt: 1,
          tokenType: 'Bearer',
          scope: 'Calendars.Read',
          accountEmail: 'a@contoso.com'
        },
        {
          id: 'b',
          accessToken: 'access',
          refreshToken: 'refresh',
          expiresAt: 1,
          tokenType: 'Bearer',
          scope: 'Calendars.Read',
          accountEmail: 'b@contoso.com'
        }
      ]
    }
    const memory: CalendarMemory = emptyMemory(
      {
        ...emptyPreferences(),
        microsoftCalendars: { a: ['cal-a'], b: ['cal-b'] }
      },
      {
        ...emptyRuntimeState(),
        dismissed: [key('a', 'gone'), key('b', 'stay'), key(null, 'old')]
      }
    )
    memory.events.microsoftByConnection = { a: [], b: [] }
    const deps = {
      userDataDir: () => dir,
      now: () => NOW,
      secrets: {
        async readBag() {
          return JSON.parse(JSON.stringify(bag)) as SecretBag
        },
        async update(mutator: (draft: SecretBag) => void) {
          const draft = JSON.parse(JSON.stringify(bag)) as SecretBag
          mutator(draft)
          bag = draft
          return { encrypted: true }
        }
      }
    } as CalendarDeps
    await removeMicrosoftConnection(deps, memory, 'a', null)
    expect(bag.microsoftConnections.map((item) => item.id)).toEqual(['b'])
    expect(memory.prefs.microsoftCalendars).toEqual({ b: ['cal-b'] })
    expect(memory.events.microsoftByConnection.a).toBeUndefined()
    expect(memory.events.microsoftByConnection.b).toEqual([])
    expect(memory.runtime.dismissed).toEqual([key('b', 'stay'), key(null, 'old')])
  })
})
