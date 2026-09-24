import { readJson, shortTokenError } from '../calendar/redact'
import { CloudHttpError } from './google-drive'
import { byteRanges, ONEDRIVE_CHUNK_BYTES, ONEDRIVE_QUANTUM_BYTES, type ByteRange } from './ranges'

export function uploadSessionUrl(name: string): string {
  return `https://graph.microsoft.com/v1.0/me/drive/special/approot:/${encodeURIComponent(name)}:/createUploadSession`
}

export function onedriveChunkRanges(size: number): ByteRange[] {
  return byteRanges(size, ONEDRIVE_CHUNK_BYTES)
}

export function chunkIsAligned(range: ByteRange, total: number): boolean {
  const length = range.end - range.start + 1
  const isLast = range.end === total - 1
  if (isLast && length < ONEDRIVE_CHUNK_BYTES) return true
  return length % ONEDRIVE_QUANTUM_BYTES === 0
}

export async function uploadOneDriveFile(input: {
  accessToken: string
  name: string
  body: Uint8Array
  fetchImpl?: typeof fetch
}): Promise<string> {
  const fetchImpl = input.fetchImpl ?? fetch
  const started = await fetchImpl(uploadSessionUrl(input.name), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${input.accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      item: {
        '@microsoft.graph.conflictBehavior': 'replace',
        name: input.name
      }
    })
  })
  const payload = await readJson(started)
  if (!started.ok || !payload || typeof payload !== 'object') {
    throw new CloudHttpError(
      started.status,
      shortTokenError(payload, `OneDrive did not start the upload (${started.status}).`)
    )
  }
  const uploadUrl = (payload as Record<string, unknown>).uploadUrl
  if (typeof uploadUrl !== 'string' || !uploadUrl) {
    throw new Error('OneDrive did not return an upload session.')
  }
  const finished = await putOneDriveChunks(uploadUrl, input.body, fetchImpl)
  const id =
    finished && typeof finished === 'object' ? (finished as Record<string, unknown>).id : null
  return typeof id === 'string' && id ? id : input.name
}

/** A dotted value is the artifact name stored when upload omitted a Graph item id. */
export function oneDriveDeleteUrl(idOrName: string): string {
  if (!idOrName || /[/\\]|\.\./.test(idOrName)) {
    throw new Error('That cloud file id is not valid.')
  }
  if (idOrName.includes('.')) {
    return `https://graph.microsoft.com/v1.0/me/drive/special/approot:/${encodeURIComponent(idOrName)}`
  }
  return `https://graph.microsoft.com/v1.0/me/drive/items/${encodeURIComponent(idOrName)}`
}

export async function deleteOneDriveItem(input: {
  accessToken: string
  fileId: string
  fetchImpl?: typeof fetch
}): Promise<void> {
  const fetchImpl = input.fetchImpl ?? fetch
  const response = await fetchImpl(oneDriveDeleteUrl(input.fileId), {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${input.accessToken}` }
  })
  if (response.ok || response.status === 404) return
  const payload = await readJson(response)
  throw new CloudHttpError(
    response.status,
    shortTokenError(payload, `OneDrive returned ${response.status}.`)
  )
}

async function putOneDriveChunks(
  uploadUrl: string,
  body: Uint8Array,
  fetchImpl: typeof fetch
): Promise<unknown> {
  const ranges = onedriveChunkRanges(body.byteLength)
  const slices = ranges.length > 0 ? ranges : [{ start: 0, end: -1 }]
  let last: unknown = null
  for (const range of slices) {
    const slice =
      range.end >= range.start ? body.subarray(range.start, range.end + 1) : new Uint8Array()
    const contentRange =
      body.byteLength === 0 ? 'bytes 0-0/0' : `bytes ${range.start}-${range.end}/${body.byteLength}`
    const response = await fetchImpl(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Length': String(slice.byteLength),
        'Content-Range': contentRange
      },
      body: Buffer.from(slice)
    })
    if (response.status === 202) continue
    const payload = await readJson(response)
    if (!response.ok) {
      throw new CloudHttpError(
        response.status,
        shortTokenError(payload, `OneDrive upload failed (${response.status}).`)
      )
    }
    last = payload
  }
  return last
}
