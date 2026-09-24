<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import AppShell from '@/components/AppShell.vue'
import CalendarEventRow from '@/components/CalendarEventRow.vue'
import { Button } from '@/components/ui/button'
import { useCalendarStore } from '@/stores/calendar'
import type {
  CalendarEventView,
  CalendarRecordInput
} from '../../electron/shared/calendar-contract'

const calendar = useCalendarStore()
const router = useRouter()
const pendingKey = ref<string | null>(null)
const pendingMode = ref<'skip' | 'restore' | null>(null)

const connected = computed(() => calendar.status?.connected === true)
const events = computed(() => calendar.status?.upcoming ?? [])

function choosing(event: CalendarEventView): 'skip' | 'restore' | null {
  if (pendingKey.value !== event.occurrenceKey) return null
  return pendingMode.value
}

function shownRecord(event: CalendarEventView): boolean {
  if (pendingKey.value !== event.occurrenceKey || !pendingMode.value) return event.record
  return pendingMode.value === 'restore'
}

function clearPending(): void {
  pendingKey.value = null
  pendingMode.value = null
}

function onToggle(event: CalendarEventView, checked: boolean): void {
  if (checked) {
    if (event.seriesSkipped) {
      pendingKey.value = event.occurrenceKey
      pendingMode.value = 'restore'
      return
    }
    clearPending()
    void calendar.setRecord(event.occurrenceKey, true, 'occurrence')
    return
  }
  if (event.seriesId) {
    pendingKey.value = event.occurrenceKey
    pendingMode.value = 'skip'
    return
  }
  clearPending()
  void calendar.setRecord(event.occurrenceKey, false, 'occurrence')
}

function onChoose(event: CalendarEventView, scope: CalendarRecordInput['scope']): void {
  const enabled = pendingMode.value === 'restore'
  clearPending()
  void calendar.setRecord(event.occurrenceKey, enabled, scope)
}

function openCalendars(): void {
  void router.push({ name: 'settings', query: { section: 'calendars' } })
}
</script>

<template>
  <AppShell title="Calendar">
    <template #subtitle>
      <p class="mt-1 text-sm text-muted-foreground">
        Timed events for the next 14 days. Uncheck a meeting to skip the prompt, auto-arm, and tray
        actions.
      </p>
    </template>

    <p v-if="calendar.error" class="text-sm text-destructive" role="alert">{{ calendar.error }}</p>

    <section v-if="!calendar.status" class="text-sm text-muted-foreground">
      Loading calendar…
    </section>

    <section v-else-if="!connected" class="glass p-8">
      <p class="font-medium">Connect a calendar in Settings</p>
      <p class="mt-2 text-sm text-muted-foreground">
        Google or Microsoft calendar unlocks this list.
      </p>
      <Button class="mt-4" @click="openCalendars">Open Calendars</Button>
    </section>

    <section v-else-if="events.length === 0" class="glass p-8">
      <p class="font-medium">No timed events in the next 14 days</p>
    </section>

    <section v-else class="glass overflow-hidden">
      <ul class="divide-y">
        <CalendarEventRow
          v-for="event in events"
          :key="event.occurrenceKey"
          :event="event"
          :checked="shownRecord(event)"
          :choosing="choosing(event)"
          :busy="calendar.busy"
          @toggle="onToggle(event, $event)"
          @choose="onChoose(event, $event)"
          @cancel="clearPending"
        />
      </ul>
    </section>
  </AppShell>
</template>
