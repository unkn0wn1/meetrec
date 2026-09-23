import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { readPreferences, writePreferences } from './preferences'

describe('calendar preferences', () => {
  it('returns defaults when the file is missing', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'meetrec-cal-'))
    expect(await readPreferences(dir)).toEqual({
      googleClientId: null,
      microsoftClientId: null,
      uploadGoogle: false,
      uploadMicrosoft: false
    })
  })

  it('round-trips saved values', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'meetrec-cal-'))
    const prefs = {
      googleClientId: 'google-client',
      microsoftClientId: 'ms-client',
      uploadGoogle: true,
      uploadMicrosoft: false
    }
    await writePreferences(dir, prefs)
    expect(await readPreferences(dir)).toEqual(prefs)
  })

  it('resets garbage JSON', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'meetrec-cal-'))
    await writeFile(join(dir, 'calendar.json'), 'not-json', 'utf8')
    expect(await readPreferences(dir)).toEqual({
      googleClientId: null,
      microsoftClientId: null,
      uploadGoogle: false,
      uploadMicrosoft: false
    })
    expect(JSON.parse(await readFile(join(dir, 'calendar.json'), 'utf8'))).toEqual({
      googleClientId: null,
      microsoftClientId: null,
      uploadGoogle: false,
      uploadMicrosoft: false
    })
  })
})
