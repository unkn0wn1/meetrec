import { describe, expect, it } from 'vitest'
import { chunkIsAligned, onedriveChunkRanges, uploadSessionUrl } from './onedrive'
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
