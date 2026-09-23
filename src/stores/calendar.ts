import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { CalendarRecordInput, CalendarStatus } from '../../electron/shared/calendar-contract'
import { useMeetrec } from '@/composables/useMeetrec'

export const useCalendarStore = defineStore('calendar', () => {
  const status = ref<CalendarStatus | null>(null)
  const error = ref<string | null>(null)
  const busy = ref(false)

  function apply(next: CalendarStatus): void {
    status.value = next
  }

  async function run(work: () => Promise<CalendarStatus>): Promise<boolean> {
    busy.value = true
    error.value = null
    try {
      apply(await work())
      return true
    } catch (caught) {
      error.value = caught instanceof Error ? caught.message : 'Something went wrong.'
      return false
    } finally {
      busy.value = false
    }
  }

  async function refresh(): Promise<void> {
    await run(() => useMeetrec().calendar.status())
  }

  async function connectGoogle(connectionId?: string | null): Promise<boolean> {
    return run(() =>
      useMeetrec().calendar.connect({
        provider: 'google',
        purpose: 'calendar',
        connectionId: connectionId ?? null
      })
    )
  }

  async function cancelConnect(): Promise<boolean> {
    return run(() => useMeetrec().calendar.cancelConnect())
  }

  async function disconnectGoogle(connectionId?: string | null): Promise<boolean> {
    return run(() =>
      useMeetrec().calendar.disconnect({ provider: 'google', connectionId: connectionId ?? null })
    )
  }

  async function connectMicrosoft(): Promise<boolean> {
    return run(() => useMeetrec().calendar.connect({ provider: 'microsoft', purpose: 'calendar' }))
  }

  async function connectDrive(
    provider: 'google' | 'microsoft',
    connectionId?: string | null
  ): Promise<boolean> {
    return run(() =>
      useMeetrec().calendar.connect({
        provider,
        purpose: 'drive',
        connectionId: connectionId ?? null
      })
    )
  }

  async function setCalendars(
    provider: 'google' | 'microsoft',
    connectionId: string | null,
    calendarIds: string[]
  ): Promise<boolean> {
    return run(() => useMeetrec().calendar.setCalendars({ provider, connectionId, calendarIds }))
  }

  async function setUpload(provider: 'google' | 'microsoft', enabled: boolean): Promise<boolean> {
    return run(() => useMeetrec().cloud.setUpload({ provider, enabled }))
  }

  async function disconnectMicrosoft(): Promise<boolean> {
    return run(() => useMeetrec().calendar.disconnect({ provider: 'microsoft' }))
  }

  async function dismiss(occurrenceKey: string): Promise<boolean> {
    return run(() => useMeetrec().calendar.dismiss({ occurrenceKey }))
  }

  async function arm(occurrenceKey: string): Promise<boolean> {
    return run(() => useMeetrec().calendar.arm({ occurrenceKey }))
  }

  async function start(occurrenceKey: string): Promise<boolean> {
    return run(() => useMeetrec().calendar.start({ occurrenceKey }))
  }

  async function setRecord(
    occurrenceKey: string,
    enabled: boolean,
    scope: CalendarRecordInput['scope']
  ): Promise<boolean> {
    return run(() => useMeetrec().calendar.setRecord({ occurrenceKey, enabled, scope }))
  }

  if (typeof window !== 'undefined' && window.meetrec) {
    window.meetrec.calendar.onChanged(apply)
    void refresh()
  }

  return {
    status,
    error,
    busy,
    refresh,
    connectGoogle,
    cancelConnect,
    disconnectGoogle,
    connectMicrosoft,
    disconnectMicrosoft,
    connectDrive,
    setCalendars,
    setUpload,
    dismiss,
    arm,
    start,
    setRecord
  }
})
