import { describe, expect, it } from 'vitest'
import { STT_BITRATE, STT_EXT, STT_MIME, STT_SAMPLE_RATE, sttPrepareArgs } from './stt-prepare'
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
