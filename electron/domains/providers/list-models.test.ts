import { describe, expect, it } from 'vitest'
import { OPENAI_CHAT_MODEL, OPENAI_MODELS_URL, OPENAI_STT_MODEL } from './models'
import { listProviderModels, parseModelIds, splitModelIds } from './list-models'

describe('model catalog parsing', () => {
  it('keeps OpenAI id order, trims, dedupes, and drops bad entries', () => {
    expect(
      parseModelIds(
        JSON.stringify({
          object: 'list',
          data: [
            { id: ' gpt-4.1 ' },
            { id: 'gpt-4.1' },
            { id: '' },
            { id: '   ' },
            { id: 4 },
            { name: 'nope' },
            { id: 'whisper-1' }
          ]
        })
      )
    ).toEqual(['gpt-4.1', 'whisper-1'])
  })

  it('parses an xAI data list and a models list', () => {
    expect(parseModelIds(JSON.stringify({ data: [{ id: 'grok-4.5' }, { id: 'grok-4' }] }))).toEqual(
      ['grok-4.5', 'grok-4']
    )
    expect(
      parseModelIds(JSON.stringify({ models: [{ id: 'grok-4.5' }, { id: 'grok-4' }] }))
    ).toEqual(['grok-4.5', 'grok-4'])
  })

  it('returns null when the body is not a model list', () => {
    expect(parseModelIds('not-json')).toBeNull()
    expect(parseModelIds('null')).toBeNull()
    expect(parseModelIds('{"object":"list"}')).toBeNull()
  })
})

describe('model catalog split', () => {
  it('splits OpenAI transcription ids from chat ids and drops the rest', () => {
    const split = splitModelIds('openai', [
      'gpt-4o-transcribe-diarize',
      'whisper-1',
      'gpt-4.1-mini',
      'o4-mini',
      'text-embedding-3-small',
      'dall-e-3',
      'tts-1',
      'gpt-4o-realtime-preview'
    ])
    expect(split.voice).toEqual(['gpt-4o-transcribe-diarize', 'whisper-1'])
    expect(split.ai).toEqual(['gpt-4.1-mini', 'o4-mini'])
  })

  it('adds a registry seed only when that id was in the catalog', () => {
    const split = splitModelIds('openai', ['gpt-4.1', 'whisper-1'])
    expect(split.voice).toEqual(['whisper-1'])
    expect(split.voice).not.toContain(OPENAI_STT_MODEL)
    expect(split.ai).toEqual(['gpt-4.1'])
    expect(split.ai).not.toContain(OPENAI_CHAT_MODEL)
  })

  it('gives both roles the full list when no id matches either filter', () => {
    expect(splitModelIds('openai', ['custom-foo'])).toEqual({
      voice: ['custom-foo'],
      ai: ['custom-foo']
    })
  })

  it('keeps a chat-only xAI catalog out of Voice', () => {
    const split = splitModelIds('xai', ['grok-4.5', 'grok-4.7', 'grok-voice-latest'])
    expect(split.voice).toEqual([])
    expect(split.voice).not.toContain('grok-voice-latest')
    expect(split.ai).toEqual(['grok-4.5', 'grok-4.7', 'grok-voice-latest'])
  })

  it('puts grok-voice-transcribe ids on Voice', () => {
    const split = splitModelIds('xai', ['grok-4.5', 'grok-voice-transcribe-2.0'])
    expect(split.voice).toEqual(['grok-voice-transcribe-2.0'])
    expect(split.ai).toEqual(['grok-4.5'])
  })
})

describe('listProviderModels', () => {
  it('GETs the OpenAI catalog and splits the ids', async () => {
    const fetchImpl = (async (input: RequestInfo | URL) => {
      expect(String(input)).toBe(OPENAI_MODELS_URL)
      return new Response(JSON.stringify({ data: [{ id: 'whisper-1' }, { id: 'gpt-4.1-mini' }] }), {
        status: 200
      })
    }) as typeof fetch
    await expect(listProviderModels({ family: 'openai', token: 'oa', fetchImpl })).resolves.toEqual(
      { voice: ['whisper-1'], ai: ['gpt-4.1-mini'] }
    )
  })

  it('returns null on HTTP failure and does not surface the body', async () => {
    const token = 'secret-key-value'
    let calls = 0
    const fetchImpl = (async () => {
      calls += 1
      return new Response(`denied ${token}`, { status: 401 })
    }) as typeof fetch
    const result = await listProviderModels({ family: 'xai', token, fetchImpl })
    expect(result).toBeNull()
    expect(JSON.stringify(result)).not.toContain(token)
    expect(calls).toBe(1)
  })

  it('does not call fetch without a token', async () => {
    let calls = 0
    const fetchImpl = (async () => {
      calls += 1
      return new Response('{}', { status: 200 })
    }) as typeof fetch
    await expect(
      listProviderModels({ family: 'openai', token: '   ', fetchImpl })
    ).resolves.toBeNull()
    expect(calls).toBe(0)
  })
})
