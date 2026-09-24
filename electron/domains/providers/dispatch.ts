import type { TranscribeStage } from '../../shared/ipc-contract'
import type { MinutesDraft } from '../minutes/markdown'
import type { TranscriptDocument } from '../transcript/parse'
import type { ActiveAuth } from './auth'
import { completeMinutesOpenAi } from './openai-chat'
import { transcribeWavOpenAi } from './openai-stt'
import { prepareSttUpload } from './stt-prepare'
import { completeMinutes } from './xai-chat'
import { transcribeWav } from './xai-stt'

export async function transcribeWithAuth(input: {
  auth: ActiveAuth
  audioPath: string
  fetchImpl?: typeof fetch
  onStage?: (stage: Exclude<TranscribeStage, 'saving'>) => void
}): Promise<TranscriptDocument> {
  input.onStage?.('preparing')
  const prepared = await prepareSttUpload(input.audioPath)
  input.onStage?.('uploading')
  const onWaiting = (): void => {
    input.onStage?.('waiting')
  }
  try {
    if (input.auth.provider === 'openai') {
      return await transcribeWavOpenAi({
        apiKey: input.auth.token,
        audioPath: prepared.path,
        mimeType: prepared.mimeType,
        fileName: prepared.fileName,
        model: input.auth.model,
        fetchImpl: input.fetchImpl,
        onWaiting
      })
    }
    if (input.auth.provider === 'xai-oauth' || input.auth.provider === 'xai-key') {
      return await transcribeWav({
        apiKey: input.auth.token,
        audioPath: prepared.path,
        mimeType: prepared.mimeType,
        fileName: prepared.fileName,
        model: input.auth.model,
        fetchImpl: input.fetchImpl,
        onWaiting
      })
    }
    throw new Error('This provider is not available.')
  } finally {
    await prepared.cleanup()
  }
}

export async function summarizeWithAuth(input: {
  auth: ActiveAuth
  prompt: string
  fetchImpl?: typeof fetch
  onStage?: (stage: 'waiting') => void
}): Promise<{ draft: MinutesDraft; markdown: string }> {
  input.onStage?.('waiting')
  if (input.auth.provider === 'openai') {
    return completeMinutesOpenAi({
      apiKey: input.auth.token,
      prompt: input.prompt,
      model: input.auth.model,
      fetchImpl: input.fetchImpl
    })
  }
  if (input.auth.provider === 'xai-oauth' || input.auth.provider === 'xai-key') {
    return completeMinutes({
      apiKey: input.auth.token,
      prompt: input.prompt,
      model: input.auth.model,
      fetchImpl: input.fetchImpl
    })
  }
  throw new Error('This provider is not available.')
}
