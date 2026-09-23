import { minutesToMarkdown, parseMinutesJson, type MinutesDraft } from '../minutes/markdown'
import { XAI_CHAT_URL } from './models'

export const CHAT_URL = XAI_CHAT_URL

export async function completeMinutes(input: {
  apiKey: string
  prompt: string
  model: string
  fetchImpl?: typeof fetch
}): Promise<{ draft: MinutesDraft; markdown: string }> {
  const fetchImpl = input.fetchImpl ?? fetch
  const response = await fetchImpl(CHAT_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: input.model,
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content: 'You extract meeting minutes. Reply with a single JSON object and nothing else.'
        },
        { role: 'user', content: input.prompt }
      ]
    })
  })
  const raw = await response.text()
  if (!response.ok) {
    throw new Error(chatErrorMessage(response.status, raw))
  }
  const content = messageContent(raw)
  const draft = parseMinutesJson(content)
  if (!draft) {
    throw new Error('The summary model did not return minutes JSON.')
  }
  return { draft, markdown: minutesToMarkdown(draft) }
}

export function messageContent(raw: string): string {
  let payload: unknown
  try {
    payload = JSON.parse(raw)
  } catch {
    return raw
  }
  if (!payload || typeof payload !== 'object') return raw
  const choices = (payload as { choices?: unknown }).choices
  if (!Array.isArray(choices) || !choices[0] || typeof choices[0] !== 'object') return raw
  const message = (choices[0] as { message?: unknown }).message
  if (!message || typeof message !== 'object') return raw
  const content = (message as { content?: unknown }).content
  return typeof content === 'string' ? content : raw
}

export function chatErrorMessage(status: number, body: string): string {
  const detail = body.replace(/\s+/g, ' ').trim().slice(0, 240)
  if (status === 400 || status === 401 || status === 403) {
    return 'xAI rejected the credentials. Open Settings and sign in or save a working key.'
  }
  return detail ? `Summary failed (${status}): ${detail}` : `Summary failed (${status}).`
}
