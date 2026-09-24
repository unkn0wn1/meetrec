<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { RecordingMetaView } from '../../electron/shared/ipc-contract'
import { Button } from '@/components/ui/button'
import { formatClock, formatWhen } from '@/lib/format'
import { applyInviteePick, selectedInviteeKey, uniqueInviteeOptions } from '@/lib/invitee-options'

const props = defineProps<{
  meta: RecordingMetaView
  busy: boolean
}>()

const emit = defineEmits<{
  save: [names: Record<string, string>]
}>()

const drafts = ref<Record<string, string>>({})
const pickedKeys = ref<Record<string, string>>({})

watch(
  () => props.meta.speakers,
  (speakers) => {
    const next: Record<string, string> = {}
    for (const speaker of speakers) next[speaker.id] = speaker.name
    drafts.value = next
    pickedKeys.value = {}
  },
  { immediate: true }
)

const inviteeOptions = computed(() => uniqueInviteeOptions(props.meta.calendar?.attendees ?? []))

const inviteeHint = computed(() => {
  const title = props.meta.calendar?.title.trim() ?? ''
  if (title) return `Invitees from ${title}. Choosing one fills the name.`
  return 'Choosing an invitee fills the name. You can still edit it before saving.'
})

const captureLabel = computed(() => {
  if (props.meta.captureMode === 'mix') return 'Mic + system audio'
  if (props.meta.captureMode === 'mic-only') return 'Microphone only'
  return ''
})

function save(): void {
  emit('save', { ...drafts.value })
}

function inviteeKey(speakerId: string): string {
  return selectedInviteeKey(
    inviteeOptions.value,
    drafts.value[speakerId] ?? '',
    pickedKeys.value[speakerId]
  )
}

function onInvitee(speakerId: string, event: Event): void {
  const key = (event.target as HTMLSelectElement).value
  if (!key) return
  const option = inviteeOptions.value.find((item) => item.key === key)
  if (!option) return
  pickedKeys.value = { ...pickedKeys.value, [speakerId]: option.key }
  drafts.value = applyInviteePick(drafts.value, speakerId, option)
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
    <p v-if="captureLabel" class="mt-2 text-sm text-muted-foreground">{{ captureLabel }}</p>
    <p v-if="meta.note" class="mt-2 text-sm text-amber-300">{{ meta.note }}</p>

    <div class="mt-4">
      <p class="text-sm text-muted-foreground">
        Speakers
        <span class="ml-1 font-medium text-foreground">{{ meta.speakers.length }}</span>
      </p>
      <p v-if="meta.speakers.length === 0" class="mt-2 text-sm text-muted-foreground">
        Names stay empty until diarization or you add them after transcribe.
      </p>
      <p v-else-if="inviteeOptions.length === 0" class="mt-2 text-sm text-muted-foreground">
        Invitee picks appear for meetings started from a calendar event.
      </p>
      <p v-else class="mt-2 text-sm text-muted-foreground">{{ inviteeHint }}</p>
      <ul v-if="meta.speakers.length" class="mt-3 flex flex-col gap-2">
        <li
          v-for="speaker in meta.speakers"
          :key="speaker.id"
          class="flex flex-wrap items-center gap-3"
        >
          <label class="w-28 shrink-0 text-sm" :for="`speaker-${speaker.id}`">{{
            speaker.label
          }}</label>
          <select
            v-if="inviteeOptions.length"
            class="h-9 w-full rounded-md border bg-background px-2 text-sm sm:w-52 sm:shrink-0"
            :aria-label="`Invitee for ${speaker.label}`"
            :disabled="busy"
            :value="inviteeKey(speaker.id)"
            @change="onInvitee(speaker.id, $event)"
          >
            <option value="">Choose invitee…</option>
            <option v-for="option in inviteeOptions" :key="option.key" :value="option.key">
              {{ option.label }}
            </option>
          </select>
          <input
            :id="`speaker-${speaker.id}`"
            v-model="drafts[speaker.id]"
            class="h-9 min-w-40 flex-1 rounded-md border bg-background px-3 text-sm"
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
