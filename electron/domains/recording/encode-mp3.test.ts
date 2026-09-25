import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  LIBRARY_MP3_BITRATE,
  LIBRARY_MP3_FAILURE,
  encodeWavToLibraryMp3,
  libraryMp3Args,
  libraryMp3ProbeArgs,
  resolveLibraryAudio
} from './encode-mp3'
import { libraryAudioContentType } from './layout'

const dirs: string[] = []

afterEach(() => {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true })
  dirs.length = 0
})

function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'meetrec-mp3-'))
  dirs.push(dir)
  return dir
}

describe('libraryMp3Args', () => {
  it('encodes 96 kbps and keeps the wav channel count and sample rate', () => {
    const args = libraryMp3Args('/rec/audio.wav', '/rec/audio.mp3.partial')
    expect(args).toEqual([
      '-hide_banner',
      '-y',
      '-i',
      '/rec/audio.wav',
      '-c:a',
      'libmp3lame',
      '-b:a',
      LIBRARY_MP3_BITRATE,
      '/rec/audio.mp3.partial'
    ])
    expect(args).not.toContain('-ac')
    expect(args).not.toContain('-ar')
    expect(libraryMp3ProbeArgs('/rec/audio.mp3.partial')).toEqual([
      '-hide_banner',
      '-v',
      'error',
      '-i',
      '/rec/audio.mp3.partial',
      '-t',
      '0.05',
      '-f',
      'null',
      '-'
    ])
  })
})

describe('encodeWavToLibraryMp3', () => {
  function paths(dir: string): { wav: string; mp3: string; partial: string } {
    return {
      wav: join(dir, 'audio.wav'),
      mp3: join(dir, 'audio.mp3'),
      partial: join(dir, 'audio.mp3.partial')
    }
  }

  it('renames a verified partial into place and deletes the wav', async () => {
    const dir = tempDir()
    const { wav, mp3, partial } = paths(dir)
    writeFileSync(wav, 'pcm')
    const runFfmpeg = vi.fn(async (_ffmpeg: string, args: string[]) => {
      if (args.includes('libmp3lame')) writeFileSync(args.at(-1) ?? '', Buffer.from([1, 2, 3, 4]))
    })

    await encodeWavToLibraryMp3(wav, mp3, {
      resolveFfmpeg: async () => 'ffmpeg',
      runFfmpeg
    })

    expect(readFileSync(mp3)).toEqual(Buffer.from([1, 2, 3, 4]))
    expect(statSync(mp3).size).toBeGreaterThan(0)
    expect(() => readFileSync(wav)).toThrow()
    expect(() => readFileSync(partial)).toThrow()
    expect(runFfmpeg).toHaveBeenCalledTimes(2)
  })

  it('keeps the wav when the encoder throws', async () => {
    const dir = tempDir()
    const { wav, mp3, partial } = paths(dir)
    writeFileSync(wav, 'pcm')

    await expect(
      encodeWavToLibraryMp3(wav, mp3, {
        resolveFfmpeg: async () => 'ffmpeg',
        runFfmpeg: async () => {
          throw new Error('encode failed')
        }
      })
    ).rejects.toThrow('encode failed')

    expect(readFileSync(wav, 'utf8')).toBe('pcm')
    expect(() => readFileSync(mp3)).toThrow()
    expect(() => readFileSync(partial)).toThrow()
  })

  it('keeps the wav when the probe throws', async () => {
    const dir = tempDir()
    const { wav, mp3, partial } = paths(dir)
    writeFileSync(wav, 'pcm')

    await expect(
      encodeWavToLibraryMp3(wav, mp3, {
        resolveFfmpeg: async () => 'ffmpeg',
        runFfmpeg: async (_ffmpeg: string, args: string[]) => {
          if (args.includes('libmp3lame')) {
            writeFileSync(args.at(-1) ?? '', Buffer.from([1, 2, 3]))
            return
          }
          throw new Error('probe failed')
        }
      })
    ).rejects.toThrow('probe failed')

    expect(readFileSync(wav, 'utf8')).toBe('pcm')
    expect(() => readFileSync(mp3)).toThrow()
    expect(() => readFileSync(partial)).toThrow()
  })

  it('refuses an empty wav before ffmpeg', async () => {
    const dir = tempDir()
    const { wav, mp3 } = paths(dir)
    writeFileSync(wav, '')
    const runFfmpeg = vi.fn()

    await expect(
      encodeWavToLibraryMp3(wav, mp3, {
        resolveFfmpeg: async () => 'ffmpeg',
        runFfmpeg
      })
    ).rejects.toThrow(LIBRARY_MP3_FAILURE)
    expect(runFfmpeg).not.toHaveBeenCalled()
    expect(readFileSync(wav).length).toBe(0)
  })
})

describe('resolveLibraryAudio', () => {
  it('prefers a non-empty mp3 and otherwise a wav', async () => {
    const dir = tempDir()
    writeFileSync(join(dir, 'audio.wav'), 'wav')
    writeFileSync(join(dir, 'audio.mp3.partial'), 'partial')
    expect((await resolveLibraryAudio(dir))?.fileName).toBe('audio.wav')

    writeFileSync(join(dir, 'audio.mp3'), '')
    expect((await resolveLibraryAudio(dir))?.fileName).toBe('audio.wav')

    writeFileSync(join(dir, 'audio.mp3'), 'mp3')
    const chosen = await resolveLibraryAudio(dir)
    expect(chosen?.fileName).toBe('audio.mp3')
    expect(chosen?.mime).toBe('audio/mpeg')
    expect(chosen?.path).toBe(join(dir, 'audio.mp3'))
  })

  it('returns null when both library files are missing', async () => {
    expect(await resolveLibraryAudio(tempDir())).toBeNull()
  })
})

describe('libraryAudioContentType', () => {
  it('allows mp3 and wav and rejects the partial and paths', () => {
    expect(libraryAudioContentType('audio.mp3')).toBe('audio/mpeg')
    expect(libraryAudioContentType('audio.wav')).toBe('audio/wav')
    expect(libraryAudioContentType('audio.mp3.partial')).toBeNull()
    expect(libraryAudioContentType('../audio.mp3')).toBeNull()
  })
})
