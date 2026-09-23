import { minutesToMarkdown, parseMinutesJson, type MinutesDraft } from '../minutes/markdown'
import { messageContent } from './xai-chat'
import { OPENAI_CHAT_URL } from './models'
import { openAiErrorMessage } from './openai-stt'

export async function completeMinutesOpenAi(input: {
  apiKey: string
  prompt: string
  model: string
  fetchImpl?: typeof fetch
}): Promise<{ draft: MinutesDraft; markdown: string }> {
  const fetchImpl = input.fetchImpl ?? fetch
  const response = await fetchImpl(OPENAI_CHAT_URL, {
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
    throw new Error(openAiErrorMessage(response.status, raw, 'Summary'))
  }
  const draft = parseMinutesJson(messageContent(raw))
  if (!draft) {
    throw new Error('The summary model did not return minutes JSON.')
  }
  return { draft, markdown: minutesToMarkdown(draft) }
}
