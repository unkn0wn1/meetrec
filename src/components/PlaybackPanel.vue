<script setup lang="ts">
import { onBeforeUnmount, ref, useTemplateRef, watch } from 'vue'
import { Button } from '@/components/ui/button'
import { formatClock } from '@/lib/format'
import { applySeekTime } from '@/lib/playback-seek'

const props = defineProps<{
  audioUrl: string
}>()

const audio = useTemplateRef<HTMLAudioElement>('audio')
const playing = ref(false)
const currentMs = ref(0)
const durationMs = ref(0)
const scrubbing = ref(false)
const pendingSeekMs = ref<number | null>(null)

watch(
  () => props.audioUrl,
  () => {
    playing.value = false
    currentMs.value = 0
    durationMs.value = 0
    scrubbing.value = false
    pendingSeekMs.value = null
  }
)

function play(): void {
  void audio.value?.play()
}

function pause(): void {
  audio.value?.pause()
}

function stop(): void {
  scrubbing.value = false
  pendingSeekMs.value = null
  const node = audio.value
  if (!node) return
  node.pause()
  node.currentTime = 0
  currentMs.value = 0
  playing.value = false
}

function onTime(): void {
  if (scrubbing.value) return
  currentMs.value = Math.round((audio.value?.currentTime ?? 0) * 1000)
}

function onMeta(): void {
  const seconds = audio.value?.duration
  durationMs.value = Number.isFinite(seconds) ? Math.round((seconds ?? 0) * 1000) : 0
  if (pendingSeekMs.value !== null) seekMs(pendingSeekMs.value)
}

function onEnded(): void {
  playing.value = false
}

function onPointerDown(event: PointerEvent): void {
  scrubbing.value = true
  const target = event.currentTarget
  if (target instanceof HTMLElement) {
    try {
      target.setPointerCapture(event.pointerId)
    } catch {
      // Pointer can already be gone; pointerup and blur still clear the flag.
    }
  }
}

function onScrub(event: Event): void {
  const raw = Number((event.target as HTMLInputElement).value)
  seekMs(raw)
}

/**
 * Jump to `ms` without starting or stopping playback.
 * A later transcript click calls this; do not call play() or pause() here.
 */
function seekMs(ms: number): void {
  const node = audio.value
  if (!node || durationMs.value <= 0) {
    pendingSeekMs.value = Number.isFinite(ms) ? Math.max(0, ms) : null
    if (pendingSeekMs.value !== null) currentMs.value = pendingSeekMs.value
    return
  }
  const applied = applySeekTime(node, ms, durationMs.value)
  if (applied === null) return
  pendingSeekMs.value = null
  currentMs.value = applied
}

defineExpose({ seekMs })

onBeforeUnmount(() => {
  audio.value?.pause()
})
</script>

<template>
  <section class="flex flex-col gap-4">
    <p class="font-mono text-3xl tabular-nums">
      {{ formatClock(currentMs) }}
      <span class="text-base text-muted-foreground">/ {{ formatClock(durationMs) }}</span>
    </p>
    <input
      type="range"
      min="0"
      :max="durationMs"
      step="1000"
      :value="currentMs"
      :disabled="durationMs <= 0"
      aria-label="Playback position"
      :aria-valuetext="formatClock(currentMs)"
      class="h-2 w-full cursor-pointer accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
      @pointerdown="onPointerDown"
      @input="onScrub"
      @change="scrubbing = false"
      @pointerup="scrubbing = false"
      @pointercancel="scrubbing = false"
      @blur="scrubbing = false"
    />
    <div class="flex gap-2">
      <Button v-if="!playing" @click="play">Play</Button>
      <Button v-else variant="secondary" @click="pause">Pause</Button>
      <Button variant="outline" @click="stop">Stop</Button>
    </div>
    <audio
      ref="audio"
      :src="audioUrl"
      preload="metadata"
      @play="playing = true"
      @pause="playing = false"
      @timeupdate="onTime"
      @loadedmetadata="onMeta"
      @ended="onEnded"
    />
  </section>
</template>
