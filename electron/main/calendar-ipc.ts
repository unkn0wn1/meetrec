import { ipcMain } from 'electron'
import type { CalendarService } from '../domains/calendar/service'
import { IPC } from '../shared/ipc-contract'

export function registerCalendarIpc(calendar: CalendarService): void {
  ipcMain.handle(IPC.calendarStatus, () => calendar.status())
  ipcMain.handle(IPC.calendarConnect, (_event, input: unknown) => {
    const record = objectInput(input)
    return calendar.connect({ provider: record.provider, purpose: record.purpose })
  })
  ipcMain.handle(IPC.calendarCancelConnect, () => calendar.cancelConnect())
  ipcMain.handle(IPC.calendarDisconnect, (_event, input: unknown) => {
    const record = objectInput(input)
    return calendar.disconnect({ provider: record.provider })
  })
  ipcMain.handle(IPC.calendarDismiss, (_event, input: unknown) => {
    const record = objectInput(input)
    return calendar.dismiss({ occurrenceKey: record.occurrenceKey })
  })
  ipcMain.handle(IPC.calendarArm, (_event, input: unknown) => {
    const record = objectInput(input)
    return calendar.arm({ occurrenceKey: record.occurrenceKey })
  })
  ipcMain.handle(IPC.calendarCancelArm, () => calendar.cancelArm())
  ipcMain.handle(IPC.calendarStart, (_event, input: unknown) => {
    const record = objectInput(input)
    return calendar.startFromOccurrence({ occurrenceKey: record.occurrenceKey })
  })
  ipcMain.handle(IPC.calendarList, () => calendar.list())
  ipcMain.handle(IPC.calendarSetRecord, (_event, input: unknown) => {
    const record = objectInput(input)
    return calendar.setRecord({
      occurrenceKey: record.occurrenceKey,
      enabled: record.enabled,
      scope: record.scope
    })
  })
}

function objectInput(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object') throw new Error('That request was not understood.')
  return value as Record<string, unknown>
}
