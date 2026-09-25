<script setup lang="ts">
import { computed } from 'vue'
import { Loader2, Search, Settings } from 'lucide-vue-next'
import { useRoute, useRouter } from 'vue-router'
import { Button } from '@/components/ui/button'
import { useCalendarStore } from '@/stores/calendar'
import { useMeetingSearchStore } from '@/stores/meeting-search'

const route = useRoute()
const router = useRouter()
const calendar = useCalendarStore()
const search = useMeetingSearchStore()

const calendarConnected = computed(() => calendar.status?.connected === true)
const calendarTitle = computed(() => {
  if (!calendar.status) return 'Calendar'
  return calendarConnected.value ? 'Calendar' : 'Connect a calendar in Settings'
})

const searchReady = computed(
  () =>
    search.snapshot.prefs.enabled &&
    search.snapshot.modelsReady &&
    search.snapshot.phase === 'ready'
)
const searchDownloading = computed(
  () => search.snapshot.phase === 'downloading' || search.snapshot.phase === 'installing'
)
const searchTitle = computed(() => {
  if (searchDownloading.value) {
    const label = search.snapshot.download?.label || 'models'
    const megabytes = ((search.snapshot.download?.bytes ?? 0) / (1024 * 1024)).toFixed(1)
    return `Downloading ${label}… ${megabytes} MB. Meeting search in Settings.`
  }
  if (search.snapshot.phase === 'error' && search.snapshot.error) {
    return `${search.snapshot.error} Meeting search in Settings.`
  }
  if (!searchReady.value) return 'Turn on Meeting search in Settings'
  return 'Search meetings'
})

function go(name: 'library' | 'record' | 'calendar' | 'settings'): void {
  if (name === 'calendar' && !calendarConnected.value) return
  void router.push({ name })
}

function openSearch(): void {
  if (!searchReady.value) return
  search.openDialog()
}
</script>

<template>
  <nav class="flex items-center gap-2" aria-label="Modes">
    <Button
      size="sm"
      :variant="route.name === 'library' || route.name === 'recording' ? 'default' : 'outline'"
      @click="go('library')"
    >
      Library
    </Button>
    <Button
      size="sm"
      :variant="route.name === 'record' ? 'default' : 'outline'"
      @click="go('record')"
    >
      Record
    </Button>
    <span class="inline-flex" :title="calendarTitle">
      <Button
        size="sm"
        :variant="route.name === 'calendar' ? 'default' : 'outline'"
        :disabled="!calendarConnected"
        @click="go('calendar')"
      >
        Calendar
      </Button>
    </span>
    <span class="inline-flex" :title="searchTitle">
      <Button
        size="icon"
        variant="outline"
        aria-label="Search meetings"
        :disabled="!searchReady"
        @click="openSearch"
      >
        <Loader2 v-if="searchDownloading" class="size-4 animate-spin" />
        <Search v-else class="size-4" />
      </Button>
    </span>
    <Button
      size="icon"
      variant="outline"
      aria-label="Settings"
      title="Settings"
      :class="route.name === 'settings' ? 'bg-accent text-accent-foreground' : ''"
      @click="go('settings')"
    >
      <Settings class="size-4" />
    </Button>
  </nav>
</template>
