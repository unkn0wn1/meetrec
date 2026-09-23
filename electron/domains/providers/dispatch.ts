import type { MinutesDraft } from '../minutes/markdown'
import type { TranscriptDocument } from '../transcript/parse'
import type { ActiveAuth } from './auth'
import { completeMinutesOpenAi } from './openai-chat'
import { transcribeWavOpenAi } from './openai-stt'
import { completeMinutes } from './xai-chat'
import { transcribeWav } from './xai-stt'

export async function transcribeWithAuth(input: {
  auth: ActiveAuth
  audioPath: string
  fetchImpl?: typeof fetch
}): Promise<TranscriptDocument> {
  if (input.auth.provider === 'openai') {
    return transcribeWavOpenAi({
      apiKey: input.auth.token,
      audioPath: input.audioPath,
      fetchImpl: input.fetchImpl
    })
  }
  return transcribeWav({
    apiKey: input.auth.token,
    audioPath: input.audioPath,
    fetchImpl: input.fetchImpl
  })
}

export async function summarizeWithAuth(input: {
  auth: ActiveAuth
  prompt: string
  fetchImpl?: typeof fetch
}): Promise<{ draft: MinutesDraft; markdown: string }> {
  if (input.auth.provider === 'openai') {
    return completeMinutesOpenAi({
      apiKey: input.auth.token,
      prompt: input.prompt,
      fetchImpl: input.fetchImpl
    })
  }
  return completeMinutes({
    apiKey: input.auth.token,
    prompt: input.prompt,
    fetchImpl: input.fetchImpl
  })
}
