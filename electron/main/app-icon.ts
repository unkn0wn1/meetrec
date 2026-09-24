import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { app, nativeImage, type NativeImage } from 'electron'

/** Runtime PNGs live in build/ (dev) and resources/icons/ (packaged). */
export function resolveAppIconPath(file: 'icon.png' | 'tray-icon.png'): string | undefined {
  const candidates = [
    process.resourcesPath ? join(process.resourcesPath, 'icons', file) : '',
    join(app.getAppPath(), 'build', file),
    join(__dirname, '../../build', file)
  ]
  for (const candidate of candidates) {
    if (candidate && existsSync(candidate)) return candidate
  }
  return undefined
}

export function loadWindowIcon(): NativeImage | undefined {
  const path = resolveAppIconPath('icon.png')
  if (!path) return undefined
  const image = nativeImage.createFromPath(path)
  return image.isEmpty() ? undefined : image
}

export function loadTrayImage(): NativeImage {
  const trayPath = resolveAppIconPath('tray-icon.png')
  if (trayPath) {
    const image = nativeImage.createFromPath(trayPath)
    if (!image.isEmpty()) return image.resize({ width: 16, height: 16 })
  }
  const iconPath = resolveAppIconPath('icon.png')
  if (iconPath) {
    const image = nativeImage.createFromPath(iconPath)
    if (!image.isEmpty()) return image.resize({ width: 16, height: 16 })
  }
  return nativeImage.createEmpty()
}
