import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { OPENAI_STT_URL } from './models'
import { documentFromOpenAi, postOpenAiTranscription, segmentsFromDiarized } from './openai-stt'
import { transcribeChunks } from './stt-chunk'
import { pieceFromDiarizedPayload } from './stt-stitch'

describe('OpenAI diarized transcript', () => {
  it('maps speaker letters onto Speaker 1 and Speaker 2', () => {
    const segments = segmentsFromDiarized({
      text: 'Hello there',
      segments: [
        { speaker: 'A', start: 0, end: 1.2, text: 'Hello' },
        { speaker: 'B', start: 1.2, end: 2, text: 'there' },
        { speaker: 'A', start: 2, end: 3, text: 'again' }
      ]
    })
    expect(segments.map((segment) => segment.speakerLabel)).toEqual([
      'Speaker 1',
      'Speaker 2',
      'Speaker 1'
    ])
    expect(segments[0]?.speakerId).toBe('speaker-1')
    expect(segments[1]?.speakerId).toBe('speaker-2')
  })

  it('keeps the joined text when diarized segments exist', () => {
    const document = documentFromOpenAi(
      {
        text: '',
        duration: 3,
        segments: [{ speaker: 'agent', start: 0, end: 1, text: 'Thanks' }]
      },
      '2026-09-23T00:00:00.000Z'
    )
    expect(document.text).toBe('Thanks')
    expect(document.model).toBe('gpt-4o-transcribe-diarize')
    expect(document.segments).toHaveLength(1)
  })
})

describe('postOpenAiTranscription', () => {
  it('posts diarized fields and calls onWaiting before fetch', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'meetrec-stt-oa-'))
    const audioPath = join(dir, 'audio.mp3')
    await writeFile(audioPath, Buffer.from('abc'))
    const order: string[] = []
    try {
      const payload = await postOpenAiTranscription({
        apiKey: 'sk-test',
        audioPath,
        model: 'gpt-4o-transcribe-diarize',
        mimeType: 'audio/mpeg',
        fileName: 'audio.mp3',
        onWaiting: () => order.push('waiting'),
        fetchImpl: (async (input, init) => {
          order.push('fetch')
          expect(String(input)).toBe(OPENAI_STT_URL)
          expect(new Headers(init?.headers).get('authorization')).toBe('Bearer sk-test')
          expect(init?.body).toBeInstanceOf(FormData)
          const form = init?.body as FormData
          expect(form.get('model')).toBe('gpt-4o-transcribe-diarize')
          expect(form.get('response_format')).toBe('diarized_json')
          expect(form.get('chunking_strategy')).toBe('auto')
          const file = form.get('file')
          expect(file).toBeInstanceOf(File)
          expect((file as File).name).toBe('audio.mp3')
          return new Response(JSON.stringify({ text: 'Hi', segments: [] }), { status: 200 })
        }) as typeof fetch
      })
      expect(payload).toEqual({ text: 'Hi', segments: [] })
      expect(order).toEqual(['waiting', 'fetch'])
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('uploads two pieces in order and shifts the second segment', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'meetrec-stt-oa-'))
    const first = join(dir, 'chunk-000.mp3')
    const second = join(dir, 'chunk-001.mp3')
    await writeFile(first, Buffer.from('one'))
    await writeFile(second, Buffer.from('two'))
    const names: string[] = []
    const phases: string[] = []
    const bodies = [
      { text: 'Hello', segments: [{ speaker: 'A', start: 0, end: 1, text: 'Hello' }] },
      { text: 'Again', segments: [{ speaker: 'A', start: 0, end: 1, text: 'Again' }] }
    ]
    try {
      const doc = await transcribeChunks({
        chunks: [
          { path: first, fileName: 'chunk-000.mp3', offsetSec: 0 },
          { path: second, fileName: 'chunk-001.mp3', offsetSec: 3666 }
        ],
        model: 'gpt-4o-transcribe-diarize',
        createdAt: '2026-09-25T00:00:00.000Z',
        timelineEndSec: 4000,
        post: (chunk, onWaiting) =>
          postOpenAiTranscription({
            apiKey: 'sk-test',
            audioPath: chunk.path,
            fileName: chunk.fileName,
            mimeType: 'audio/mpeg',
            model: 'gpt-4o-transcribe-diarize',
            onWaiting,
            fetchImpl: (async (_input, init) => {
              const form = init?.body as FormData
              const file = form.get('file')
              names.push(file instanceof File ? file.name : 'missing')
              const body = bodies[names.length - 1] ?? {}
              return new Response(JSON.stringify(body), { status: 200 })
            }) as typeof fetch
          }),
        toPiece: pieceFromDiarizedPayload,
        onProgress: (event) => phases.push(event.phase)
      })
      expect(names).toEqual(['chunk-000.mp3', 'chunk-001.mp3'])
      expect(phases).toEqual(['uploading', 'waiting', 'uploading', 'waiting'])
      expect(doc.segments.map((segment) => segment.speakerLabel)).toEqual([
        'Speaker 1',
        'Speaker 2'
      ])
      expect(doc.segments[1]).toMatchObject({ start: 3666, end: 3667, text: 'Again' })
      expect(doc.text).toBe('Hello Again')
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})
