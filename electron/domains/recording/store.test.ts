import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { recordingLayout } from './layout'
import { deleteRecording, migrateFlatWavs, scanRecordings, wavDurationMs, writeMeta } from './store'
import { emptyMeta } from './meta'

describe('flat wav migration', () => {
  const dirs: string[] = []

  afterEach(() => {
    for (const dir of dirs) rmSync(dir, { recursive: true, force: true })
    dirs.length = 0
  })

  it('moves a flat wav into a folder and writes meta', async () => {
    const root = mkdtempSync(join(tmpdir(), 'meetrec-lib-'))
    dirs.push(root)
    const id = '2026-09-22T13-58-02-629Z-ec02af'
    writeFileSync(join(root, `${id}.wav`), wavBytes(48000, 1, 16, 9600))

    const moved = await migrateFlatWavs(root)
    expect(moved).toEqual([id])

    const layout = recordingLayout(root, id)
    expect(readFileSync(layout.captureAudioPath).length).toBeGreaterThan(44)
    expect(JSON.parse(readFileSync(layout.metaPath, 'utf8')).paths.audio).toBe('audio.wav')
    const listed = await scanRecordings(root, { encode: swapInMp3 })
    expect(listed).toHaveLength(1)
    expect(listed[0]?.meta.id).toBe(id)
    expect(listed[0]?.meta.startedAt).toBe('2026-09-22T13:58:02.629Z')
    expect(listed[0]?.meta.durationMs).toBe(100)
    expect(listed[0]?.flags.hasTranscript).toBe(false)
  })

  it('leaves a folder recording in place when scanning again', async () => {
    const root = mkdtempSync(join(tmpdir(), 'meetrec-lib-'))
    dirs.push(root)
    const id = '2026-09-22T15-12-54-630Z-816c7b'
    writeFileSync(join(root, `${id}.wav`), wavBytes(16000, 1, 16, 1600))
    await migrateFlatWavs(root)
    const second = await migrateFlatWavs(root)
    expect(second).toEqual([])
    const listed = await scanRecordings(root, { encode: swapInMp3 })
    expect(listed.map((item) => item.meta.id)).toEqual([id])
    expect(listed[0]?.meta.paths.audio).toBe('audio.mp3')
    expect(readFileSync(recordingLayout(root, id).audioPath, 'utf8')).toBe('mp3')
  })

  it('keeps a wav when library encode fails', async () => {
    const root = mkdtempSync(join(tmpdir(), 'meetrec-lib-'))
    dirs.push(root)
    const id = '2026-09-22T15-12-54-630Z-816c7b'
    writeFileSync(join(root, `${id}.wav`), wavBytes(16000, 1, 16, 1600))
    await migrateFlatWavs(root)
    const layout = recordingLayout(root, id)
    const listed = await scanRecordings(root, {
      encode: async () => {
        throw new Error('ffmpeg failed')
      }
    })
    expect(listed).toHaveLength(1)
    expect(listed[0]?.meta.paths.audio).toBe('audio.wav')
    expect(readFileSync(layout.captureAudioPath).length).toBeGreaterThan(44)
    expect(() => readFileSync(layout.audioPath)).toThrow()
  })

  it('does not encode again when the mp3 is already present', async () => {
    const root = mkdtempSync(join(tmpdir(), 'meetrec-lib-'))
    dirs.push(root)
    const id = '2026-09-22T15-12-54-630Z-816c7b'
    writeFileSync(join(root, `${id}.wav`), wavBytes(16000, 1, 16, 1600))
    await migrateFlatWavs(root)
    let calls = 0
    await scanRecordings(root, {
      encode: async (wav, mp3) => {
        calls += 1
        await swapInMp3(wav, mp3)
      }
    })
    await scanRecordings(root, {
      encode: async () => {
        calls += 1
      }
    })
    expect(calls).toBe(1)
  })
})

function swapInMp3(wav: string, mp3: string): Promise<void> {
  writeFileSync(mp3, 'mp3')
  rmSync(wav)
  return Promise.resolve()
}

describe('deleteRecording', () => {
  const dirs: string[] = []

  afterEach(() => {
    for (const dir of dirs) rmSync(dir, { recursive: true, force: true })
    dirs.length = 0
  })

  it('removes the recording folder and its artifacts', async () => {
    const root = mkdtempSync(join(tmpdir(), 'meetrec-del-'))
    dirs.push(root)
    const id = '2026-09-22T13-58-02-629Z-ec02af'
    const layout = recordingLayout(root, id)
    await writeMeta(root, emptyMeta({ id, startedAt: '2026-09-22T13:58:02.629Z', durationMs: 100 }))
    writeFileSync(layout.audioPath, wavBytes(16000, 1, 16, 1600))
    writeFileSync(layout.transcriptPath, '{"text":"hi","segments":[]}\n')
    writeFileSync(layout.summaryPath, '# Notes\n')

    await deleteRecording(root, id)

    const listed = await scanRecordings(root)
    expect(listed).toHaveLength(0)
    expect(() => readFileSync(layout.audioPath)).toThrow()
    expect(() => readFileSync(layout.metaPath)).toThrow()
  })

  it('rejects an unsafe id without touching the root', async () => {
    const root = mkdtempSync(join(tmpdir(), 'meetrec-del-'))
    dirs.push(root)
    writeFileSync(join(root, 'marker.txt'), 'keep')
    await expect(deleteRecording(root, '../outside')).rejects.toThrow('Unknown recording')
    expect(readFileSync(join(root, 'marker.txt'), 'utf8')).toBe('keep')
  })

  it('rejects a missing recording', async () => {
    const root = mkdtempSync(join(tmpdir(), 'meetrec-del-'))
    dirs.push(root)
    await expect(deleteRecording(root, '2026-09-22T13-58-02-629Z-missing')).rejects.toThrow(
      'Recording not found'
    )
  })
})

describe('wavDurationMs', () => {
  it('reads duration from a PCM wav header', () => {
    expect(wavDurationMs(wavBytes(48000, 2, 16, 96000))).toBe(500)
  })

  it('returns 0 for a short buffer', () => {
    expect(wavDurationMs(Buffer.from('RIFF'))).toBe(0)
  })
})

function wavBytes(sampleRate: number, channels: number, bits: number, dataBytes: number): Buffer {
  const buffer = Buffer.alloc(44 + 8)
  buffer.write('RIFF', 0)
  buffer.writeUInt32LE(36 + dataBytes, 4)
  buffer.write('WAVE', 8)
  buffer.write('fmt ', 12)
  buffer.writeUInt32LE(16, 16)
  buffer.writeUInt16LE(1, 20)
  buffer.writeUInt16LE(channels, 22)
  buffer.writeUInt32LE(sampleRate, 24)
  buffer.writeUInt32LE(sampleRate * channels * (bits / 8), 28)
  buffer.writeUInt16LE(channels * (bits / 8), 32)
  buffer.writeUInt16LE(bits, 34)
  buffer.write('data', 36)
  buffer.writeUInt32LE(dataBytes, 40)
  return buffer
}
