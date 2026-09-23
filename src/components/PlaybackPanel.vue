<script setup lang="ts">
import { onBeforeUnmount, ref, useTemplateRef, watch } from 'vue'
import { Button } from '@/components/ui/button'
import { formatClock } from '@/lib/format'

const props = defineProps<{
  audioUrl: string
}>()

const audio = useTemplateRef<HTMLAudioElement>('audio')
const playing = ref(false)
const currentMs = ref(0)
const durationMs = ref(0)

watch(
  () => props.audioUrl,
  () => {
    playing.value = false
    currentMs.value = 0
    durationMs.value = 0
  }
)

function play(): void {
  void audio.value?.play()
}

function pause(): void {
  audio.value?.pause()
}

function stop(): void {
  const node = audio.value
  if (!node) return
  node.pause()
  node.currentTime = 0
  currentMs.value = 0
  playing.value = false
}

function onTime(): void {
  currentMs.value = Math.round((audio.value?.currentTime ?? 0) * 1000)
}

function onMeta(): void {
  const seconds = audio.value?.duration
  durationMs.value = Number.isFinite(seconds) ? Math.round((seconds ?? 0) * 1000) : 0
}

function onEnded(): void {
  playing.value = false
}

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
