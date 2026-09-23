<script setup lang="ts">
import type { CalendarChoice } from '../../electron/shared/calendar-contract'

const props = defineProps<{
  calendars: CalendarChoice[]
  busy: boolean
}>()

const emit = defineEmits<{
  change: [calendarIds: string[]]
}>()

function onToggle(id: string, event: Event): void {
  const checked = event.target instanceof HTMLInputElement && event.target.checked
  const current = props.calendars.filter((item) => item.selected).map((item) => item.id)
  const next = checked ? [...current, id] : current.filter((item) => item !== id)
  emit('change', next)
}
</script>

<template>
  <ul class="flex flex-col gap-1">
    <li v-for="calendar in calendars" :key="calendar.id">
      <label class="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          :checked="calendar.selected"
          :disabled="busy"
          @change="onToggle(calendar.id, $event)"
        />
        <span class="truncate">{{ calendar.summary }}</span>
        <span v-if="calendar.primary" class="text-muted-foreground">Primary</span>
      </label>
    </li>
  </ul>
</template>
