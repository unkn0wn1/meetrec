import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseSearchStatus, readSearchStatus, writeSearchStatus } from './status-file'

describe('search status file', () => {
  it('round-trips pending, indexed, and error', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'meetrec-search-status-'))
    try {
      const file = join(dir, 'search.json')
      await writeSearchStatus(file, {
        state: 'pending',
        error: null,
        updatedAt: '2026-09-25T18:00:00.000Z',
        sourceToken: '1:2|0:0|Ada'
      })
      expect(await readSearchStatus(file)).toMatchObject({
        state: 'pending',
        sourceToken: '1:2|0:0|Ada'
      })
      await writeSearchStatus(file, {
        state: 'indexed',
        error: null,
        updatedAt: '2026-09-25T18:01:00.000Z',
        sourceToken: '1:2|0:0|Ada'
      })
      expect((await readSearchStatus(file)).state).toBe('indexed')
      await writeSearchStatus(file, {
        state: 'error',
        error: 'embed failed',
        updatedAt: '2026-09-25T18:02:00.000Z',
        sourceToken: '1:2|0:0|Ada'
      })
      expect(await readSearchStatus(file)).toMatchObject({ state: 'error', error: 'embed failed' })
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('treats a missing file as none', async () => {
    const status = await readSearchStatus(join(tmpdir(), 'meetrec-missing-search.json'))
    expect(status.state).toBe('none')
    expect(status.error).toBeNull()
  })

  it('treats garbage JSON and an unknown state as none', () => {
    expect(parseSearchStatus('{').state).toBe('none')
    expect(parseSearchStatus('{"state":"bm25"}').state).toBe('none')
    expect(parseSearchStatus('null').state).toBe('none')
  })
})
