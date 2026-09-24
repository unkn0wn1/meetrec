import { readFile } from 'node:fs/promises'
import { basename } from 'node:path'
import { documentFromStt, type TranscriptDocument } from '../transcript/parse'
import { XAI_STT_URL } from './models'

export const STT_URL = XAI_STT_URL

export async function transcribeWav(input: {
  apiKey: string
  audioPath: string
  model: string
  mimeType?: string
  fileName?: string
  fetchImpl?: typeof fetch
  onWaiting?: () => void
}): Promise<TranscriptDocument> {
  const bytes = await readFile(input.audioPath)
  const mimeType = input.mimeType ?? 'audio/wav'
  const fileName = input.fileName ?? basename(input.audioPath)
  const form = new FormData()
  form.append('model', input.model)
  form.append('diarize', 'true')
  form.append('language', 'en')
  form.append('format', 'true')
  form.append('file', new Blob([bytes], { type: mimeType }), fileName)

  input.onWaiting?.()
  const fetchImpl = input.fetchImpl ?? fetch
  const response = await fetchImpl(STT_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${input.apiKey}` },
    body: form
  })
  const raw = await response.text()
  if (!response.ok) {
    throw new Error(sttErrorMessage(response.status, raw))
  }
  let payload: unknown
  try {
    payload = JSON.parse(raw)
  } catch {
    throw new Error('Speech-to-text returned a response that was not JSON.')
  }
  return documentFromStt(payload, input.model, new Date().toISOString())
}

export function sttErrorMessage(status: number, body: string): string {
  if (status === 400 || status === 401 || status === 403) {
    return 'xAI rejected the credentials. Open Settings and sign in or save a working key.'
  }
  if (status === 413) {
    return (
      'Speech-to-text rejected the upload as too large (HTTP 413). ' +
      'MeetRec compresses audio before upload; try a shorter recording if this persists.'
    )
  }
  const detail = body.replace(/\s+/g, ' ').trim().slice(0, 240)
  return detail
    ? `Speech-to-text failed (${status}): ${detail}`
    : `Speech-to-text failed (${status}).`
}
