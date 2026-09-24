import { BrowserWindow, shell } from 'electron'
import type { TrayActionId } from '../domains/calendar/tray-model'
import { CalendarService } from '../domains/calendar/service'
import type { SecretStore } from '../domains/settings/secret-store'
import type { CalendarStatus } from '../shared/calendar-contract'
import { IPC, type RecordingStatus } from '../shared/ipc-contract'
import { quitMeetrec, showMeetrecWindow } from './app-lifecycle'
import { registerCalendarIpc } from './calendar-ipc'
import { registerCloudIpc } from './cloud-ipc'
import { createCalendarPrompt, showCalendarNotice } from './calendar-prompt'
import type { RecordingController } from './recording-controller'
import { createTray } from './tray'

export function attachCalendar(input: {
  mainWindow: BrowserWindow
  secrets: SecretStore
  controller: RecordingController
  userDataDir: () => string
  onRecordingChange?: () => void
}): { stop: () => void; service: CalendarService } {
  const prompt = createCalendarPrompt()
  let promptKey: string | null = null
  let service: CalendarService | null = null

  const tray = createTray(input.mainWindow, (action) => {
    onTrayAction(
      action,
      input.mainWindow,
      input.controller,
      () => service,
      () => promptKey,
      prompt
    )
  })

  service = new CalendarService({
    userDataDir: input.userDataDir,
    secrets: input.secrets,
    openExternal: (url) => shell.openExternal(url),
    recording: input.controller,
    fetchImpl: fetch,
    now: () => Date.now(),
    onStatus: (status) => {
      promptKey = status.prompt?.occurrenceKey ?? null
      broadcast(IPC.calendarChanged, status)
    },
    onTray: (model) => {
      tray.render(model)
    },
    onPrompt: (visible) => {
      if (visible) prompt.show()
      else prompt.hide()
    },
    onNotify: (notice) => {
      showCalendarNotice(notice.title, notice.body, () => {
        prompt.show()
      })
    }
  })

  input.controller.setOnChange((status) => {
    broadcast(IPC.recordingChanged, status)
    input.onRecordingChange?.()
    if (status.phase !== 'recording') void service?.noteStopped()
    service?.renderTray()
  })

  registerCalendarIpc(service)
  registerCloudIpc(service)
  service.start()
  return {
    service,
    stop: () => {
      service.stop()
    }
  }
}

function onTrayAction(
  action: TrayActionId,
  window: BrowserWindow,
  controller: RecordingController,
  service: () => CalendarService | null,
  promptKey: () => string | null,
  prompt: { show: () => void }
): void {
  const calendar = service()
  const key = promptKey()
  if (action === 'show') showMeetrecWindow(window)
  if (action === 'quit') quitMeetrec()
  if (action === 'stop') void controller.stop()
  if (action === 'cancel-arm') void calendar?.cancelArm()
  if (!calendar || !key) return
  if (action === 'start') {
    void calendar.startFromOccurrence({ occurrenceKey: key }).catch(() => {
      prompt.show()
    })
  }
  if (action === 'arm') void calendar.arm({ occurrenceKey: key })
  if (action === 'dismiss') void calendar.dismiss({ occurrenceKey: key })
}

function broadcast(channel: string, payload: CalendarStatus | RecordingStatus): void {
  for (const window of BrowserWindow.getAllWindows()) {
    if (window.isDestroyed()) continue
    window.webContents.send(channel, payload)
  }
}
