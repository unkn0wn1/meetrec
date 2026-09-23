import { OPENAI_MODELS_URL } from './models'

export interface OpenAiValidation {
  ok: boolean
  message: string
}

export async function validateOpenAiApiKey(input: {
  apiKey: string
  fetchImpl?: typeof fetch
}): Promise<OpenAiValidation> {
  const key = input.apiKey.trim()
  if (!key) return { ok: false, message: 'No OpenAI API key is configured.' }
  const fetchImpl = input.fetchImpl ?? fetch
  try {
    const response = await fetchImpl(OPENAI_MODELS_URL, {
      method: 'GET',
      headers: { Authorization: `Bearer ${key}` }
    })
    if (response.ok) return { ok: true, message: 'OpenAI accepted the API key.' }
    if (response.status === 401 || response.status === 403) {
      return { ok: false, message: 'OpenAI rejected the API key.' }
    }
    return { ok: false, message: `OpenAI key check failed (${response.status}).` }
  } catch {
    return { ok: false, message: 'Could not reach api.openai.com to check the key.' }
  }
}
