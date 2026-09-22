import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { buildRecordingPath, createRecordingId, recordingFileName } from './paths'

describe('recording paths', () => {
  const dirs: string[] = []

  afterEach(() => {
    for (const dir of dirs) rmSync(dir, { recursive: true, force: true })
    dirs.length = 0
  })

  it('builds a wav path under the recordings directory', () => {
    const root = mkdtempSync(join(tmpdir(), 'meetrec-'))
    dirs.push(root)
    const when = new Date('2026-09-22T12:00:00.000Z')
    const file = buildRecordingPath(join(root, 'recordings'), when)
    expect(file.endsWith('.wav')).toBe(true)
    expect(file).toContain('2026-09-22T12-00-00-000Z')
  })

  it('keeps the id in the file name', () => {
    const id = createRecordingId(new Date('2026-01-02T03:04:05.006Z'))
    expect(recordingFileName(id)).toBe(`${id}.wav`)
  })
})
