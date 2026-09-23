<script setup lang="ts">
import { computed, onUnmounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import CalendarSettings from '@/components/CalendarSettings.vue'
import SettingsGeneral from '@/components/SettingsGeneral.vue'
import SettingsProviders from '@/components/SettingsProviders.vue'
import { Button } from '@/components/ui/button'
import { useSettingsStore } from '@/stores/settings'

const settings = useSettingsStore()
const route = useRoute()
const router = useRouter()
let pollTimer: ReturnType<typeof setTimeout> | null = null

const section = computed(() => {
  const value = route.query.section
  if (value === 'providers' || value === 'calendars' || value === 'general') return value
  return 'general'
})

const sections = [
  { id: 'general', label: 'General' },
  { id: 'providers', label: 'Providers' },
  { id: 'calendars', label: 'Calendars' }
] as const

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

function open(next: (typeof sections)[number]['id']): void {
  if (next === section.value && route.query.section === next) return
  void router.push({ name: 'settings', query: { section: next } })
}

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
  <div class="flex gap-8">
    <nav class="flex w-36 shrink-0 flex-col gap-1" aria-label="Settings sections">
      <Button
        v-for="item in sections"
        :key="item.id"
        type="button"
        variant="ghost"
        class="justify-start"
        :class="section === item.id ? 'bg-accent text-accent-foreground' : ''"
        :aria-current="section === item.id ? 'page' : undefined"
        @click="open(item.id)"
      >
        {{ item.label }}
      </Button>
    </nav>
    <div class="min-w-0 flex-1">
      <SettingsGeneral v-if="section === 'general'" />
      <SettingsProviders v-else-if="section === 'providers'" />
      <CalendarSettings v-else />
    </div>
  </div>
</template>
