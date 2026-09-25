import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LibraryService } from './library'
import { recordingLayout } from './layout'
import { emptyMeta, type RecordingUploads } from './meta'
import { scanRecordings, writeMeta } from './store'

describe('LibraryService.detail audio url', () => {
  const dirs: string[] = []

  afterEach(() => {
    for (const dir of dirs) rmSync(dir, { recursive: true, force: true })
    dirs.length = 0
  })

  it('points playback at audio.mp3 when that file is present', async () => {
    const root = mkdtempSync(join(tmpdir(), 'meetrec-lib-url-'))
    dirs.push(root)
    const id = '2026-09-24T10-00-00-000Z-abcdef'
    const layout = recordingLayout(root, id)
    await writeMeta(root, emptyMeta({ id, startedAt: '2026-09-24T10:00:00.000Z' }))
    writeFileSync(layout.audioPath, 'mp3')
    const detail = await new LibraryService(() => root).detail(id)
    expect(detail.audioUrl).toBe(`meetrec://recording/${encodeURIComponent(id)}/audio.mp3`)
  })
})

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

describe('LibraryService.delete cloud flag', () => {
  const dirs: string[] = []
  const driveUploads: RecordingUploads = {
    google: { folderId: 'folder-1', files: { audio: 'file-a' } }
  }

  afterEach(() => {
    for (const dir of dirs) rmSync(dir, { recursive: true, force: true })
    dirs.length = 0
  })

  async function seed(root: string, uploads?: RecordingUploads): Promise<string> {
    const id = '2026-09-24T10-00-00-000Z-abcdef'
    const layout = recordingLayout(root, id)
    const meta = emptyMeta({ id, startedAt: '2026-09-24T10:00:00.000Z' })
    if (uploads) meta.uploads = uploads
    await writeMeta(root, meta)
    writeFileSync(layout.audioPath, 'wav')
    return id
  }

  function rootDir(): string {
    const root = mkdtempSync(join(tmpdir(), 'meetrec-lib-cloud-'))
    dirs.push(root)
    return root
  }

  it('deletes the local folder and skips cloud when the flag is omitted', async () => {
    const root = rootDir()
    const id = await seed(root, driveUploads)
    const removeCloudCopies = vi.fn(async () => {})
    const service = new LibraryService(() => root, unusedAuth, removeCloudCopies)

    await service.delete(id)

    expect(removeCloudCopies).not.toHaveBeenCalled()
    expect(await scanRecordings(root)).toHaveLength(0)
  })

  it('removes cloud copies before the local folder when asked', async () => {
    const root = rootDir()
    const id = await seed(root, driveUploads)
    const removeCloudCopies = vi.fn(async () => {})
    const service = new LibraryService(() => root, unusedAuth, removeCloudCopies)

    await service.delete(id, { removeCloud: true })

    expect(removeCloudCopies).toHaveBeenCalledOnce()
    expect(removeCloudCopies).toHaveBeenCalledWith(driveUploads)
    expect(await scanRecordings(root)).toHaveLength(0)
  })

  it('keeps the local folder when cloud removal fails', async () => {
    const root = rootDir()
    const id = await seed(root, driveUploads)
    const layout = recordingLayout(root, id)
    const removeCloudCopies = vi.fn(async () => {
      throw new Error(
        'Cloud copies could not be removed, so the recording on this computer was kept.'
      )
    })
    const service = new LibraryService(() => root, unusedAuth, removeCloudCopies)

    await expect(service.delete(id, { removeCloud: true })).rejects.toThrow(
      'recording on this computer was kept'
    )
    expect(readFileSync(layout.metaPath, 'utf8')).toContain(id)
    expect(readFileSync(layout.audioPath, 'utf8')).toBe('wav')
  })

  it('skips cloud when the flag is on but no file ids are stored', async () => {
    const root = rootDir()
    const id = await seed(root, { google: { folderId: 'folder-1', files: {} } })
    const removeCloudCopies = vi.fn(async () => {})
    const service = new LibraryService(() => root, unusedAuth, removeCloudCopies)

    await service.delete(id, { removeCloud: true })

    expect(removeCloudCopies).not.toHaveBeenCalled()
    expect(await scanRecordings(root)).toHaveLength(0)
  })

  it('fails closed when cloud delete was not wired', async () => {
    const root = rootDir()
    const id = await seed(root, driveUploads)
    const layout = recordingLayout(root, id)
    const service = new LibraryService(() => root)

    await expect(service.delete(id, { removeCloud: true })).rejects.toThrow(
      'Cloud delete is not available.'
    )
    expect(readFileSync(layout.metaPath, 'utf8')).toContain(id)
  })
})

function unusedAuth(): Promise<never> {
  return Promise.reject(new Error('unused'))
}
