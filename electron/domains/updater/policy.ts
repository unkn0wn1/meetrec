import type { UpdatePhase } from '../../shared/ipc-contract'

const UNPACKAGED_MESSAGE = 'Updates apply to packaged installs.'
const PORTABLE_MESSAGE =
  'This portable build does not auto-update. Download the new exe from GitHub Releases.'

const NETWORK_CODES = ['enotfound', 'etimedout', 'eai_again', 'econnreset', 'enetunreach']

export type FeedBlock = { kind: 'ok' } | { kind: 'skip'; message: string }

export type InstallDecision = 'install' | 'defer' | 'ignore'

export function feedBlock(input: { packaged: boolean; portable: boolean }): FeedBlock {
  if (input.portable) return { kind: 'skip', message: PORTABLE_MESSAGE }
  if (!input.packaged) return { kind: 'skip', message: UNPACKAGED_MESSAGE }
  return { kind: 'ok' }
}

export function installDecision(input: {
  phase: UpdatePhase
  recording: boolean
}): InstallDecision {
  if (input.phase !== 'ready') return 'ignore'
  return input.recording ? 'defer' : 'install'
}

export function byteProgress(
  transferred: number,
  total: number
): { transferred: number; total: number } | null {
  if (!Number.isFinite(transferred) || !Number.isFinite(total) || total <= 0) return null
  return { transferred, total }
}

export function formatDownloaded(transferred: number, total: number): string {
  const mib = 1024 * 1024
  return `Downloaded ${(transferred / mib).toFixed(1)} of ${(total / mib).toFixed(1)}.`
}

/** First prerelease id, or `latest`. Matches electron-builder `appInfo.channel`. */
export function updateInfoChannel(version: string): string {
  const withoutBuild = version.split('+')[0] ?? version
  const dash = withoutBuild.indexOf('-')
  if (dash === -1) return 'latest'
  const id = withoutBuild.slice(dash + 1).split('.')[0]
  return id || 'latest'
}

export function updateInfoFileName(
  channel: string,
  platform: 'win32' | 'linux' | 'darwin'
): string {
  if (platform === 'linux') return `${channel}-linux.yml`
  if (platform === 'darwin') return `${channel}-mac.yml`
  return `${channel}.yml`
}

export function updateErrorMessage(error: unknown): string {
  if (isNetworkError(error)) {
    return 'Could not check for updates. You can try again when you are online.'
  }
  const line = firstLine(error)
  if (!line) return 'Could not check for updates.'
  return line.length > 160 ? line.slice(0, 160) : line
}

function isNetworkError(error: unknown): boolean {
  const code = readCode(error)?.toLowerCase()
  if (code && NETWORK_CODES.includes(code)) return true
  const text = firstLine(error).toLowerCase()
  if (text.includes('fetch failed')) return true
  return NETWORK_CODES.some((item) => text.includes(item))
}

function readCode(error: unknown): string | null {
  if (!error || typeof error !== 'object' || !('code' in error)) return null
  const code = (error as { code: unknown }).code
  return typeof code === 'string' ? code : null
}

function firstLine(error: unknown): string {
  const raw = error instanceof Error ? error.message : typeof error === 'string' ? error : ''
  return raw.split(/\r?\n/, 1)[0]?.trim() ?? ''
}
