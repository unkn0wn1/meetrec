<script setup lang="ts">
import { onUnmounted, watch } from 'vue'
import ProviderCard from '@/components/ProviderCard.vue'
import { useSettingsStore } from '@/stores/settings'

const settings = useSettingsStore()
let pollTimer: ReturnType<typeof setTimeout> | null = null

watch(
  () => settings.oauthPending,
  (pending) => {
    clearPoll()
    if (pending) schedulePoll()
  },
  { immediate: true }
)

onUnmounted(() => {
  clearPoll()
})

function schedulePoll(): void {
  const seconds = settings.oauthIntervalSec ?? 5
  pollTimer = setTimeout(
    () => {
      void settings.pollXaiOAuth().finally(() => {
        if (settings.oauthPending) schedulePoll()
      })
    },
    Math.max(seconds, 1) * 1000
  )
}

function clearPoll(): void {
  if (pollTimer) clearTimeout(pollTimer)
  pollTimer = null
}
</script>

<template>
  <section class="flex flex-col gap-4">
    <div>
      <h2 class="text-lg font-semibold tracking-tight">Providers</h2>
      <p class="mt-1 text-sm text-muted-foreground">
        Pick one Voice default and one AI default. Transcribe uses the Voice default. Generate
        summary uses the AI default. Secrets stay in the main process and are never loaded back into
        this window.
      </p>
    </div>

    <p v-if="settings.error" class="text-sm text-destructive" role="alert">{{ settings.error }}</p>
    <p
      v-else-if="settings.loading && settings.cards.length === 0"
      class="text-sm text-muted-foreground"
    >
      Loading settings…
    </p>

    <ProviderCard v-for="card in settings.cards" :key="card.id" :card="card" />
  </section>
</template>
