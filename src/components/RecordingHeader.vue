<script setup lang="ts">
import { ref, watch } from 'vue'
import type { RecordingMetaView } from '../../electron/shared/ipc-contract'
import { Button } from '@/components/ui/button'
import { formatClock, formatWhen } from '@/lib/format'

const props = defineProps<{
  meta: RecordingMetaView
  busy: boolean
}>()

const emit = defineEmits<{
  save: [names: Record<string, string>]
}>()

const drafts = ref<Record<string, string>>({})

watch(
  () => props.meta.speakers,
  (speakers) => {
    const next: Record<string, string> = {}
    for (const speaker of speakers) next[speaker.id] = speaker.name
    drafts.value = next
  },
  { immediate: true }
)

function save(): void {
  emit('save', { ...drafts.value })
}
</script>

<template>
  <header class="glass p-5">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p class="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Recording
        </p>
        <h1 class="mt-1 text-2xl font-semibold tracking-tight">{{ formatWhen(meta.startedAt) }}</h1>
      </div>
      <p class="font-mono text-2xl tabular-nums">{{ formatClock(meta.durationMs) }}</p>
    </div>

    <p class="mt-3 text-sm">
      <span class="text-muted-foreground">Topic</span>
      <span class="ml-2">{{ meta.topic || 'Appears after a summary.' }}</span>
    </p>

    <div class="mt-4">
      <p class="text-sm text-muted-foreground">
        Speakers
        <span class="ml-1 font-medium text-foreground">{{ meta.speakers.length }}</span>
      </p>
      <p v-if="meta.speakers.length === 0" class="mt-2 text-sm text-muted-foreground">
        Names stay empty until diarization or you add them after transcribe.
      </p>
      <ul v-else class="mt-3 flex flex-col gap-2">
        <li v-for="speaker in meta.speakers" :key="speaker.id" class="flex items-center gap-3">
          <label class="w-28 shrink-0 text-sm" :for="`speaker-${speaker.id}`">{{
            speaker.label
          }}</label>
          <input
            :id="`speaker-${speaker.id}`"
            v-model="drafts[speaker.id]"
            class="h-9 flex-1 rounded-md border bg-background px-3 text-sm"
            type="text"
            :placeholder="speaker.label"
            :disabled="busy"
          />
        </li>
      </ul>
      <Button
        v-if="meta.speakers.length"
        class="mt-3"
        size="sm"
        variant="outline"
        :disabled="busy"
        @click="save"
      >
        Save names
      </Button>
    </div>
  </header>
</template>
