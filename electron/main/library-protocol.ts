import { protocol } from 'electron'
import { readAudioBytes } from '../domains/recording/library'
import { libraryAudioContentType } from '../domains/recording/layout'

export function registerLibraryProtocol(recordingsDir: () => string): void {
  protocol.handle('meetrec', async (request) => {
    const url = new URL(request.url)
    const parts = url.pathname.split('/').filter(Boolean)
    const id = decodeURIComponent(parts[0] ?? '')
    const file = parts[1] ?? ''
    const mime = libraryAudioContentType(file)
    if (!id || !mime) {
      return new Response('Not found', { status: 404 })
    }
    try {
      const bytes = await readAudioBytes(recordingsDir(), id, file)
      const body = new ArrayBuffer(bytes.byteLength)
      new Uint8Array(body).set(bytes)
      return new Response(body, {
        headers: {
          'Content-Type': mime,
          'Content-Length': String(body.byteLength)
        }
      })
    } catch {
      return new Response('Not found', { status: 404 })
    }
  })
}
