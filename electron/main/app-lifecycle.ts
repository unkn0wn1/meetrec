import { app, BrowserWindow } from 'electron'

let quitting = false

export function isAppQuitting(): boolean {
  return quitting
}

export function markAppQuitting(): void {
  quitting = true
}

/** Bring a hidden or minimized window back. */
export function showMeetrecWindow(window: BrowserWindow): void {
  window.setSkipTaskbar(false)
  if (window.isMinimized()) {
    window.restore()
  }
  window.show()
  window.moveTop()
  window.focus()
}

function hideToTray(window: BrowserWindow): void {
  if (window.isMinimized()) {
    window.restore()
  }
  window.setSkipTaskbar(true)
  window.hide()
}

/**
 * Close (X) → hide to tray.
 * Minimize → leave as a normal WM minimize (stays in the bottom icon list).
 * Quit from the tray menu → exit.
 */
export function attachHideToTray(window: BrowserWindow): void {
  window.on('close', (event) => {
    if (quitting) return
    event.preventDefault()
    hideToTray(window)
  })
}

export function quitMeetrec(): void {
  markAppQuitting()
  for (const window of BrowserWindow.getAllWindows()) {
    window.destroy()
  }
  app.quit()
}
