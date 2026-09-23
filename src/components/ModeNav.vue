<script setup lang="ts">
import { computed } from 'vue'
import { Settings } from 'lucide-vue-next'
import { useRoute, useRouter } from 'vue-router'
import { Button } from '@/components/ui/button'
import { useCalendarStore } from '@/stores/calendar'

const route = useRoute()
const router = useRouter()
const calendar = useCalendarStore()

const calendarConnected = computed(() => calendar.status?.connected === true)
const calendarTitle = computed(() => {
  if (!calendar.status) return 'Calendar'
  return calendarConnected.value ? 'Calendar' : 'Connect a calendar in Settings'
})

function go(name: 'library' | 'record' | 'calendar' | 'settings'): void {
  if (name === 'calendar' && !calendarConnected.value) return
  void router.push({ name })
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
