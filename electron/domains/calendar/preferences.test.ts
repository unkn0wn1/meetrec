import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { readPreferences, writePreferences } from './preferences'

describe('calendar preferences', () => {
  it('returns defaults when the file is missing', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'meetrec-cal-'))
    expect(await readPreferences(dir)).toEqual({
      uploadGoogle: false,
      uploadMicrosoft: false
    })
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
      uploadGoogle: true,
      uploadMicrosoft: false
    })
    const prefs = { uploadGoogle: false, uploadMicrosoft: true }
    await writePreferences(dir, prefs)
    expect(await readPreferences(dir)).toEqual(prefs)
    expect(JSON.parse(await readFile(join(dir, 'calendar.json'), 'utf8'))).toEqual(prefs)
  })

  it('resets garbage JSON', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'meetrec-cal-'))
    await writeFile(join(dir, 'calendar.json'), 'not-json', 'utf8')
    expect(await readPreferences(dir)).toEqual({
      uploadGoogle: false,
      uploadMicrosoft: false
    })
    expect(JSON.parse(await readFile(join(dir, 'calendar.json'), 'utf8'))).toEqual({
      uploadGoogle: false,
      uploadMicrosoft: false
    })
  })
})
