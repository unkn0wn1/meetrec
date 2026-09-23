import { XAI_STT_URL } from './models'

export const PING_STT_URL = XAI_STT_URL

export interface XaiValidation {
  ok: boolean
  message: string
}

export async function validateXaiApiKey(input: {
  apiKey: string
  fetchImpl?: typeof fetch
}): Promise<XaiValidation> {
  const key = input.apiKey.trim()
  if (!key) {
    return { ok: false, message: 'No xAI credentials are configured.' }
  }
  const fetchImpl = input.fetchImpl ?? fetch
  try {
    const response = await fetchImpl(PING_STT_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}` }
    })
    const body = await response.text()
    if (response.ok || acceptedWithoutFile(response.status, body)) {
      return { ok: true, message: 'xAI accepted the credentials.' }
    }
    if (response.status === 400 || response.status === 401 || response.status === 403) {
      return { ok: false, message: 'xAI rejected the credentials.' }
    }
    return { ok: false, message: `xAI credential check failed (${response.status}).` }
  } catch {
    return { ok: false, message: 'Could not reach api.x.ai to check the credentials.' }
  }
}

export function acceptedWithoutFile(status: number, body: string): boolean {
  if (status !== 400) return false
  const text = body.toLowerCase()
  return text.includes('file') || text.includes('audio') || text.includes('multipart')
}
