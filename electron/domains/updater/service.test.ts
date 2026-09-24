import { describe, expect, it } from 'vitest'
import {
  UpdateService,
  type UpdateAvailableInfo,
  type UpdateClient,
  type UpdateProgressInfo
} from './service'

class FakeUpdateClient implements UpdateClient {
  checks = 0
  installs: Array<{ isSilent: boolean; isForceRunAfter: boolean }> = []
  behavior: (() => Promise<void>) | null = null
  private readonly handlers = new Map<string, Array<(...args: never[]) => void>>()

  checkForUpdates(): Promise<unknown> {
    this.checks += 1
    const behavior = this.behavior
    if (!behavior) return Promise.resolve()
    return behavior()
  }

  quitAndInstall(isSilent: boolean, isForceRunAfter: boolean): void {
    this.installs.push({ isSilent, isForceRunAfter })
  }

  on(event: 'checking-for-update', listener: () => void): void
  on(event: 'update-available', listener: (info: UpdateAvailableInfo) => void): void
  on(event: 'update-not-available', listener: (info: UpdateAvailableInfo) => void): void
  on(event: 'download-progress', listener: (progress: UpdateProgressInfo) => void): void
  on(event: 'update-downloaded', listener: (info: UpdateAvailableInfo) => void): void
  on(event: 'error', listener: (error: Error) => void): void
  on(event: string, listener: (...args: never[]) => void): void {
    const list = this.handlers.get(event) ?? []
    list.push(listener)
    this.handlers.set(event, list)
  }

  emit(event: string, ...args: unknown[]): void {
    for (const listener of this.handlers.get(event) ?? []) {
      listener(...(args as never[]))
    }
  }
}

function blockedService(input: { packaged: boolean; portable: boolean }): {
  service: UpdateService
  created: { count: number }
} {
  const created = { count: 0 }
  const service = new UpdateService({
    packaged: input.packaged,
    portable: input.portable,
    currentVersion: '0.2.0',
    isRecording: () => false,
    createClient: () => {
      created.count += 1
      return new FakeUpdateClient()
    }
  })
  return { service, created }
}

describe('update service', () => {
  it('does not call the feed when the app is unpackaged', async () => {
    const { service, created } = blockedService({ packaged: false, portable: false })
    const snapshot = await service.check()
    expect(created.count).toBe(0)
    expect(snapshot.phase).toBe('unsupported')
    expect(snapshot.message).toBe('Updates apply to packaged installs.')
  })

  it('does not call the feed for a portable build', async () => {
    const { service, created } = blockedService({ packaged: true, portable: true })
    const snapshot = await service.check()
    expect(created.count).toBe(0)
    expect(snapshot.phase).toBe('unsupported')
    expect(snapshot.message).toBe(
      'This portable build does not auto-update. Download the new exe from GitHub Releases.'
    )
  })

  it('records real byte progress and ignores a second check while downloading', async () => {
    const fake = new FakeUpdateClient()
    const service = new UpdateService({
      packaged: true,
      portable: false,
      currentVersion: '0.2.0',
      isRecording: () => false,
      client: fake
    })
    fake.behavior = async () => {
      fake.emit('checking-for-update')
      fake.emit('update-available', { version: '0.3.0' })
      expect(service.snapshot().phase).toBe('available')
      expect(service.snapshot().message).toBe('Version 0.3.0 is available.')
      fake.emit('download-progress', { transferred: 5, total: 0 })
    }

    await service.check()
    expect(service.snapshot().phase).toBe('downloading')
    expect(service.snapshot().message).toBe('Downloading update…')
    expect(service.snapshot().transferred).toBeNull()
    expect(service.snapshot().total).toBeNull()

    fake.emit('download-progress', {
      transferred: 1024 * 1024,
      total: 2 * 1024 * 1024
    })
    expect(service.snapshot().transferred).toBe(1024 * 1024)
    expect(service.snapshot().total).toBe(2 * 1024 * 1024)
    expect(service.snapshot().message).toBe('Downloaded 1.0 of 2.0.')

    await service.check()
    expect(fake.checks).toBe(1)

    fake.emit('update-downloaded', { version: '0.3.0' })
    expect(service.snapshot().phase).toBe('ready')
    expect(service.snapshot().availableVersion).toBe('0.3.0')
    expect(service.snapshot().transferred).toBeNull()
    expect(service.snapshot().total).toBeNull()
    expect(service.snapshot().message).toBe('Version 0.3.0 is ready to install.')
  })

  it('defers quit while recording and installs once recording is idle', () => {
    const fake = new FakeUpdateClient()
    let recording = true
    const service = new UpdateService({
      packaged: true,
      portable: false,
      currentVersion: '0.2.0',
      isRecording: () => recording,
      client: fake
    })
    fake.behavior = async () => {
      fake.emit('update-downloaded', { version: '0.3.0' })
    }
    return service.check().then(() => {
      expect(service.requestInstall()).toBe('defer')
      expect(fake.installs).toEqual([])
      expect(service.snapshot().deferred).toBe(true)
      expect(service.snapshot().message).toBe('Update ready — restart when you finish recording.')

      recording = false
      service.syncRecording()
      expect(service.snapshot().deferred).toBe(false)
      expect(service.snapshot().message).toBe('Version 0.3.0 is ready to install.')

      const order: string[] = []
      fake.quitAndInstall = (isSilent, isForceRunAfter) => {
        order.push('install')
        fake.installs.push({ isSilent, isForceRunAfter })
      }
      expect(
        service.requestInstall(() => {
          order.push('before')
        })
      ).toBe('install')
      expect(order).toEqual(['before', 'install'])
      expect(fake.installs).toEqual([{ isSilent: true, isForceRunAfter: true }])
    })
  })

  it('uses the offline sentence for ENOTFOUND', async () => {
    const fake = new FakeUpdateClient()
    const service = new UpdateService({
      packaged: true,
      portable: false,
      currentVersion: '0.2.0',
      isRecording: () => false,
      client: fake
    })
    fake.behavior = async () => {
      const error = new Error('getaddrinfo ENOTFOUND github.com') as Error & { code: string }
      error.code = 'ENOTFOUND'
      fake.emit('error', error)
      throw error
    }
    const snapshot = await service.check()
    expect(snapshot.phase).toBe('error')
    expect(snapshot.message).toBe(
      'Could not check for updates. You can try again when you are online.'
    )
  })
})
