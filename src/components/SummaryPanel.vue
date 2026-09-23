<script setup lang="ts">
import { Button } from '@/components/ui/button'

defineProps<{
  summary: string | null
  hasTranscript: boolean
  busy: boolean
  canUseProvider: boolean
  gateHint: string | null
}>()

const emit = defineEmits<{
  summarize: []
}>()
</script>

<template>
  <section>
    <div v-if="!summary" class="flex flex-col items-start gap-3">
      <p class="text-sm text-muted-foreground">
        Minutes include an overview, topic, decisions, and action items.
      </p>
      <Button
        :disabled="busy || !hasTranscript || !canUseProvider"
        :title="canUseProvider ? undefined : (gateHint ?? undefined)"
        @click="emit('summarize')"
      >
        {{ busy ? 'Writing summary…' : 'Generate summary' }}
      </Button>
      <p v-if="!canUseProvider && gateHint" class="text-xs text-muted-foreground">{{ gateHint }}</p>
      <p v-else-if="!hasTranscript" class="text-xs text-muted-foreground">Transcribe first.</p>
    </div>
    <pre v-else class="whitespace-pre-wrap font-sans text-sm leading-6">{{ summary }}</pre>
  </section>
</template>
