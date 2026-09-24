<script setup lang="ts">
import { computed } from 'vue'
import type { RecordingMetaView, TranscriptView } from '../../electron/shared/ipc-contract'
import { Button } from '@/components/ui/button'
import { formatSegmentTime } from '@/lib/format'
import { BUBBLE_TONE_COUNT, segmentStartMs, speakerLanes } from '@/lib/transcript-bubbles'

const props = defineProps<{
  transcript: TranscriptView | null
  speakers: RecordingMetaView['speakers']
  busy: boolean
  canTranscribe: boolean
  voiceGate: string | null
}>()

const emit = defineEmits<{
  transcribe: []
  seek: [startMs: number]
}>()

const BUBBLE_TONES = [
  'border-primary/30 bg-primary/10',
  'border-violet-400/25 bg-violet-400/10',
  'border-white/15 bg-white/[0.06]',
  'border-accent-foreground/20 bg-accent'
] as const satisfies readonly string[] & { length: typeof BUBBLE_TONE_COUNT }

const lanes = computed(() =>
  speakerLanes((props.transcript?.segments ?? []).map((segment) => segment.speakerId))
)

function speakerName(
  speakerId: string,
  fallback: string,
  speakers: RecordingMetaView['speakers']
): string {
  const match = speakers.find((speaker) => speaker.id === speakerId)
  return match?.name.trim() || match?.label || fallback
}

function sideClass(speakerId: string): string {
  return lanes.value.get(speakerId)?.side === 'end' ? 'justify-end' : 'justify-start'
}

function toneClass(speakerId: string): string {
  const tone = lanes.value.get(speakerId)?.tone ?? 0
  return BUBBLE_TONES[tone] ?? BUBBLE_TONES[0]
}

function onBubble(startSeconds: number): void {
  const startMs = segmentStartMs(startSeconds)
  if (startMs === null) return
  emit('seek', startMs)
}
</script>

<template>
  <section>
    <div v-if="!transcript" class="flex flex-col items-start gap-3">
      <p class="text-sm text-muted-foreground">
        No transcript yet. Diarization labels speakers as Speaker 1, Speaker 2, and so on.
      </p>
      <Button
        :disabled="busy || !canTranscribe"
        :title="canTranscribe ? undefined : (voiceGate ?? undefined)"
        @click="emit('transcribe')"
      >
        {{ busy ? 'Transcribing…' : 'Transcribe' }}
      </Button>
      <p v-if="!canTranscribe && voiceGate" class="text-xs text-muted-foreground">
        {{ voiceGate }}
      </p>
    </div>
    <div v-else class="flex flex-col gap-4">
      <p v-if="transcript.segments.length === 0 && transcript.text" class="text-sm leading-6">
        {{ transcript.text }}
      </p>
      <p v-else-if="transcript.segments.length === 0" class="text-sm text-muted-foreground">
        Transcript is empty.
      </p>
      <ul v-else class="flex flex-col gap-3">
        <li
          v-for="(segment, index) in transcript.segments"
          :key="`${segment.speakerId}-${segment.start}-${index}`"
          class="flex"
          :class="sideClass(segment.speakerId)"
        >
          <button
            type="button"
            class="max-w-[85%] rounded-2xl border px-3 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            :class="toneClass(segment.speakerId)"
            @click="onBubble(segment.start)"
          >
            <p class="text-xs text-muted-foreground">
              {{ speakerName(segment.speakerId, segment.speakerLabel, speakers) }}
              · {{ formatSegmentTime(segment.start) }}
            </p>
            <p class="mt-1 text-sm">{{ segment.text }}</p>
          </button>
        </li>
      </ul>
      <details
        v-if="transcript.segments.length > 0 && transcript.text"
        class="border-t pt-4 text-sm"
      >
        <summary class="cursor-pointer text-muted-foreground">Full text</summary>
        <p class="mt-3 leading-6">{{ transcript.text }}</p>
      </details>
    </div>
  </section>
</template>
