import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { XAI_STT_URL } from './models'
import { postXaiTranscription } from './xai-stt'

describe('postXaiTranscription', () => {
  it('posts diarize, language, and format without chunking_strategy', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'meetrec-stt-xai-'))
    const audioPath = join(dir, 'audio.mp3')
    await writeFile(audioPath, Buffer.from('abc'))
    try {
      const payload = await postXaiTranscription({
        apiKey: 'xai-test',
        audioPath,
        model: 'grok-voice-transcribe-2.0',
        mimeType: 'audio/mpeg',
        fileName: 'audio.mp3',
        fetchImpl: (async (input, init) => {
          expect(String(input)).toBe(XAI_STT_URL)
          expect(new Headers(init?.headers).get('authorization')).toBe('Bearer xai-test')
          expect(init?.body).toBeInstanceOf(FormData)
          const form = init?.body as FormData
          expect(form.get('model')).toBe('grok-voice-transcribe-2.0')
          expect(form.get('diarize')).toBe('true')
          expect(form.get('language')).toBe('en')
          expect(form.get('format')).toBe('true')
          expect(form.has('chunking_strategy')).toBe(false)
          return new Response(JSON.stringify({ text: 'Hi', words: [] }), { status: 200 })
        }) as typeof fetch
      })
      expect(payload).toEqual({ text: 'Hi', words: [] })
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})
