<script setup lang="ts">
import { computed } from 'vue'
import { version } from '../../package.json'
import { effectiveDestination } from '../../electron/shared/destination'
import SettingsMeetingSearch from '@/components/SettingsMeetingSearch.vue'
import { Button } from '@/components/ui/button'
import { useCalendarStore } from '@/stores/calendar'
import { useRecordingSessionStore } from '@/stores/recordingSession'
import { useSettingsStore } from '@/stores/settings'
import { useUpdaterStore } from '@/stores/updater'
import {
  SILENCE_AUTO_STOP_SECONDS_MAX,
  SILENCE_AUTO_STOP_SECONDS_MIN,
  type RecordingDestination
} from '../../electron/shared/ipc-contract'

const settings = useSettingsStore()
const calendar = useCalendarStore()
const updater = useUpdaterStore()
const recording = useRecordingSessionStore()

const updateBusy = computed(
  () => updater.snapshot.phase === 'checking' || updater.snapshot.phase === 'downloading'
)
const canRestart = computed(() => updater.snapshot.phase === 'ready' && !recording.isRecording)
const updateFailed = computed(() => updater.snapshot.phase === 'error')

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

function onSilenceAutoStop(event: Event): void {
  const checked = event.target instanceof HTMLInputElement && event.target.checked
  void settings.setSilenceAutoStop(checked, settings.silenceAutoStopSeconds)
}

function onSilenceSeconds(event: Event): void {
  const raw = event.target instanceof HTMLInputElement ? Number(event.target.value) : Number.NaN
  if (!Number.isFinite(raw)) return
  void settings.setSilenceAutoStop(true, raw)
}
</script>

<template>
  <section class="flex flex-col gap-6">
    <div>
      <h2 class="text-lg font-semibold tracking-tight">General</h2>
      <p class="mt-1 text-sm text-muted-foreground">
        Version <span class="font-medium tabular-nums">{{ version }}</span>
      </p>
      <p
        class="mt-2 text-sm"
        :class="updateFailed ? 'text-destructive' : 'text-muted-foreground'"
        :role="updateFailed ? 'alert' : 'status'"
        aria-live="polite"
      >
        {{ updater.snapshot.message }}
      </p>
      <div class="mt-3 flex flex-wrap items-center gap-3">
        <Button variant="outline" :disabled="updateBusy" @click="updater.check()">
          Check for updates
        </Button>
        <Button v-if="canRestart" @click="updater.confirmOrInstall()">Restart and install</Button>
      </div>
      <p v-if="updater.confirming && canRestart" class="mt-2 text-sm text-muted-foreground">
        This closes meetrec and installs the update.
      </p>
    </div>

    <p v-if="settings.error" class="text-sm text-destructive" role="alert">{{ settings.error }}</p>

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

    <div class="flex flex-col gap-3">
      <label class="flex items-start gap-2 text-sm">
        <input
          class="mt-0.5"
          type="checkbox"
          :checked="settings.silenceAutoStop"
          :disabled="settings.saving"
          @change="onSilenceAutoStop"
        />
        <span>
          <span class="font-medium">Stop recording after sustained silence</span>
          <span class="mt-1 block text-muted-foreground">
            Watches this recording for near-silence and stops after the threshold. Calendar grace
            and Stop still work. This is not perfect goodbye detection.
          </span>
        </span>
      </label>
      <label class="flex items-center gap-2 text-sm" for="silence-threshold">
        <span class="font-medium">Silence threshold</span>
        <input
          id="silence-threshold"
          class="h-10 w-24 rounded-md border border-white/15 bg-white/5 px-3 font-normal tabular-nums focus:border-cyan-400/60 focus:outline-none disabled:opacity-50"
          type="number"
          inputmode="numeric"
          :min="SILENCE_AUTO_STOP_SECONDS_MIN"
          :max="SILENCE_AUTO_STOP_SECONDS_MAX"
          step="1"
          :value="settings.silenceAutoStopSeconds"
          :disabled="!settings.silenceAutoStop || settings.saving"
          @change="onSilenceSeconds"
        />
        <span class="text-muted-foreground">seconds</span>
      </label>
    </div>

    <SettingsMeetingSearch />
  </section>
</template>
