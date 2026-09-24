export interface CaptureSupport {
  platform: NodeJS.Platform
  supported: boolean
  /** User-facing reason when supported is false; null when capture can start. */
  message: string | null
}

const MACOS_UNAVAILABLE =
  'macOS capture is not available in this build. MeetRec records mic + system audio on Linux and Windows (experimental). Full Mac system audio needs ScreenCaptureKit work that is not shipped yet.'

/**
 * Whether this OS can start a recording in the current build.
 * Linux and Windows are implemented. macOS stays unsupported until ScreenCaptureKit ships.
 */
export function captureSupport(platform: NodeJS.Platform = process.platform): CaptureSupport {
  if (platform === 'linux' || platform === 'win32') {
    return { platform, supported: true, message: null }
  }
  if (platform === 'darwin') {
    return { platform, supported: false, message: MACOS_UNAVAILABLE }
  }
  return {
    platform,
    supported: false,
    message: `Unsupported platform: ${platform}`
  }
}

export function assertCaptureSupported(platform: NodeJS.Platform = process.platform): void {
  const support = captureSupport(platform)
  if (!support.supported) {
    throw new Error(support.message ?? 'Capture is not available on this platform.')
  }
}
