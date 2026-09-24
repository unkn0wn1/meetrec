import { describe, expect, it } from 'vitest'
import { OPENAI_CHAT_URL, OPENAI_STT_URL, XAI_STT_URL } from './models'
import { probeAi, probeVoice } from './probes'

function fakeFetch(
  status: number,
  body = '',
  url = ''
): { fetchImpl: typeof fetch; calls: string[]; inits: RequestInit[] } {
  const calls: string[] = []
  const inits: RequestInit[] = []
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push(String(input))
    inits.push(init ?? {})
    expect(url === '' || String(input) === url).toBe(true)
    return new Response(body, { status })
  }) as typeof fetch
  return { fetchImpl, calls, inits }
}

async function expectProbeFile(init: RequestInit, model: string): Promise<void> {
  expect(init.body).toBeInstanceOf(FormData)
  const form = init.body as FormData
  expect(form.get('model')).toBe(model)
  const file = form.get('file')
  expect(file).toBeInstanceOf(Blob)
  const blob = file as Blob
  expect(blob.type).toBe('audio/wav')
  expect(blob.size).toBeGreaterThan(44)
  const bytes = new Uint8Array(await blob.arrayBuffer())
  expect(String.fromCharCode(bytes[0] ?? 0, bytes[1] ?? 0, bytes[2] ?? 0, bytes[3] ?? 0)).toBe(
    'RIFF'
  )
  const headers = new Headers(init.headers)
  expect(headers.get('content-type')).toBeNull()
  expect(headers.get('authorization')).toMatch(/^Bearer /)
}

describe('role probes', () => {
  it('passes an xAI voice check that accepts the sample', async () => {
    const fake = fakeFetch(200, '{"text":""}', XAI_STT_URL)
    const result = await probeVoice({
      family: 'xai',
      model: 'grok-voice-transcribe-2.0',
      token: 'good-key',
      supported: true,
      missingMessage: 'missing',
      fetchImpl: fake.fetchImpl
    })
    expect(result).toEqual({ state: 'pass', message: 'Voice check passed.' })
    expect(fake.calls).toEqual([XAI_STT_URL])
    await expectProbeFile(fake.inits[0] ?? {}, 'grok-voice-transcribe-2.0')
  })

  it('fails an xAI voice check that still asks for a file', async () => {
    const fake = fakeFetch(400, JSON.stringify({ error: 'file is required' }), XAI_STT_URL)
    const result = await probeVoice({
      family: 'xai',
      model: 'grok-voice-transcribe-2.0',
      token: 'good-key',
      supported: true,
      missingMessage: 'missing',
      fetchImpl: fake.fetchImpl
    })
    expect(result.state).toBe('fail')
    expect(result.message).toContain('400')
    expect(result.message).not.toContain('file is required')
    await expectProbeFile(fake.inits[0] ?? {}, 'grok-voice-transcribe-2.0')
  })

  it('fails an xAI voice check on 401 without the response body', async () => {
    const fake = fakeFetch(401, 'secret-key-in-body')
    const result = await probeVoice({
      family: 'xai',
      model: 'grok-voice-transcribe-2.0',
      token: 'bad-key',
      supported: true,
      missingMessage: 'missing',
      fetchImpl: fake.fetchImpl
    })
    expect(result.state).toBe('fail')
    expect(result.message).toContain('401')
    expect(result.message).not.toContain('secret-key-in-body')
  })

  it('does not call the network when voice credentials are missing', async () => {
    const fake = fakeFetch(200)
    const result = await probeVoice({
      family: 'xai',
      model: 'grok-voice-transcribe-2.0',
      token: '   ',
      supported: true,
      missingMessage: 'Add a working xAI API key in Settings.',
      fetchImpl: fake.fetchImpl
    })
    expect(result).toEqual({
      state: 'fail',
      message: 'Add a working xAI API key in Settings.'
    })
    expect(fake.calls).toEqual([])
  })

  it('passes an OpenAI voice check on HTTP 200 and rejects a bare multipart 400', async () => {
    const ok = fakeFetch(200, '{"text":""}', OPENAI_STT_URL)
    const passed = await probeVoice({
      family: 'openai',
      model: 'gpt-4o-transcribe-diarize',
      token: 'oa',
      supported: true,
      missingMessage: 'missing',
      fetchImpl: ok.fetchImpl
    })
    expect(passed.state).toBe('pass')
    expect(ok.calls).toEqual([OPENAI_STT_URL])
    await expectProbeFile(ok.inits[0] ?? {}, 'gpt-4o-transcribe-diarize')

    const missing = fakeFetch(400, 'multipart form required', OPENAI_STT_URL)
    const result = await probeVoice({
      family: 'openai',
      model: 'gpt-4o-transcribe-diarize',
      token: 'oa',
      supported: true,
      missingMessage: 'missing',
      fetchImpl: missing.fetchImpl
    })
    expect(result.state).toBe('fail')
    expect(result.message).toContain('400')
    expect(result.message).not.toContain('multipart form required')
  })

  it('passes an AI check on HTTP 200 and hides a failure body', async () => {
    const ok = fakeFetch(200, '{"choices":[]}', OPENAI_CHAT_URL)
    const passed = await probeAi({
      family: 'openai',
      model: 'gpt-4.1-mini',
      token: 'oa',
      supported: true,
      missingMessage: 'missing',
      fetchImpl: ok.fetchImpl
    })
    expect(passed).toEqual({ state: 'pass', message: 'AI check passed.' })

    const failed = fakeFetch(500, 'upstream secret')
    const result = await probeAi({
      family: 'xai',
      model: 'grok-4.5',
      token: 'xai',
      supported: true,
      missingMessage: 'missing',
      fetchImpl: failed.fetchImpl
    })
    expect(result.state).toBe('fail')
    expect(result.message).toContain('500')
    expect(result.message).not.toContain('upstream secret')
  })

  it('reports an unsupported role without calling fetch', async () => {
    const fake = fakeFetch(200)
    const result = await probeVoice({
      family: 'openai',
      model: 'gpt-4o-transcribe-diarize',
      token: 'oa',
      supported: false,
      missingMessage: 'missing',
      fetchImpl: fake.fetchImpl
    })
    expect(result).toEqual({
      state: 'na',
      message: 'This provider does not transcribe.'
    })
    expect(fake.calls).toEqual([])
  })
})
