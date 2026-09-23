import { defineStore } from 'pinia'
import { ref } from 'vue'
import type {
  LibraryDetail,
  LibraryListItem,
  RecordingMetaView
} from '../../electron/shared/ipc-contract'
import { useMeetrec } from '@/composables/useMeetrec'

export const useLibraryStore = defineStore('library', () => {
  const items = ref<LibraryListItem[]>([])
  const detail = ref<LibraryDetail | null>(null)
  const error = ref<string | null>(null)
  const loading = ref(false)
  const busy = ref(false)

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
    busy.value = true
    error.value = null
    try {
      detail.value = await useMeetrec().library.transcribe(id)
      await refreshQuiet()
    } catch (caught) {
      error.value = messageFrom(caught)
    } finally {
      busy.value = false
    }
  }

  async function summarize(id: string): Promise<void> {
    busy.value = true
    error.value = null
    try {
      detail.value = await useMeetrec().library.summarize(id)
      await refreshQuiet()
    } catch (caught) {
      error.value = messageFrom(caught)
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

  return { items, detail, error, loading, busy, refresh, open, saveSpeakers, transcribe, summarize }
})

function messageFrom(caught: unknown): string {
  if (caught instanceof Error) return caught.message
  return 'Something went wrong.'
}
