import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LIBRARY_MP3_BITRATE } from '../recording/encode-mp3'
import { STT_UPLOAD_MAX_BYTES } from './stt-chunk'
import {
  STT_BITRATE,
  STT_EXT,
  STT_MIME,
  STT_SAMPLE_RATE,
  prepareSttUpload,
  sttPrepareArgs
} from './stt-prepare'
import { openAiErrorMessage } from './openai-stt'
import { sttErrorMessage } from './xai-stt'

describe('sttPrepareArgs', () => {
  it('downmixes to mono 16 kHz MP3 for upload', () => {
    expect(sttPrepareArgs('/rec/audio.wav', '/tmp/audio.mp3')).toEqual([
      '-hide_banner',
      '-y',
      '-i',
      '/rec/audio.wav',
      '-ac',
      '1',
      '-ar',
      String(STT_SAMPLE_RATE),
      '-c:a',
      'libmp3lame',
      '-b:a',
      STT_BITRATE,
      '/tmp/audio.mp3'
    ])
    expect(STT_MIME).toBe('audio/mpeg')
    expect(STT_EXT).toBe('mp3')
  })
})

describe('prepareSttUpload library mp3', () => {
  const dirs: string[] = []

  afterEach(() => {
    for (const dir of dirs) rmSync(dir, { recursive: true, force: true })
    dirs.length = 0
  })

  it('does not re-encode a library mp3 or delete it', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'meetrec-stt-lib-'))
    dirs.push(dir)
    const audioPath = join(dir, 'audio.mp3')
    writeFileSync(audioPath, 'id3')
    const runFfmpeg = vi.fn(async () => {})
    const prepared = await prepareSttUpload(audioPath, {
      runFfmpeg,
      stat: async () => ({ size: 100, isFile: () => true })
    })
    expect(runFfmpeg).not.toHaveBeenCalled()
    expect(prepared.path).toBe(audioPath)
    expect(prepared.mimeType).toBe(STT_MIME)
    expect(prepared.fileName).toBe('audio.mp3')
    expect(prepared.bitrate).toBe(LIBRARY_MP3_BITRATE)
    await prepared.cleanup()
    expect(readFileSync(audioPath, 'utf8')).toBe('id3')
  })

  it('copies a library mp3 over 24 MB into a temp dir for splitting', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'meetrec-stt-lib-'))
    dirs.push(dir)
    const audioPath = join(dir, 'audio.mp3')
    writeFileSync(audioPath, 'id3')
    const runFfmpeg = vi.fn(async () => {})
    const prepared = await prepareSttUpload(audioPath, {
      runFfmpeg,
      stat: async () => ({ size: STT_UPLOAD_MAX_BYTES + 1, isFile: () => true })
    })
    expect(runFfmpeg).not.toHaveBeenCalled()
    expect(prepared.path).not.toBe(audioPath)
    expect(prepared.bitrate).toBe(LIBRARY_MP3_BITRATE)
    expect(prepared.fileName).toBe('audio.mp3')
    expect(readFileSync(prepared.path, 'utf8')).toBe('id3')
    await prepared.cleanup()
    expect(readFileSync(audioPath, 'utf8')).toBe('id3')
    expect(() => readFileSync(prepared.path)).toThrow()
  })
})

describe('STT payload errors', () => {
  it('maps xAI 413 to a clear size message without Cloudflare HTML', () => {
    const html = '<html><title>413 Payload Too Large</title>cloudflare</html>'
    expect(sttErrorMessage(413, html)).toContain('too large')
    expect(sttErrorMessage(413, html)).not.toContain('cloudflare')
  })

  it('maps OpenAI 413 to a clear size message', () => {
    expect(openAiErrorMessage(413, 'Payload Too Large', 'Speech-to-text')).toContain('25 MB')
  })
})
