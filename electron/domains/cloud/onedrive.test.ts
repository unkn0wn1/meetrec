import { describe, expect, it } from 'vitest'
import { CloudHttpError } from './google-drive'
import {
  chunkIsAligned,
  deleteOneDriveItem,
  onedriveChunkRanges,
  oneDriveDeleteUrl,
  uploadSessionUrl
} from './onedrive'
import { ONEDRIVE_CHUNK_BYTES, ONEDRIVE_QUANTUM_BYTES } from './ranges'

describe('onedrive upload', () => {
  it('encodes the file name inside the approot upload-session path', () => {
    const url = uploadSessionUrl('2026-09-23 standup/audio.wav')
    expect(url).toBe(
      'https://graph.microsoft.com/v1.0/me/drive/special/approot:/2026-09-23%20standup%2Faudio.wav:/createUploadSession'
    )
    expect(url).toContain('/me/drive/special/approot:/')
  })

  it('uses chunks that are multiples of 320 KiB', () => {
    expect(ONEDRIVE_CHUNK_BYTES % ONEDRIVE_QUANTUM_BYTES).toBe(0)
    const size = ONEDRIVE_CHUNK_BYTES + 100
    const ranges = onedriveChunkRanges(size)
    expect(ranges[0]!.end - ranges[0]!.start + 1).toBe(ONEDRIVE_CHUNK_BYTES)
    expect(chunkIsAligned(ranges[0]!, size)).toBe(true)
    expect(chunkIsAligned(ranges[1]!, size)).toBe(true)
    expect(ranges[1]!.end - ranges[1]!.start + 1).toBe(100)
  })
})

describe('oneDrive delete', () => {
  it('deletes an item id and an artifact name under approot', () => {
    expect(oneDriveDeleteUrl('abc')).toBe('https://graph.microsoft.com/v1.0/me/drive/items/abc')
    expect(oneDriveDeleteUrl('note.wav')).toBe(
      'https://graph.microsoft.com/v1.0/me/drive/special/approot:/note.wav'
    )
    expect(oneDriveDeleteUrl('my file.wav')).toBe(
      'https://graph.microsoft.com/v1.0/me/drive/special/approot:/my%20file.wav'
    )
  })

  it('rejects empty ids and path characters before calling the network', () => {
    expect(() => oneDriveDeleteUrl('')).toThrow('That cloud file id is not valid.')
    expect(() => oneDriveDeleteUrl('../x')).toThrow('That cloud file id is not valid.')
    expect(() => oneDriveDeleteUrl('a/b')).toThrow('That cloud file id is not valid.')
    expect(() => oneDriveDeleteUrl('a\\b')).toThrow('That cloud file id is not valid.')
  })

  it('treats 204 and 404 as success', async () => {
    for (const status of [204, 404]) {
      const calls: { url: string; method: string; authorization: string }[] = []
      const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
        const headers = init?.headers as Record<string, string>
        calls.push({
          url: String(input),
          method: init?.method ?? '',
          authorization: headers.Authorization
        })
        return new Response(null, { status })
      }) as typeof fetch
      await deleteOneDriveItem({ accessToken: 'test-token', fileId: 'item-1', fetchImpl })
      expect(calls[0]).toEqual({
        url: oneDriveDeleteUrl('item-1'),
        method: 'DELETE',
        authorization: 'Bearer test-token'
      })
    }
  })

  it('throws CloudHttpError for 403 and 401', async () => {
    const denied = (async () => new Response('{}', { status: 403 })) as typeof fetch
    await expect(
      deleteOneDriveItem({ accessToken: 'test-token', fileId: 'item-1', fetchImpl: denied })
    ).rejects.toBeInstanceOf(CloudHttpError)
    const expired = (async () => new Response('{}', { status: 401 })) as typeof fetch
    await expect(
      deleteOneDriveItem({ accessToken: 'test-token', fileId: 'item-1', fetchImpl: expired })
    ).rejects.toMatchObject({ status: 401 })
  })
})
