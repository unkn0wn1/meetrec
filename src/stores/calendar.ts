import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { CalendarStatus } from '../../electron/shared/calendar-contract'
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

  async function saveGoogle(clientId: string, clientSecret: string): Promise<boolean> {
    return run(() => useMeetrec().calendar.saveGoogleClient({ clientId, clientSecret }))
  }

  async function clearGoogleSecret(): Promise<boolean> {
    return run(() => useMeetrec().calendar.clearGoogleSecret())
  }

  async function connectGoogle(): Promise<boolean> {
    return run(() => useMeetrec().calendar.connect({ provider: 'google', purpose: 'calendar' }))
  }

  async function cancelConnect(): Promise<boolean> {
    return run(() => useMeetrec().calendar.cancelConnect())
  }

  async function disconnectGoogle(): Promise<boolean> {
    return run(() => useMeetrec().calendar.disconnect({ provider: 'google' }))
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

  if (typeof window !== 'undefined' && window.meetrec) {
    window.meetrec.calendar.onChanged(apply)
    void refresh()
  }

  return {
    status,
    error,
    busy,
    refresh,
    saveGoogle,
    clearGoogleSecret,
    connectGoogle,
    cancelConnect,
    disconnectGoogle,
    dismiss,
    arm,
    start
  }
})
