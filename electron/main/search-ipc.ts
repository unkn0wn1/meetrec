import { BrowserWindow, ipcMain } from 'electron'
import { createSearchService, type SearchDeps, type SearchService } from '../domains/search/service'
import type { SearchScheduleInput } from '../shared/search-contract'
import { SEARCH_IPC } from '../shared/search-contract'

export interface SearchHooks {
  notifyTranscript: (id: string) => void
  notifySummary: (id: string) => void
  notifySpeakers: (id: string) => void
  notifyDelete: (id: string) => void
  stop: () => void
}

export function attachSearch(deps: SearchDeps): SearchHooks {
  const service = createSearchService(deps)
  registerSearchIpc(service)
  void service.start()
  return {
    notifyTranscript: (id) => service.notifyTranscript(id),
    notifySummary: (id) => service.notifySummary(id),
    notifySpeakers: (id) => service.notifySpeakers(id),
    notifyDelete: (id) => service.notifyDelete(id),
    stop: () => service.stop()
  }
}

export function registerSearchIpc(service: SearchService): void {
  ipcMain.handle(SEARCH_IPC.get, () => service.snapshot())
  ipcMain.handle(SEARCH_IPC.preflight, () => service.preflight())
  ipcMain.handle(SEARCH_IPC.enable, () => service.enable())
  ipcMain.handle(SEARCH_IPC.disable, () => service.disable())
  ipcMain.handle(SEARCH_IPC.setSchedule, (_event, input: unknown) => {
    const schedule = parseSchedule(input)
    if (!schedule) return Promise.reject(new Error('Choose a meeting search schedule.'))
    return service.setSchedule(schedule)
  })
  ipcMain.handle(SEARCH_IPC.indexAll, () => service.indexAll())
  ipcMain.handle(SEARCH_IPC.rebuild, () => service.rebuild())
  ipcMain.handle(SEARCH_IPC.retry, (_event, id: unknown) => {
    if (typeof id !== 'string') throw new Error('Unknown recording.')
    return service.retry(id)
  })
  ipcMain.handle(SEARCH_IPC.cancelDownload, () => service.cancelDownload())
  ipcMain.handle(SEARCH_IPC.query, (_event, text: unknown) => {
    if (typeof text !== 'string') return []
    return service.query(text)
  })
  service.onChange((snapshot) => {
    for (const window of BrowserWindow.getAllWindows()) {
      if (window.isDestroyed()) continue
      window.webContents.send(SEARCH_IPC.changed, snapshot)
    }
  })
}

function parseSchedule(input: unknown): SearchScheduleInput | null {
  if (!input || typeof input !== 'object') return null
  const record = input as Record<string, unknown>
  if (typeof record.indexAfterTranscript !== 'boolean') return null
  if (typeof record.indexAfterSummary !== 'boolean') return null
  if (typeof record.idleCatchUp !== 'boolean') return null
  return {
    indexAfterTranscript: record.indexAfterTranscript,
    indexAfterSummary: record.indexAfterSummary,
    idleCatchUp: record.idleCatchUp
  }
}
