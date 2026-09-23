import { readJson, shortTokenError } from '../calendar/redact'
import { byteRanges, DRIVE_CHUNK_BYTES, type ByteRange } from './ranges'

const FOLDER_MIME = 'application/vnd.google-apps.folder'

export class CloudHttpError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message)
    this.name = 'CloudHttpError'
  }
}

export function folderQuery(): string {
  return [
    "name = 'meetrec'",
    `mimeType = '${FOLDER_MIME}'`,
    'trashed = false',
    "'root' in parents"
  ].join(' and ')
}

export function folderListUrl(): string {
  const url = new URL('https://www.googleapis.com/drive/v3/files')
  url.searchParams.set('q', folderQuery())
  url.searchParams.set('fields', 'files(id,name)')
  url.searchParams.set('pageSize', '10')
  return url.toString()
}

export function folderCreateBody(): { name: string; mimeType: string; parents: string[] } {
  return { name: 'meetrec', mimeType: FOLDER_MIME, parents: ['root'] }
}

export function resumableTarget(fileId?: string): { method: 'POST' | 'PATCH'; url: string } {
  if (fileId) {
    return {
      method: 'PATCH',
      url: `https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(fileId)}?uploadType=resumable`
    }
  }
  return {
    method: 'POST',
    url: 'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable'
  }
}

export function resumableMetadata(
  name: string,
  folderId: string,
  fileId?: string
): { name: string; parents?: string[] } {
  if (fileId) return { name }
  return { name, parents: [folderId] }
}

export function driveChunkRanges(size: number): ByteRange[] {
  return byteRanges(size, DRIVE_CHUNK_BYTES)
}

export async function ensureMeetrecFolder(
  accessToken: string,
  fetchImpl: typeof fetch = fetch
): Promise<string> {
  const listed = await driveJson(folderListUrl(), accessToken, fetchImpl)
  const files = filesFrom(listed)
  const existing = files.find((file) => file.id)
  if (existing?.id) return existing.id
  const created = await driveJson(
    'https://www.googleapis.com/drive/v3/files',
    accessToken,
    fetchImpl,
    {
      method: 'POST',
      body: JSON.stringify(folderCreateBody())
    }
  )
  const id = textId(created)
  if (!id) throw new Error('Google Drive did not return a folder.')
  return id
}

export async function uploadDriveFile(input: {
  accessToken: string
  folderId: string
  name: string
  mimeType: string
  body: Uint8Array
  fileId?: string
  fetchImpl?: typeof fetch
}): Promise<string> {
  const fetchImpl = input.fetchImpl ?? fetch
  const target = resumableTarget(input.fileId)
  const started = await fetchImpl(target.url, {
    method: target.method,
    headers: {
      Authorization: `Bearer ${input.accessToken}`,
      'Content-Type': 'application/json; charset=UTF-8',
      'X-Upload-Content-Type': input.mimeType,
      'X-Upload-Content-Length': String(input.body.byteLength)
    },
    body: JSON.stringify(resumableMetadata(input.name, input.folderId, input.fileId))
  })
  const location = started.headers.get('location')
  if (!started.ok || !location) {
    const payload = await readJson(started)
    throw new CloudHttpError(
      started.status,
      shortTokenError(payload, `Google Drive did not start the upload (${started.status}).`)
    )
  }
  const finished = await putDriveChunks(location, input.body, input.accessToken, fetchImpl)
  const id = textId(finished)
  if (!id) throw new Error('Google Drive did not return a file id.')
  return id
}

async function putDriveChunks(
  location: string,
  body: Uint8Array,
  accessToken: string,
  fetchImpl: typeof fetch
): Promise<unknown> {
  const ranges = driveChunkRanges(body.byteLength)
  let last: unknown = null
  const slices = ranges.length > 0 ? ranges : [{ start: 0, end: -1 }]
  for (const range of slices) {
    const slice =
      range.end >= range.start ? body.subarray(range.start, range.end + 1) : new Uint8Array()
    const contentRange =
      body.byteLength === 0 ? 'bytes */0' : `bytes ${range.start}-${range.end}/${body.byteLength}`
    const response = await fetchImpl(location, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Length': String(slice.byteLength),
        'Content-Range': contentRange
      },
      body: Buffer.from(slice)
    })
    if (response.status === 308) continue
    const payload = await readJson(response)
    if (!response.ok) {
      throw new CloudHttpError(
        response.status,
        shortTokenError(payload, `Google Drive upload failed (${response.status}).`)
      )
    }
    last = payload
  }
  return last
}

async function driveJson(
  url: string,
  accessToken: string,
  fetchImpl: typeof fetch,
  init?: { method?: string; body?: string }
): Promise<unknown> {
  const response = await fetchImpl(url, {
    method: init?.method ?? 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init?.body ? { 'Content-Type': 'application/json' } : {})
    },
    body: init?.body
  })
  const payload = await readJson(response)
  if (!response.ok) {
    throw new CloudHttpError(
      response.status,
      shortTokenError(payload, `Google Drive returned ${response.status}.`)
    )
  }
  return payload
}

function filesFrom(payload: unknown): { id?: string }[] {
  if (!payload || typeof payload !== 'object') return []
  const files = (payload as Record<string, unknown>).files
  return Array.isArray(files) ? (files as { id?: string }[]) : []
}

function textId(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null
  const id = (payload as Record<string, unknown>).id
  return typeof id === 'string' && id ? id : null
}
