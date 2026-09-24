import type { UpdateSnapshot } from '../../shared/ipc-contract'
import {
  byteProgress,
  feedBlock,
  formatDownloaded,
  installDecision,
  updateErrorMessage,
  type InstallDecision
} from './policy'

export interface UpdateAvailableInfo {
  version: string
}

export interface UpdateProgressInfo {
  transferred: number
  total: number
}

export interface UpdateClient {
  checkForUpdates(): Promise<unknown>
  quitAndInstall(isSilent: boolean, isForceRunAfter: boolean): void
  on(event: 'checking-for-update', listener: () => void): void
  on(event: 'update-available', listener: (info: UpdateAvailableInfo) => void): void
  on(event: 'update-not-available', listener: (info: UpdateAvailableInfo) => void): void
  on(event: 'download-progress', listener: (progress: UpdateProgressInfo) => void): void
  on(event: 'update-downloaded', listener: (info: UpdateAvailableInfo) => void): void
  on(event: 'error', listener: (error: Error) => void): void
}

export interface UpdateServiceDeps {
  packaged: boolean
  portable: boolean
  currentVersion: string
  isRecording: () => boolean
  client?: UpdateClient
  createClient?: () => UpdateClient
}

const CHECKING_MESSAGE = 'Checking for updates…'
const DOWNLOADING_MESSAGE = 'Downloading update…'
const READY_WHILE_RECORDING = 'Update ready — restart when you finish recording.'

export class UpdateService {
  private state: UpdateSnapshot
  private feed: UpdateClient | null = null
  private readonly listeners = new Set<(snapshot: UpdateSnapshot) => void>()

  constructor(private readonly deps: UpdateServiceDeps) {
    this.state = {
      phase: 'idle',
      currentVersion: deps.currentVersion,
      availableVersion: null,
      message: 'Not checked yet.',
      transferred: null,
      total: null,
      deferred: false
    }
  }

  snapshot(): UpdateSnapshot {
    return { ...this.state }
  }

  onChange(listener: (snapshot: UpdateSnapshot) => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  async check(): Promise<UpdateSnapshot> {
    const block = feedBlock({ packaged: this.deps.packaged, portable: this.deps.portable })
    if (block.kind === 'skip') {
      this.patch({
        phase: 'unsupported',
        message: block.message,
        availableVersion: null,
        transferred: null,
        total: null,
        deferred: false
      })
      return this.snapshot()
    }
    if (this.state.phase === 'checking' || this.state.phase === 'downloading') {
      return this.snapshot()
    }
    const client = this.openClient()
    this.patch({
      phase: 'checking',
      message: CHECKING_MESSAGE,
      transferred: null,
      total: null,
      deferred: false
    })
    try {
      await client.checkForUpdates()
    } catch (error) {
      this.applyError(error)
    }
    return this.snapshot()
  }

  requestInstall(beforeQuit?: () => void): InstallDecision {
    const decision = installDecision({
      phase: this.state.phase,
      recording: this.deps.isRecording()
    })
    if (decision === 'defer') {
      this.patch({ deferred: true, message: READY_WHILE_RECORDING })
      return 'defer'
    }
    if (decision === 'install') {
      beforeQuit?.()
      this.openClient().quitAndInstall(true, true)
      return 'install'
    }
    return 'ignore'
  }

  syncRecording(): void {
    if (this.state.phase !== 'ready') return
    const recording = this.deps.isRecording()
    const message = recording ? READY_WHILE_RECORDING : readyMessage(this.state.availableVersion)
    if (this.state.deferred === recording && this.state.message === message) return
    this.patch({ deferred: recording, message })
  }

  private openClient(): UpdateClient {
    if (this.feed) return this.feed
    const client = this.deps.client ?? this.deps.createClient?.()
    if (!client) throw new Error('Update client is not configured.')
    this.feed = client
    this.bind(client)
    return client
  }

  private bind(client: UpdateClient): void {
    client.on('checking-for-update', () => {
      this.patch({
        phase: 'checking',
        message: CHECKING_MESSAGE,
        transferred: null,
        total: null,
        deferred: false
      })
    })
    client.on('update-available', (info) => {
      const version = versionOf(info.version)
      this.patch({
        phase: 'available',
        availableVersion: version,
        message: version ? `Version ${version} is available.` : 'An update is available.',
        deferred: false
      })
    })
    client.on('download-progress', (progress) => {
      const bytes = byteProgress(progress.transferred, progress.total)
      this.patch({
        phase: 'downloading',
        transferred: bytes?.transferred ?? null,
        total: bytes?.total ?? null,
        deferred: false,
        message: bytes ? formatDownloaded(bytes.transferred, bytes.total) : DOWNLOADING_MESSAGE
      })
    })
    client.on('update-downloaded', (info) => {
      const version = versionOf(info.version) ?? this.state.availableVersion
      const recording = this.deps.isRecording()
      this.patch({
        phase: 'ready',
        availableVersion: version,
        transferred: null,
        total: null,
        deferred: recording,
        message: recording ? READY_WHILE_RECORDING : readyMessage(version)
      })
    })
    client.on('update-not-available', () => {
      this.patch({
        phase: 'up-to-date',
        availableVersion: null,
        transferred: null,
        total: null,
        deferred: false,
        message: 'You are up to date.'
      })
    })
    client.on('error', (error) => {
      this.applyError(error)
    })
  }

  private applyError(error: unknown): void {
    this.patch({
      phase: 'error',
      message: updateErrorMessage(error),
      transferred: null,
      total: null,
      deferred: false
    })
  }

  private patch(partial: Partial<UpdateSnapshot>): void {
    this.state = { ...this.state, ...partial }
    const next = this.snapshot()
    for (const listener of this.listeners) listener(next)
  }
}

function versionOf(version: string): string | null {
  const trimmed = version.trim()
  return trimmed.length > 0 ? trimmed : null
}

function readyMessage(version: string | null): string {
  if (!version) return 'An update is ready to install.'
  return `Version ${version} is ready to install.`
}
