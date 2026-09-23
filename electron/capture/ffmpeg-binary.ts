import { spawn } from 'node:child_process'
import { constants } from 'node:fs'
import { access, stat } from 'node:fs/promises'
import { join } from 'node:path'

const MISSING =
  'ffmpeg was not found. Packaged builds include it under resources/ffmpeg. For npm run dev, install ffmpeg and add it to PATH.'

export function ffmpegFileName(platform: NodeJS.Platform): string {
  return platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg'
}

export function bundledFfmpegPath(resourcesPath: string, platform: NodeJS.Platform): string {
  return join(resourcesPath, 'ffmpeg', ffmpegFileName(platform))
}

export async function resolveFfmpegBinary(options?: {
  resourcesPath?: string
  platform?: NodeJS.Platform
  exists?: (path: string) => Promise<boolean>
  lookupPath?: (command: string) => Promise<string | null>
}): Promise<string> {
  const platform = options?.platform ?? process.platform
  const resourcesPath = options?.resourcesPath ?? readResourcesPath()
  const exists = options?.exists ?? fileExists
  const lookupPath = options?.lookupPath ?? ((command: string) => lookupOnPath(command, platform))

  if (resourcesPath) {
    const bundled = bundledFfmpegPath(resourcesPath, platform)
    if (await exists(bundled)) return bundled
  }

  const names = platform === 'win32' ? ['ffmpeg.exe', 'ffmpeg'] : ['ffmpeg']
  for (const name of names) {
    const found = (await lookupPath(name))?.trim()
    if (found) return found
  }

  throw new Error(MISSING)
}

function readResourcesPath(): string {
  const value = (process as NodeJS.Process & { resourcesPath?: string }).resourcesPath
  return typeof value === 'string' ? value : ''
}

async function fileExists(path: string): Promise<boolean> {
  try {
    const info = await stat(path)
    if (!info.isFile()) return false
    await access(path, constants.X_OK)
    return true
  } catch {
    return false
  }
}

function lookupOnPath(command: string, platform: NodeJS.Platform): Promise<string | null> {
  const locator = platform === 'win32' ? 'where' : 'which'
  return new Promise((resolve) => {
    const child = spawn(locator, [command], {
      stdio: ['ignore', 'pipe', 'ignore'],
      windowsHide: true
    })
    const chunks: Buffer[] = []
    child.stdout?.on('data', (chunk: Buffer) => chunks.push(chunk))
    child.once('error', () => resolve(null))
    child.once('exit', (code) => {
      if (code !== 0) {
        resolve(null)
        return
      }
      const line = Buffer.concat(chunks)
        .toString('utf8')
        .split(/\r?\n/)
        .map((entry) => entry.trim())
        .find(Boolean)
      resolve(line ?? null)
    })
  })
}
