<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Button } from '@/components/ui/button'
import { useCalendarStore } from '@/stores/calendar'
import { useRecordingSessionStore } from '@/stores/recordingSession'

const calendar = useCalendarStore()
const session = useRecordingSessionStore()
const prompt = computed(() => calendar.status?.prompt ?? null)
const recordingKnown = ref(false)
const micOnlyNote = computed(() =>
  session.isRecording && session.captureMode === 'mic-only' && session.note ? session.note : null
)

onMounted(() => {
  void session.refresh().then(
    () => {
      recordingKnown.value = true
    },
    () => {
      recordingKnown.value = true
    }
  )
})

function formatWhen(iso: string): string {
  const parsed = Date.parse(iso)
  if (Number.isNaN(parsed)) return iso
  return new Date(parsed).toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  })
}

function start(): void {
  if (!prompt.value || !session.captureSupported || session.isRecording) return
  void calendar.start(prompt.value.occurrenceKey)
}

function dismiss(): void {
  if (!prompt.value) return
  void calendar.dismiss(prompt.value.occurrenceKey)
}

function arm(): void {
  if (!prompt.value || !session.captureSupported) return
  void calendar.arm(prompt.value.occurrenceKey)
}

function closePrompt(): void {
  window.close()
}
</script>

<template>
  <main class="flex min-h-screen flex-col gap-4 overflow-y-auto bg-background px-5 py-5">
    <p class="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">meetrec</p>
    <template v-if="prompt">
      <h1 class="text-xl font-semibold tracking-tight">{{ prompt.title }}</h1>
      <p class="text-sm text-muted-foreground">
        {{ formatWhen(prompt.startsAt) }} · starts in {{ prompt.minutesUntil }} min
      </p>
      <p v-if="prompt.hint" class="text-sm text-muted-foreground">
        {{ prompt.provider === 'google' ? 'Google' : 'Microsoft' }} · {{ prompt.hint }}
      </p>
      <p
        v-if="!session.captureSupported && session.unsupportedReason"
        class="text-sm text-amber-300"
        role="status"
      >
        {{ session.unsupportedReason }}
      </p>
      <p
        v-if="micOnlyNote"
        class="rounded-md border border-amber-300/30 bg-amber-300/10 px-3 py-2 text-sm text-amber-300"
        role="status"
      >
        {{ micOnlyNote }}
      </p>
      <p v-if="calendar.error" class="text-sm text-destructive" role="alert">
        {{ calendar.error }}
      </p>
      <div class="mt-2 flex flex-col gap-2">
        <Button
          :disabled="calendar.busy || !session.captureSupported || session.isRecording"
          @click="start"
          >Start recording</Button
        >
        <Button variant="outline" :disabled="calendar.busy" @click="dismiss">Dismiss</Button>
        <Button
          variant="outline"
          :disabled="calendar.busy || !session.captureSupported"
          @click="arm"
        >
          Auto-arm (starts one minute before)
        </Button>
      </div>
    </template>
    <section v-else-if="micOnlyNote" class="flex flex-col gap-3">
      <h1 class="text-xl font-semibold tracking-tight">Microphone only</h1>
      <p
        class="rounded-md border border-amber-300/30 bg-amber-300/10 px-3 py-2 text-sm text-amber-300"
        role="status"
      >
        {{ micOnlyNote }}
      </p>
      <p class="text-sm text-muted-foreground">Closing this window does not stop the recording.</p>
      <Button variant="outline" @click="closePrompt">Close</Button>
    </section>
    <p v-else-if="recordingKnown" class="text-sm text-muted-foreground">
      Nothing to arm right now.
    </p>
  </main>
</template>
