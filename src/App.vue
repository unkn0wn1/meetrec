<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { RouterView } from 'vue-router'
import { useRecordingSessionStore } from '@/stores/recordingSession'
import { useSettingsStore } from '@/stores/settings'

const settings = useSettingsStore()
useRecordingSessionStore()

function onFocus(): void {
  void settings.refreshAndValidate()
}

onMounted(() => {
  void settings.refreshAndValidate()
  window.addEventListener('focus', onFocus)
})

onUnmounted(() => {
  window.removeEventListener('focus', onFocus)
})
</script>

<template>
  <div class="relative min-h-screen overflow-x-hidden">
    <div class="pointer-events-none fixed inset-0 -z-10 bg-hero-grid" aria-hidden="true" />
    <div
      class="pointer-events-none fixed -left-32 top-1/3 -z-10 h-96 w-96 rounded-full bg-cyan-500/10 blur-3xl"
      aria-hidden="true"
    />
    <div
      class="pointer-events-none fixed -right-32 bottom-1/4 -z-10 h-96 w-96 rounded-full bg-violet-500/10 blur-3xl"
      aria-hidden="true"
    />
    <RouterView />
  </div>
</template>
