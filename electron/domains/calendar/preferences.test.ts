import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  adoptFlatMicrosoftCalendars,
  emptyPreferences,
  readPreferences,
  writePreferences
} from './preferences'

const EMPTY = emptyPreferences()

describe('calendar preferences', () => {
  it('returns defaults when the file is missing', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'meetrec-cal-'))
    expect(await readPreferences(dir)).toEqual(EMPTY)
  })

  it('round-trips upload toggles and ignores legacy client ids', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'meetrec-cal-'))
    await writeFile(
      join(dir, 'calendar.json'),
      JSON.stringify({
        googleClientId: 'legacy',
        microsoftClientId: 'legacy-ms',
        uploadGoogle: true,
        uploadMicrosoft: false
      }),
      'utf8'
    )
    expect(await readPreferences(dir)).toEqual({
      ...EMPTY,
      uploadGoogle: true
    })
    const prefs = { ...EMPTY, uploadMicrosoft: true }
    await writePreferences(dir, prefs)
    expect(await readPreferences(dir)).toEqual(prefs)
    expect(JSON.parse(await readFile(join(dir, 'calendar.json'), 'utf8'))).toEqual(prefs)
  })

  it('resets garbage JSON', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'meetrec-cal-'))
    await writeFile(join(dir, 'calendar.json'), 'not-json', 'utf8')
    expect(await readPreferences(dir)).toEqual(EMPTY)
    expect(JSON.parse(await readFile(join(dir, 'calendar.json'), 'utf8'))).toEqual(EMPTY)
  })

  it('keeps an explicit empty selection distinct from an old file', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'meetrec-cal-'))
    const prefs = {
      ...EMPTY,
      googleCalendars: { acct: [] },
      microsoftCalendarIds: ['cal-1']
    }
    await writePreferences(dir, prefs)
    expect(await readPreferences(dir)).toEqual(prefs)
  })

  it('copies a flat Microsoft calendar list onto one connection', () => {
    const prefs = { ...EMPTY, microsoftCalendarIds: ['cal-1', 'cal-2'] }
    expect(adoptFlatMicrosoftCalendars(prefs, 'email:ada@contoso.com')).toEqual({
      ...EMPTY,
      microsoftCalendars: { 'email:ada@contoso.com': ['cal-1', 'cal-2'] }
    })
    const chosen = {
      ...EMPTY,
      microsoftCalendars: { 'oid-1': ['kept'] },
      microsoftCalendarIds: ['cal-1']
    }
    expect(adoptFlatMicrosoftCalendars(chosen, 'oid-1').microsoftCalendarIds).toBeNull()
    expect(adoptFlatMicrosoftCalendars(chosen, 'oid-1').microsoftCalendars).toEqual({
      'oid-1': ['kept']
    })
  })
})
