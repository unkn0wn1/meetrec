import { describe, expect, it } from 'vitest'
import { OPENAI_CHAT_URL, OPENAI_STT_URL, XAI_STT_URL } from './models'
import { probeAi, probeVoice } from './probes'

function fakeFetch(
  status: number,
  body = '',
  url = ''
): { fetchImpl: typeof fetch; calls: string[] } {
  const calls: string[] = []
  const fetchImpl = (async (input: RequestInfo | URL) => {
    calls.push(String(input))
    expect(url === '' || String(input) === url).toBe(true)
    return new Response(body, { status })
  }) as typeof fetch
  return { fetchImpl, calls }
}

describe('role probes', () => {
  it('accepts an xAI voice check that asks for a file', async () => {
    const fake = fakeFetch(400, JSON.stringify({ error: 'file is required' }), XAI_STT_URL)
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

  it('accepts an OpenAI voice check that asks for multipart', async () => {
    const fake = fakeFetch(400, 'multipart form required', OPENAI_STT_URL)
    const result = await probeVoice({
      family: 'openai',
      model: 'gpt-4o-transcribe-diarize',
      token: 'oa',
      supported: true,
      missingMessage: 'missing',
      fetchImpl: fake.fetchImpl
    })
    expect(result.state).toBe('pass')
    expect(fake.calls).toEqual([OPENAI_STT_URL])
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
