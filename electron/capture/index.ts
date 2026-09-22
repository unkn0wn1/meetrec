import type { AudioCapture } from './types'
import { LinuxCapture } from './linux'
import { MacosCapture } from './macos'
import { WindowsCapture } from './windows'

export function createCapture(platform: NodeJS.Platform = process.platform): AudioCapture {
  if (platform === 'linux') return new LinuxCapture()
  if (platform === 'win32') return new WindowsCapture()
  if (platform === 'darwin') return new MacosCapture()
  throw new Error(`Unsupported platform: ${platform}`)
}

export type { AudioCapture, CaptureMode, CaptureStartOptions, CaptureStopResult } from './types'
