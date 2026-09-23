import { BrowserWindow, Notification } from 'electron'
import { isAppQuitting } from './app-lifecycle'
import { loadRenderer, preloadPath } from './renderer-window'

export interface CalendarPrompt {
  show: () => void
  hide: () => void
}

export function createCalendarPrompt(): CalendarPrompt {
  let window: BrowserWindow | null = null

  const ensure = (): BrowserWindow => {
    if (window && !window.isDestroyed()) return window
    const created = new BrowserWindow({
      width: 420,
      height: 300,
      show: false,
      alwaysOnTop: true,
      autoHideMenuBar: true,
      resizable: false,
      title: 'meetrec',
      webPreferences: {
        preload: preloadPath(),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false
      }
    })
    created.on('close', (event) => {
      if (isAppQuitting()) return
      event.preventDefault()
      created.hide()
    })
    loadRenderer(created, '/calendar-prompt')
    window = created
    return created
  }

  return {
    show: () => {
      const prompt = ensure()
      prompt.show()
      prompt.focus()
    },
    hide: () => {
      if (window && !window.isDestroyed()) window.hide()
    }
  }
}

export function showCalendarNotice(title: string, body: string, onClick: () => void): void {
  if (!Notification.isSupported()) return
  const notice = new Notification({ title, body })
  notice.on('click', onClick)
  notice.show()
}
