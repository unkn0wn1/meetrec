import { describe, expect, it } from 'vitest'
import { driveChunkRanges, folderQuery, resumableMetadata, resumableTarget } from './google-drive'
import { DRIVE_CHUNK_BYTES } from './ranges'

describe('google drive upload', () => {
  it('queries the meetrec folder in My Drive', () => {
    expect(folderQuery()).toContain("name = 'meetrec'")
    expect(folderQuery()).toContain("mimeType = 'application/vnd.google-apps.folder'")
    expect(folderQuery()).toContain('trashed = false')
    expect(folderQuery()).toContain("'root' in parents")
  })

  it('sends resumable metadata for a new file and PATCH when an id exists', () => {
    const created = resumableTarget()
    expect(created.method).toBe('POST')
    expect(created.url).toContain('uploadType=resumable')
    expect(resumableMetadata('standup.wav', 'folder-1')).toEqual({
      name: 'standup.wav',
      parents: ['folder-1']
    })
    const existing = resumableTarget('file-9')
    expect(existing.method).toBe('PATCH')
    expect(existing.url).toContain('/files/file-9')
    expect(existing.url).toContain('uploadType=resumable')
    expect(resumableMetadata('standup.wav', 'folder-1', 'file-9')).toEqual({ name: 'standup.wav' })
  })

  it('splits bytes on 8 MiB boundaries', () => {
    const size = DRIVE_CHUNK_BYTES + 25
    const ranges = driveChunkRanges(size)
    expect(ranges).toEqual([
      { start: 0, end: DRIVE_CHUNK_BYTES - 1 },
      { start: DRIVE_CHUNK_BYTES, end: size - 1 }
    ])
    expect(ranges[0]!.end - ranges[0]!.start + 1).toBe(DRIVE_CHUNK_BYTES)
  })
})
