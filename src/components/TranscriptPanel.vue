<script setup lang="ts">
import type { RecordingMetaView, TranscriptView } from '../../electron/shared/ipc-contract'
import { Button } from '@/components/ui/button'
import { formatSegmentTime } from '@/lib/format'

defineProps<{
  transcript: TranscriptView | null
  speakers: RecordingMetaView['speakers']
  busy: boolean
  canTranscribe: boolean
  voiceGate: string | null
}>()

const emit = defineEmits<{
  transcribe: []
}>()

function speakerName(
  speakerId: string,
  fallback: string,
  speakers: RecordingMetaView['speakers']
): string {
  const match = speakers.find((speaker) => speaker.id === speakerId)
  return match?.name.trim() || match?.label || fallback
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
      <p class="text-sm leading-6">{{ transcript.text }}</p>
      <ul class="flex flex-col gap-3 border-t pt-4">
        <li v-for="(segment, index) in transcript.segments" :key="`${segment.start}-${index}`">
          <p class="text-xs text-muted-foreground">
            {{ speakerName(segment.speakerId, segment.speakerLabel, speakers) }}
            · {{ formatSegmentTime(segment.start) }}
          </p>
          <p class="mt-1 text-sm">{{ segment.text }}</p>
        </li>
      </ul>
    </div>
  </section>
</template>
