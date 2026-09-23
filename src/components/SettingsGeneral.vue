<script setup lang="ts">
import { computed } from 'vue'
import { version } from '../../package.json'
import { effectiveDestination } from '../../electron/shared/destination'
import { useCalendarStore } from '@/stores/calendar'
import { useSettingsStore } from '@/stores/settings'
import type { RecordingDestination } from '../../electron/shared/ipc-contract'

const settings = useSettingsStore()
const calendar = useCalendarStore()

const googleReady = computed(
  () =>
    calendar.status?.google.connected === true &&
    calendar.status.google.uploadEnabled &&
    calendar.status.google.uploadScopeGranted
)
const microsoftReady = computed(
  () =>
    calendar.status?.microsoft.connected === true &&
    calendar.status.microsoft.uploadEnabled &&
    calendar.status.microsoft.uploadScopeGranted
)
const selected = computed(() =>
  effectiveDestination(settings.destination, {
    google: googleReady.value,
    microsoft: microsoftReady.value
  })
)

function chooseDestination(destination: RecordingDestination): void {
  void settings.setDestination(destination)
}

function onAutoRecord(event: Event): void {
  const checked = event.target instanceof HTMLInputElement && event.target.checked
  void settings.setAutoRecord(checked)
}
</script>

<template>
  <section class="flex flex-col gap-6">
    <div>
      <h2 class="text-lg font-semibold tracking-tight">General</h2>
      <p class="mt-1 text-sm text-muted-foreground">
        Version <span class="font-medium tabular-nums">{{ version }}</span>
      </p>
    </div>

    <fieldset class="flex flex-col gap-2" :disabled="settings.saving">
      <legend class="text-sm font-semibold">Default destination</legend>
      <p class="text-sm text-muted-foreground">
        Local files stay on this computer. Drive and OneDrive appear here after you connect that
        calendar and turn on its upload.
      </p>
      <label class="flex items-center gap-2 text-sm">
        <input
          type="radio"
          name="destination"
          value="local"
          :checked="selected === 'local'"
          @change="chooseDestination('local')"
        />
        Local only
      </label>
      <label v-if="googleReady" class="flex items-center gap-2 text-sm">
        <input
          type="radio"
          name="destination"
          value="google"
          :checked="selected === 'google'"
          @change="chooseDestination('google')"
        />
        Google Drive
      </label>
      <label v-if="microsoftReady" class="flex items-center gap-2 text-sm">
        <input
          type="radio"
          name="destination"
          value="microsoft"
          :checked="selected === 'microsoft'"
          @change="chooseDestination('microsoft')"
        />
        OneDrive
      </label>
    </fieldset>

    <label class="flex items-start gap-2 text-sm">
      <input
        class="mt-0.5"
        type="checkbox"
        :checked="settings.autoRecord"
        :disabled="settings.saving"
        @change="onAutoRecord"
      />
      <span>
        <span class="font-medium">Enable auto-record for selected meetings</span>
        <span class="mt-1 block text-muted-foreground">
          When this is off, meetrec opens the 10-minute prompt. When it is on, meetrec posts a
          notification and starts recording one minute before. Meetings you uncheck on Calendar are
          skipped.
        </span>
      </span>
    </label>
  </section>
</template>
