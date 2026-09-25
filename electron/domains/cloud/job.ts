import { stat, readFile } from 'node:fs/promises'
import { isSafeRecordingId } from '../../capture/paths'
import { resolveLibraryAudio } from '../recording/encode-mp3'
import { CAPTURE_AUDIO_FILE, recordingLayout } from '../recording/layout'
import { migrateLibraryFolder, readMeta, writeMeta } from '../recording/store'
import type { RecordingMeta, RecordingUploads } from '../recording/meta'
import { CloudHttpError, ensureMeetrecFolder, uploadDriveFile } from './google-drive'
import { artifactName } from './names'
import { uploadOneDriveFile } from './onedrive'

export interface CloudUploadResult {
  ok: boolean
  message: string
}

type Kind = 'audio' | 'transcript' | 'summary'

export async function uploadRecording(input: {
  recordingsRoot: string
  recordingId: string
  provider: 'google' | 'microsoft'
  getAccess: (force?: boolean) => Promise<string>
  fetchImpl?: typeof fetch
}): Promise<CloudUploadResult> {
  if (!isSafeRecordingId(input.recordingId)) {
    return { ok: false, message: 'That recording was not found.' }
  }
  try {
    await runUpload(input, false)
    return { ok: true, message: 'Uploaded.' }
  } catch (error) {
    if (!(error instanceof CloudHttpError) || error.status !== 401) {
      return { ok: false, message: safeMessage(error) }
    }
    try {
      await runUpload(input, true)
      return { ok: true, message: 'Uploaded.' }
    } catch (retry) {
      return { ok: false, message: safeMessage(retry) }
    }
  }
}

async function runUpload(
  input: {
    recordingsRoot: string
    recordingId: string
    provider: 'google' | 'microsoft'
    getAccess: (force?: boolean) => Promise<string>
    fetchImpl?: typeof fetch
  },
  force: boolean
): Promise<void> {
  await migrateLibraryFolder(input.recordingsRoot, input.recordingId)
  const meta = await readMeta(input.recordingsRoot, input.recordingId)
  if (!meta) throw new Error('That recording was not found.')
  const layout = recordingLayout(input.recordingsRoot, input.recordingId)
  const audio = await resolveLibraryAudio(layout.dir)
  const files = await presentFiles(layout, audio)
  if (files.length === 0) throw new Error('There is no file to upload yet.')
  const token = await input.getAccess(force)
  if (input.provider === 'google') {
    const folderId =
      meta.uploads?.google?.folderId || (await ensureMeetrecFolder(token, input.fetchImpl))
    let uploads = withFolder(meta.uploads, folderId)
    for (const file of files) {
      const id = await uploadDriveFile({
        accessToken: token,
        folderId,
        name: artifactName({ ...meta, kind: file.kind, audioExtension: file.audioExtension }),
        mimeType: file.mime,
        body: file.body,
        fileId: uploads.google?.files[file.kind],
        fetchImpl: input.fetchImpl
      })
      uploads = {
        ...uploads,
        google: {
          folderId,
          files: { ...uploads.google?.files, [file.kind]: id }
        }
      }
      await writeMeta(input.recordingsRoot, { ...meta, uploads })
      meta.uploads = uploads
    }
    return
  }
  let uploads = meta.uploads ?? {}
  for (const file of files) {
    const name = artifactName({ ...meta, kind: file.kind, audioExtension: file.audioExtension })
    const id = await uploadOneDriveFile({
      accessToken: token,
      name,
      body: file.body,
      fetchImpl: input.fetchImpl
    })
    uploads = {
      ...uploads,
      microsoft: { files: { ...uploads.microsoft?.files, [file.kind]: id } }
    }
    await writeMeta(input.recordingsRoot, { ...meta, uploads })
    meta.uploads = uploads
  }
}

function withFolder(uploads: RecordingUploads | undefined, folderId: string): RecordingUploads {
  return {
    ...uploads,
    google: { folderId, files: { ...uploads?.google?.files } }
  }
}

async function presentFiles(
  layout: {
    transcriptPath: string
    summaryPath: string
  },
  audio: { path: string; fileName: string; mime: string } | null
): Promise<{ kind: Kind; mime: string; body: Uint8Array; audioExtension?: 'mp3' | 'wav' }[]> {
  const specs: {
    kind: Kind
    path: string
    mime: string
    audioExtension?: 'mp3' | 'wav'
  }[] = [
    { kind: 'transcript', path: layout.transcriptPath, mime: 'application/json' },
    { kind: 'summary', path: layout.summaryPath, mime: 'text/markdown' }
  ]
  if (audio) {
    specs.unshift({
      kind: 'audio',
      path: audio.path,
      mime: audio.mime,
      audioExtension: audio.fileName === CAPTURE_AUDIO_FILE ? 'wav' : 'mp3'
    })
  }
  const present: { kind: Kind; mime: string; body: Uint8Array; audioExtension?: 'mp3' | 'wav' }[] =
    []
  for (const spec of specs) {
    if (!(await fileExists(spec.path))) continue
    present.push({
      kind: spec.kind,
      mime: spec.mime,
      body: new Uint8Array(await readFile(spec.path)),
      ...(spec.audioExtension ? { audioExtension: spec.audioExtension } : {})
    })
  }
  return present
}

async function fileExists(path: string): Promise<boolean> {
  try {
    const info = await stat(path)
    return info.isFile() && info.size > 0
  } catch {
    return false
  }
}

function safeMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : 'Upload failed.'
  if (message.length > 180) return 'Upload failed.'
  return message
}

export type { RecordingMeta }
