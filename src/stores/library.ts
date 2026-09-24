import { defineStore } from 'pinia'
import { ref } from 'vue'
import type {
  LibraryDetail,
  LibraryJobProgress,
  LibraryListItem,
  RecordingMetaView
} from '../../electron/shared/ipc-contract'
import { useMeetrec } from '@/composables/useMeetrec'
import { elapsedLabel, nextJobView, type JobView } from '@/lib/job-progress'

export const useLibraryStore = defineStore('library', () => {
  const items = ref<LibraryListItem[]>([])
  const detail = ref<LibraryDetail | null>(null)
  const error = ref<string | null>(null)
  const loading = ref(false)
  const busy = ref(false)
  const jobProgress = ref<JobView | null>(null)
  const jobElapsed = ref('00:00')
  let sealedStartedAt: number | null = null
  let acceptProgress = false
  let ticker: ReturnType<typeof setInterval> | null = null

  function applyProgress(event: LibraryJobProgress): void {
    if (!acceptProgress) return
    const next = nextJobView(jobProgress.value, sealedStartedAt, event)
    sealedStartedAt = next.sealedStartedAt
    jobProgress.value = next.current
    if (jobProgress.value) startTicker()
    else stopTicker()
  }

  function tick(): void {
    const current = jobProgress.value
    if (!current) {
      jobElapsed.value = '00:00'
      return
    }
    jobElapsed.value = elapsedLabel(current.startedAt, Date.now())
  }

  function startTicker(): void {
    tick()
    if (ticker) return
    ticker = setInterval(tick, 500)
  }

  function stopTicker(): void {
    if (ticker) {
      clearInterval(ticker)
      ticker = null
    }
    if (!jobProgress.value) jobElapsed.value = '00:00'
  }

  function clearJob(): void {
    jobProgress.value = null
    stopTicker()
  }

  function beginJob(): void {
    acceptProgress = true
    clearJob()
    busy.value = true
    error.value = null
  }

  function endJob(): void {
    acceptProgress = false
    clearJob()
    busy.value = false
  }

  if (typeof window !== 'undefined' && window.meetrec) {
    window.meetrec.library.onJobProgress(applyProgress)
  }

  async function refresh(): Promise<void> {
    loading.value = true
    error.value = null
    try {
      items.value = await useMeetrec().library.list()
    } catch (caught) {
      error.value = messageFrom(caught)
    } finally {
      loading.value = false
    }
  }

  async function open(id: string): Promise<void> {
    loading.value = true
    error.value = null
    try {
      detail.value = await useMeetrec().library.detail(id)
    } catch (caught) {
      error.value = messageFrom(caught)
    } finally {
      loading.value = false
    }
  }

  async function saveSpeakers(
    id: string,
    names: Record<string, string>
  ): Promise<RecordingMetaView | null> {
    busy.value = true
    error.value = null
    try {
      const meta = await useMeetrec().library.updateSpeakers(id, names)
      if (detail.value?.meta.id === id) {
        detail.value = { ...detail.value, meta }
      }
      return meta
    } catch (caught) {
      error.value = messageFrom(caught)
      return null
    } finally {
      busy.value = false
    }
  }

  async function transcribe(id: string): Promise<void> {
    beginJob()
    try {
      detail.value = await useMeetrec().library.transcribe(id)
      await refreshQuiet()
    } catch (caught) {
      error.value = messageFrom(caught)
    } finally {
      endJob()
    }
  }

  async function summarize(id: string): Promise<void> {
    beginJob()
    try {
      detail.value = await useMeetrec().library.summarize(id)
      await refreshQuiet()
    } catch (caught) {
      error.value = messageFrom(caught)
    } finally {
      endJob()
    }
  }

  async function remove(id: string): Promise<boolean> {
    busy.value = true
    error.value = null
    try {
      await useMeetrec().library.delete(id)
      items.value = items.value.filter((item) => item.id !== id)
      if (detail.value?.meta.id === id) {
        detail.value = null
      }
      return true
    } catch (caught) {
      error.value = messageFrom(caught)
      return false
    } finally {
      busy.value = false
    }
  }

  async function refreshQuiet(): Promise<void> {
    try {
      items.value = await useMeetrec().library.list()
    } catch {
      // The detail view already shows the action error.
    }
  }

  return {
    items,
    detail,
    error,
    loading,
    busy,
    jobProgress,
    jobElapsed,
    refresh,
    open,
    saveSpeakers,
    transcribe,
    summarize,
    remove
  }
})

function messageFrom(caught: unknown): string {
  if (caught instanceof Error) return caught.message
  return 'Something went wrong.'
}
