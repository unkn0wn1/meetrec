<script setup lang="ts">
import type { CalendarEventView } from '../../electron/shared/calendar-contract'
import { Button } from '@/components/ui/button'
import { formatEventWhen } from '@/lib/format'

defineProps<{
  event: CalendarEventView
  checked: boolean
  choosing: 'skip' | 'restore' | null
  busy: boolean
}>()

const emit = defineEmits<{
  toggle: [checked: boolean]
  choose: [scope: 'occurrence' | 'series']
  cancel: []
}>()

function onChange(domEvent: Event): void {
  const input = domEvent.target
  if (!(input instanceof HTMLInputElement)) return
  emit('toggle', input.checked)
}
</script>

<template>
  <li class="flex flex-col gap-3 px-4 py-3">
    <div class="flex items-start justify-between gap-4">
      <div class="min-w-0">
        <p class="truncate font-medium">{{ event.title }}</p>
        <p class="mt-1 text-sm text-muted-foreground">
          {{ formatEventWhen(event.startsAt) }} ·
          {{ event.provider === 'google' ? 'Google' : 'Microsoft' }}
        </p>
      </div>
      <label class="flex shrink-0 items-center gap-2 text-sm">
        <input type="checkbox" :checked="checked" :disabled="busy" @change="onChange" />
        Record with meetrec
      </label>
    </div>
    <div
      v-if="choosing === 'skip'"
      class="flex flex-wrap items-center gap-2 rounded-lg bg-muted px-3 py-2"
      role="group"
      aria-label="Skip recording"
    >
      <p class="text-sm">This event repeats. Skip recording for</p>
      <Button size="sm" variant="outline" type="button" @click="emit('choose', 'occurrence')">
        This occurrence
      </Button>
      <Button size="sm" variant="outline" type="button" @click="emit('choose', 'series')">
        Entire series
      </Button>
      <Button size="sm" variant="ghost" type="button" @click="emit('cancel')"
        >Keep recording</Button
      >
    </div>
    <div
      v-else-if="choosing === 'restore'"
      class="flex flex-wrap items-center gap-2 rounded-lg bg-muted px-3 py-2"
      role="group"
      aria-label="Record the series"
    >
      <p class="text-sm">Record the entire series again?</p>
      <Button size="sm" type="button" @click="emit('choose', 'series')">Entire series</Button>
      <Button size="sm" variant="ghost" type="button" @click="emit('cancel')">Cancel</Button>
    </div>
  </li>
</template>
