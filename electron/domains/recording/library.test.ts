import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { LibraryService } from './library'
import { recordingLayout } from './layout'
import { emptyMeta } from './meta'
import { scanRecordings, writeMeta } from './store'

describe('LibraryService.delete', () => {
  const dirs: string[] = []

  afterEach(() => {
    for (const dir of dirs) rmSync(dir, { recursive: true, force: true })
    dirs.length = 0
  })

  it('deletes a known recording folder', async () => {
    const root = mkdtempSync(join(tmpdir(), 'meetrec-lib-del-'))
    dirs.push(root)
    const id = '2026-09-24T10-00-00-000Z-abcdef'
    const layout = recordingLayout(root, id)
    await writeMeta(root, emptyMeta({ id, startedAt: '2026-09-24T10:00:00.000Z' }))
    writeFileSync(layout.audioPath, 'wav')
    const service = new LibraryService(() => root)

    await service.delete(id)

    expect(await scanRecordings(root)).toHaveLength(0)
    expect(() => readFileSync(layout.metaPath)).toThrow()
  })

  it('rejects an unknown id', async () => {
    const root = mkdtempSync(join(tmpdir(), 'meetrec-lib-del-'))
    dirs.push(root)
    const service = new LibraryService(() => root)
    await expect(service.delete('not-a-real-id')).rejects.toThrow()
  })
})
