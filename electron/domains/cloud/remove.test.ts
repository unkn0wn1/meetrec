import { describe, expect, it } from 'vitest'
import { removeUploadedCopies } from './remove'

interface Call {
  url: string
  method: string
  authorization: string
  body: string | undefined
}

function scriptedFetch(statuses: number[]): { fetchImpl: typeof fetch; calls: Call[] } {
  const calls: Call[] = []
  let index = 0
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const headers = (init?.headers ?? {}) as Record<string, string>
    calls.push({
      url: String(input),
      method: init?.method ?? 'GET',
      authorization: headers.Authorization ?? '',
      body: typeof init?.body === 'string' ? init.body : undefined
    })
    const status = statuses[index] ?? 500
    index += 1
    return new Response(status === 204 ? null : '{}', { status })
  }) as typeof fetch
  return { fetchImpl, calls }
}

describe('removeUploadedCopies', () => {
  it('does nothing when the only stored id is the shared Drive folder', async () => {
    const access: string[] = []
    const fetchImpl = (async () => {
      throw new Error('fetch should not run')
    }) as typeof fetch
    await removeUploadedCopies({
      uploads: { google: { folderId: 'folder-1', files: {} } },
      getAccess: async (provider) => {
        access.push(provider)
        return 'token'
      },
      fetchImpl
    })
    expect(access).toEqual([])
  })

  it('trashes Drive file ids and does not trash the shared folder', async () => {
    const { fetchImpl, calls } = scriptedFetch([200])
    await removeUploadedCopies({
      uploads: { google: { folderId: 'folder-1', files: { audio: 'file-a' } } },
      getAccess: async () => 'test-token',
      fetchImpl
    })
    expect(calls).toEqual([
      {
        url: 'https://www.googleapis.com/drive/v3/files/file-a',
        method: 'PATCH',
        authorization: 'Bearer test-token',
        body: JSON.stringify({ trashed: true })
      }
    ])
  })

  it('removes google files before OneDrive files, skipping empty kinds', async () => {
    const { fetchImpl, calls } = scriptedFetch([200, 200, 204, 204])
    const access: string[] = []
    await removeUploadedCopies({
      uploads: {
        google: { folderId: 'folder-1', files: { audio: 'file-a', summary: 'file-c' } },
        microsoft: { files: { audio: 'clip.wav', transcript: 'item-b' } }
      },
      getAccess: async (provider, force) => {
        access.push(`${provider}:${Boolean(force)}`)
        return 'test-token'
      },
      fetchImpl
    })
    expect(access).toEqual(['google:false', 'microsoft:false'])
    expect(calls.map((call) => call.url)).toEqual([
      'https://www.googleapis.com/drive/v3/files/file-a',
      'https://www.googleapis.com/drive/v3/files/file-c',
      'https://graph.microsoft.com/v1.0/me/drive/special/approot:/clip.wav',
      'https://graph.microsoft.com/v1.0/me/drive/items/item-b'
    ])
  })

  it('refreshes once after 401 and continues with the new token', async () => {
    const { fetchImpl, calls } = scriptedFetch([401, 200, 200])
    const forces: boolean[] = []
    await removeUploadedCopies({
      uploads: {
        google: { folderId: 'folder-1', files: { audio: 'file-a', transcript: 'file-b' } }
      },
      getAccess: async (_provider, force) => {
        forces.push(Boolean(force))
        return force ? 'new-token' : 'old-token'
      },
      fetchImpl
    })
    expect(forces).toEqual([false, true])
    expect(calls.map((call) => call.authorization)).toEqual([
      'Bearer old-token',
      'Bearer new-token',
      'Bearer new-token'
    ])
    expect(calls.map((call) => call.url)).toEqual([
      'https://www.googleapis.com/drive/v3/files/file-a',
      'https://www.googleapis.com/drive/v3/files/file-a',
      'https://www.googleapis.com/drive/v3/files/file-b'
    ])
  })

  it('lists every failed kind and still attempts the remaining ids', async () => {
    const { fetchImpl, calls } = scriptedFetch([200, 403, 200])
    await expect(
      removeUploadedCopies({
        uploads: {
          google: {
            folderId: 'folder-1',
            files: { audio: 'file-a', transcript: 'file-b', summary: 'file-c' }
          }
        },
        getAccess: async () => 'test-token',
        fetchImpl
      })
    ).rejects.toThrow(
      'Cloud copies could not be removed, so the recording on this computer was kept. Google Drive transcript: Google Drive returned 403.'
    )
    expect(calls).toHaveLength(3)
  })

  it('stops a provider after a second 401 and still tries the other provider', async () => {
    const { fetchImpl, calls } = scriptedFetch([401, 401, 204])
    const forces: string[] = []
    await expect(
      removeUploadedCopies({
        uploads: {
          google: { folderId: 'folder-1', files: { audio: 'file-a', transcript: 'file-b' } },
          microsoft: { files: { summary: 'item-c' } }
        },
        getAccess: async (provider, force) => {
          forces.push(`${provider}:${Boolean(force)}`)
          return 'test-token'
        },
        fetchImpl
      })
    ).rejects.toThrow(/Google Drive audio: Google Drive returned 401\./)
    expect(forces).toEqual(['google:false', 'google:true', 'microsoft:false'])
    expect(calls.map((call) => call.url)).toEqual([
      'https://www.googleapis.com/drive/v3/files/file-a',
      'https://www.googleapis.com/drive/v3/files/file-a',
      'https://graph.microsoft.com/v1.0/me/drive/items/item-c'
    ])
  })

  it('names a provider when its token cannot be loaded and still tries the other', async () => {
    const fetchImpl = (async () => {
      throw new Error('fetch should not run')
    }) as typeof fetch
    await expect(
      removeUploadedCopies({
        uploads: {
          google: { folderId: 'folder-1', files: { audio: 'file-a' } },
          microsoft: { files: { audio: 'item-b' } }
        },
        getAccess: async () => {
          throw new Error('Connect again')
        },
        fetchImpl
      })
    ).rejects.toThrow(
      'Cloud copies could not be removed, so the recording on this computer was kept. Google Drive: Connect again. OneDrive: Connect again.'
    )
  })

  it('reports an invalid OneDrive id without calling the network for that id', async () => {
    const { fetchImpl, calls } = scriptedFetch([200])
    await expect(
      removeUploadedCopies({
        uploads: {
          microsoft: { files: { audio: '../secret.wav', transcript: 'item-b' } }
        },
        getAccess: async () => 'test-token',
        fetchImpl
      })
    ).rejects.toThrow(/OneDrive audio: That cloud file id is not valid\./)
    expect(calls.map((call) => call.url)).toEqual([
      'https://graph.microsoft.com/v1.0/me/drive/items/item-b'
    ])
  })

  it('hides transport errors that might contain a token', async () => {
    const fetchImpl = (async () => {
      throw new Error('socket hang up Bearer secret-token')
    }) as typeof fetch
    await expect(
      removeUploadedCopies({
        uploads: { google: { folderId: 'folder-1', files: { audio: 'file-a' } } },
        getAccess: async () => 'test-token',
        fetchImpl
      })
    ).rejects.toThrow(
      'Cloud copies could not be removed, so the recording on this computer was kept. Google Drive audio: Could not reach Google Drive.'
    )
  })
})
