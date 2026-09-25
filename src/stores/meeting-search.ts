import { defineStore } from 'pinia'
import { ref } from 'vue'
import type {
  SearchHit,
  SearchScheduleInput,
  SearchSnapshot
} from '../../electron/shared/search-contract'
import { useMeetrec } from '@/composables/useMeetrec'

function emptySnapshot(): SearchSnapshot {
  return {
    prefs: {
      enabled: false,
      indexAfterTranscript: true,
      indexAfterSummary: true,
      idleCatchUp: false
    },
    phase: 'off',
    modelsReady: false,
    download: null,
    index: { running: false, currentId: null },
    error: null,
    records: {},
    runtime: { nodeOk: false, qmdOnPath: false, installed: false, needsDownload: true }
  }
}

export const useMeetingSearchStore = defineStore('meeting-search', () => {
  const snapshot = ref<SearchSnapshot>(emptySnapshot())
  const dialogOpen = ref(false)
  const hits = ref<SearchHit[]>([])
  const queryError = ref<string | null>(null)
  const querying = ref(false)

  function apply(next: SearchSnapshot): void {
    snapshot.value = next
  }

  if (typeof window !== 'undefined' && window.meetrec) {
    window.meetrec.search.onChanged(apply)
    void refresh()
  }

  async function refresh(): Promise<void> {
    apply(await useMeetrec().search.get())
  }

  function openDialog(): void {
    dialogOpen.value = true
    hits.value = []
    queryError.value = null
  }

  function closeDialog(): void {
    dialogOpen.value = false
  }

  async function preflight(): Promise<void> {
    apply(await useMeetrec().search.preflight())
  }

  async function enable(): Promise<void> {
    apply(await useMeetrec().search.enable())
  }

  async function disable(): Promise<void> {
    apply(await useMeetrec().search.disable())
  }

  async function setSchedule(input: SearchScheduleInput): Promise<void> {
    apply(await useMeetrec().search.setSchedule(input))
  }

  async function indexAll(): Promise<void> {
    apply(await useMeetrec().search.indexAll())
  }

  async function rebuild(): Promise<void> {
    apply(await useMeetrec().search.rebuild())
  }

  async function retry(id: string): Promise<void> {
    apply(await useMeetrec().search.retry(id))
  }

  async function cancelDownload(): Promise<void> {
    apply(await useMeetrec().search.cancelDownload())
  }

  async function runQuery(text: string): Promise<void> {
    querying.value = true
    queryError.value = null
    try {
      hits.value = await useMeetrec().search.query(text)
    } catch (caught) {
      hits.value = []
      queryError.value = caught instanceof Error ? caught.message : 'Search failed.'
    } finally {
      querying.value = false
    }
  }

  return {
    snapshot,
    dialogOpen,
    hits,
    queryError,
    querying,
    refresh,
    openDialog,
    closeDialog,
    preflight,
    enable,
    disable,
    setSchedule,
    indexAll,
    rebuild,
    retry,
    cancelDownload,
    runQuery
  }
})
