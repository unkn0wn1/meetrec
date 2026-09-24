import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { emptySecretBag, type MicrosoftConnection } from '../settings/secret-codec'
import { MICROSOFT_APPFOLDER_SCOPE } from './constants'
import { emptyMemory, type CalendarCore } from './deps'
import { emptyPreferences } from './preferences'
import { emptyRuntimeState } from './state-file'
import { buildCalendarStatus } from './status-view'

function connection(id: string, scope = 'Calendars.Read'): MicrosoftConnection {
  return {
    id,
    accessToken: 'access',
    refreshToken: 'refresh',
    expiresAt: 1,
    tokenType: 'Bearer',
    scope,
    accountEmail: `${id}@contoso.com`
  }
}

describe('calendar status view', () => {
  it('lists two Microsoft accounts and reports OneDrive from the app-folder token', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'meetrec-status-'))
    const bag = {
      ...emptySecretBag(),
      microsoftConnections: [
        connection('oid-1', `Calendars.Read ${MICROSOFT_APPFOLDER_SCOPE}`),
        connection('oid-2')
      ]
    }
    const memory = emptyMemory(
      {
        ...emptyPreferences(),
        microsoftCalendars: { 'oid-1': ['cal-a'], 'oid-2': ['cal-b'] }
      },
      emptyRuntimeState()
    )
    memory.lists.microsoft = {
      'oid-1': [{ id: 'cal-a', summary: 'Ada', primary: true }],
      'oid-2': [{ id: 'cal-b', summary: 'Bea', primary: true }]
    }
    memory.microsoftAccountErrors = { 'oid-2': 'Calendar timed out.' }
    const status = await buildCalendarStatus({
      deps: {
        userDataDir: () => dir,
        secrets: { readBag: async () => bag },
        recording: { status: () => ({ phase: 'idle' as const }) },
        now: () => Date.parse('2026-09-23T12:00:00.000Z')
      },
      memory
    } as CalendarCore)
    expect(status.microsoft).toMatchObject({
      connected: true,
      accountEmail: 'oid-1@contoso.com',
      uploadScopeGranted: true
    })
    expect(status.microsoftAccounts).toEqual([
      {
        id: 'oid-1',
        accountEmail: 'oid-1@contoso.com',
        error: null,
        uploadScopeGranted: true,
        calendars: [{ id: 'cal-a', summary: 'Ada', primary: true, selected: true }]
      },
      {
        id: 'oid-2',
        accountEmail: 'oid-2@contoso.com',
        error: 'Calendar timed out.',
        uploadScopeGranted: false,
        calendars: [{ id: 'cal-b', summary: 'Bea', primary: true, selected: true }]
      }
    ])
  })
})
