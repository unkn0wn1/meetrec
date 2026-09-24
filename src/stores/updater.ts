import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import type { UpdateSnapshot } from '../../electron/shared/ipc-contract'
import { useMeetrec } from '@/composables/useMeetrec'
import { useRecordingSessionStore } from '@/stores/recordingSession'

function idleSnapshot(): UpdateSnapshot {
  return {
    phase: 'idle',
    currentVersion: '',
    availableVersion: null,
    message: 'Not checked yet.',
    transferred: null,
    total: null,
    deferred: false
  }
}

export const useUpdaterStore = defineStore('updater', () => {
  const snapshot = ref<UpdateSnapshot>(idleSnapshot())
  const confirming = ref(false)
  const recording = useRecordingSessionStore()

  function apply(next: UpdateSnapshot): void {
    snapshot.value = next
    if (next.phase !== 'ready') confirming.value = false
  }

  if (typeof window !== 'undefined' && window.meetrec) {
    window.meetrec.updater.onChanged((next) => {
      apply(next)
    })
  }

  watch(
    () => recording.isRecording,
    (active) => {
      if (active) confirming.value = false
    }
  )

  async function refresh(): Promise<void> {
    try {
      apply(await useMeetrec().updater.get())
    } catch (caught) {
      apply(failed(snapshot.value, caught))
    }
  }

  async function check(): Promise<void> {
    confirming.value = false
    try {
      apply(await useMeetrec().updater.check())
    } catch (caught) {
      apply(failed(snapshot.value, caught))
    }
  }

  function confirmOrInstall(): void {
    if (snapshot.value.phase !== 'ready' || recording.isRecording) return
    if (!confirming.value) {
      confirming.value = true
      return
    }
    void install()
  }

  async function install(): Promise<void> {
    confirming.value = false
    try {
      apply(await useMeetrec().updater.install())
    } catch (caught) {
      if (snapshot.value.phase === 'ready') apply(failed(snapshot.value, caught))
    }
  }

  return {
    snapshot,
    confirming,
    refresh,
    check,
    confirmOrInstall
  }
})

function failed(current: UpdateSnapshot, caught: unknown): UpdateSnapshot {
  const message = caught instanceof Error ? caught.message : 'Could not check for updates.'
  return {
    ...current,
    phase: 'error',
    message,
    deferred: false
  }
}
