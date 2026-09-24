import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { CaptureMode, RecordingPhase } from '../../electron/shared/ipc-contract'
import { formatDuration } from '../../electron/capture/duration'
import { useMeetrec } from '@/composables/useMeetrec'

export const useRecordingSessionStore = defineStore('recordingSession', () => {
  const phase = ref<RecordingPhase>('idle')
  const outPath = ref<string | null>(null)
  const startedAt = ref<string | null>(null)
  const captureMode = ref<CaptureMode | null>(null)
  const note = ref<string | null>(null)
  const error = ref<string | null>(null)
  const captureSupported = ref(true)
  const unsupportedReason = ref<string | null>(null)
  const busy = ref(false)
  const elapsedLabel = ref('00:00')
  let ticker: ReturnType<typeof setInterval> | null = null

  const isRecording = computed(() => phase.value === 'recording')

  function applyStatus(status: {
    phase: RecordingPhase
    outPath: string | null
    startedAt: string | null
    captureMode: CaptureMode | null
    note: string | null
    captureSupported: boolean
    unsupportedReason: string | null
  }): void {
    phase.value = status.phase
    outPath.value = status.outPath
    startedAt.value = status.startedAt
    captureMode.value = status.captureMode
    note.value = status.note
    captureSupported.value = status.captureSupported
    unsupportedReason.value = status.unsupportedReason
  }

  function tick(): void {
    if (!startedAt.value) {
      elapsedLabel.value = '00:00'
      return
    }
    const started = Date.parse(startedAt.value)
    elapsedLabel.value = formatDuration(Date.now() - started)
  }

  function startTicker(): void {
    stopTicker()
    tick()
    ticker = setInterval(tick, 500)
  }

  function stopTicker(): void {
    if (ticker) {
      clearInterval(ticker)
      ticker = null
    }
  }

  if (typeof window !== 'undefined' && window.meetrec) {
    window.meetrec.recording.onChanged((status) => {
      applyStatus(status)
      if (status.phase === 'recording') startTicker()
      else stopTicker()
    })
  }

  async function refresh(): Promise<void> {
    const status = await useMeetrec().recording.status()
    applyStatus(status)
    if (status.phase === 'recording') startTicker()
    else {
      stopTicker()
      elapsedLabel.value = '00:00'
    }
  }

  async function start(): Promise<void> {
    if (!captureSupported.value) {
      error.value = unsupportedReason.value ?? 'Capture is not available on this platform.'
      return
    }
    busy.value = true
    error.value = null
    try {
      const result = await useMeetrec().recording.start()
      phase.value = 'recording'
      outPath.value = result.outPath
      captureMode.value = result.captureMode
      note.value = result.note
      startedAt.value = new Date().toISOString()
      startTicker()
    } catch (caught) {
      error.value = messageFrom(caught)
    } finally {
      busy.value = false
    }
  }

  async function stop(): Promise<void> {
    busy.value = true
    error.value = null
    try {
      const result = await useMeetrec().recording.stop()
      stopTicker()
      phase.value = 'idle'
      outPath.value = result.outPath
      captureMode.value = result.captureMode
      startedAt.value = null
      elapsedLabel.value = formatDuration(result.durationMs)
    } catch (caught) {
      error.value = messageFrom(caught)
    } finally {
      busy.value = false
    }
  }

  return {
    phase,
    outPath,
    startedAt,
    captureMode,
    note,
    error,
    captureSupported,
    unsupportedReason,
    busy,
    elapsedLabel,
    isRecording,
    refresh,
    start,
    stop
  }
})

function messageFrom(caught: unknown): string {
  if (caught instanceof Error) return caught.message
  return 'Something went wrong.'
}
