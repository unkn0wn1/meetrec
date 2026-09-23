import { describe, expect, it } from 'vitest'
import { validateXaiApiKey } from './xai-ping'

function fakeFetch(status: number, body = ''): typeof fetch {
  return (async () =>
    new Response(body, { status, headers: { 'Content-Type': 'application/json' } })) as typeof fetch
}

describe('validateXaiApiKey', () => {
  it('accepts a key when the speech endpoint asks for a file', async () => {
    const result = await validateXaiApiKey({
      apiKey: 'good-key',
      fetchImpl: fakeFetch(400, JSON.stringify({ error: 'file is required' }))
    })
    expect(result.ok).toBe(true)
  })

  it('rejects an unauthorized key', async () => {
    const result = await validateXaiApiKey({
      apiKey: 'bad-key',
      fetchImpl: fakeFetch(401, JSON.stringify({ error: 'Incorrect API key provided' }))
    })
    expect(result.ok).toBe(false)
    expect(result.message).toContain('rejected')
  })

  it('rejects a missing key without calling the network', async () => {
    const result = await validateXaiApiKey({ apiKey: '   ' })
    expect(result).toEqual({ ok: false, message: 'No xAI credentials are configured.' })
  })
})
