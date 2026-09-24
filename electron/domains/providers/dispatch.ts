import { stat } from 'node:fs/promises'
import type { TranscribeStage } from '../../shared/ipc-contract'
import type { MinutesDraft } from '../minutes/markdown'
import type { TranscriptDocument } from '../transcript/parse'
import type { ActiveAuth } from './auth'
import { completeMinutesOpenAi } from './openai-chat'
import { postOpenAiTranscription, transcribeWavOpenAi } from './openai-stt'
import { needsSttSplit, splitPreparedMp3, transcribeChunks } from './stt-chunk'
import { prepareSttUpload, type PreparedSttAudio } from './stt-prepare'
import { pieceFromDiarizedPayload, pieceFromWordPayload, type SttPiece } from './stt-stitch'
import { completeMinutes } from './xai-chat'
import { postXaiTranscription, transcribeWav } from './xai-stt'

type StageReport = (stage: Exclude<TranscribeStage, 'saving'>, message?: string) => void

export async function transcribeWithAuth(input: {
  auth: ActiveAuth
  audioPath: string
  fetchImpl?: typeof fetch
  onStage?: StageReport
}): Promise<TranscriptDocument> {
  input.onStage?.('preparing')
  const prepared = await prepareSttUpload(input.audioPath)
  try {
    const info = await stat(prepared.path)
    if (!needsSttSplit(info.size)) {
      return await transcribeSingle(input, prepared)
    }
    const split = await splitPreparedMp3(prepared.path)
    const createdAt = new Date().toISOString()
    return await transcribeChunks({
      chunks: split.chunks,
      model: input.auth.model,
      createdAt,
      timelineEndSec: split.timelineEndSec,
      post: (chunk, onWaiting) => postChunk(input, prepared.mimeType, chunk, onWaiting),
      toPiece: (payload) => pieceFor(input.auth, payload),
      onProgress: (event) => reportChunk(input.onStage, event)
    })
  } finally {
    await prepared.cleanup()
  }
}

async function transcribeSingle(
  input: {
    auth: ActiveAuth
    fetchImpl?: typeof fetch
    onStage?: StageReport
  },
  prepared: PreparedSttAudio
): Promise<TranscriptDocument> {
  input.onStage?.('uploading')
  const onWaiting = (): void => {
    input.onStage?.('waiting')
  }
  if (input.auth.provider === 'openai') {
    return transcribeWavOpenAi({
      apiKey: input.auth.token,
      audioPath: prepared.path,
      mimeType: prepared.mimeType,
      fileName: prepared.fileName,
      model: input.auth.model,
      fetchImpl: input.fetchImpl,
      onWaiting
    })
  }
  if (isXai(input.auth)) {
    return transcribeWav({
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
}

function postChunk(
  input: { auth: ActiveAuth; fetchImpl?: typeof fetch },
  mimeType: string,
  chunk: { path: string; fileName: string },
  onWaiting: () => void
): Promise<unknown> {
  if (input.auth.provider === 'openai') {
    return postOpenAiTranscription({
      apiKey: input.auth.token,
      audioPath: chunk.path,
      mimeType,
      fileName: chunk.fileName,
      model: input.auth.model,
      fetchImpl: input.fetchImpl,
      onWaiting
    })
  }
  if (isXai(input.auth)) {
    return postXaiTranscription({
      apiKey: input.auth.token,
      audioPath: chunk.path,
      mimeType,
      fileName: chunk.fileName,
      model: input.auth.model,
      fetchImpl: input.fetchImpl,
      onWaiting
    })
  }
  throw new Error('This provider is not available.')
}

function pieceFor(auth: ActiveAuth, payload: unknown): SttPiece {
  if (auth.provider === 'openai') return pieceFromDiarizedPayload(payload)
  if (isXai(auth)) return pieceFromWordPayload(payload)
  throw new Error('This provider is not available.')
}

function reportChunk(
  onStage: StageReport | undefined,
  event: { index: number; count: number; phase: 'uploading' | 'waiting' }
): void {
  if (event.count < 2) {
    onStage?.(event.phase)
    return
  }
  const shown = event.index + 1
  const message =
    event.phase === 'uploading'
      ? `Uploading chunk ${shown} of ${event.count}`
      : `Waiting for model (chunk ${shown} of ${event.count})`
  onStage?.(event.phase, message)
}

function isXai(auth: ActiveAuth): boolean {
  return auth.provider === 'xai-oauth' || auth.provider === 'xai-key'
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
  if (isXai(input.auth)) {
    return completeMinutes({
      apiKey: input.auth.token,
      prompt: input.prompt,
      model: input.auth.model,
      fetchImpl: input.fetchImpl
    })
  }
  throw new Error('This provider is not available.')
}
