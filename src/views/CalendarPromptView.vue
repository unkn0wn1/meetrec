<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Button } from '@/components/ui/button'
import { useMeetrec } from '@/composables/useMeetrec'
import { useCalendarStore } from '@/stores/calendar'

const calendar = useCalendarStore()
const prompt = computed(() => calendar.status?.prompt ?? null)
const captureSupported = ref(true)
const unsupportedReason = ref<string | null>(null)

onMounted(() => {
  void useMeetrec()
    .recording.status()
    .then((status) => {
      captureSupported.value = status.captureSupported
      unsupportedReason.value = status.unsupportedReason
    })
    .catch(() => {
      /* keep optimistic defaults; Start still fails via main if unsupported */
    })
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
  if (!prompt.value || !captureSupported.value) return
  void calendar.start(prompt.value.occurrenceKey)
}

function dismiss(): void {
  if (!prompt.value) return
  void calendar.dismiss(prompt.value.occurrenceKey)
}

function arm(): void {
  if (!prompt.value || !captureSupported.value) return
  void calendar.arm(prompt.value.occurrenceKey)
}
</script>

<template>
  <main class="flex min-h-screen flex-col gap-4 bg-background px-5 py-5">
    <p class="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">meetrec</p>
    <template v-if="prompt">
      <h1 class="text-xl font-semibold tracking-tight">{{ prompt.title }}</h1>
      <p class="text-sm text-muted-foreground">
        {{ formatWhen(prompt.startsAt) }} · starts in {{ prompt.minutesUntil }} min
      </p>
      <p v-if="prompt.hint" class="text-sm text-muted-foreground">
        {{ prompt.provider === 'google' ? 'Google' : 'Microsoft' }} · {{ prompt.hint }}
      </p>
      <p v-if="!captureSupported && unsupportedReason" class="text-sm text-amber-300" role="status">
        {{ unsupportedReason }}
      </p>
      <p v-if="calendar.error" class="text-sm text-destructive" role="alert">
        {{ calendar.error }}
      </p>
      <div class="mt-2 flex flex-col gap-2">
        <Button :disabled="calendar.busy || !captureSupported" @click="start"
          >Start recording</Button
        >
        <Button variant="outline" :disabled="calendar.busy" @click="dismiss">Dismiss</Button>
        <Button variant="outline" :disabled="calendar.busy || !captureSupported" @click="arm">
          Auto-arm (starts one minute before)
        </Button>
      </div>
    </template>
    <p v-else class="text-sm text-muted-foreground">Nothing to arm right now.</p>
  </main>
</template>
