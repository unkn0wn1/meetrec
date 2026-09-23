import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { BrowserWindow } from 'electron'
import { is } from '@electron-toolkit/utils'

export function preloadPath(): string {
  const js = join(__dirname, '../preload/index.js')
  if (existsSync(js)) return js
  return join(__dirname, '../preload/index.mjs')
}

export function loadRenderer(window: BrowserWindow, hashPath = '/'): void {
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    void window.loadURL(`${process.env['ELECTRON_RENDERER_URL']}#${hashPath}`)
  } else {
    void window.loadFile(join(__dirname, '../renderer/index.html'), { hash: hashPath })
  }
}
