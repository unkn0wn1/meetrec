<script setup lang="ts">
import { Cloud } from 'lucide-vue-next'
import type { LibraryListItem } from '../../electron/shared/ipc-contract'
import { formatClock, formatWhen } from '@/lib/format'

defineProps<{
  item: LibraryListItem
}>()
</script>

<template>
  <article class="flex items-center justify-between gap-4 px-4 py-3">
    <div class="min-w-0">
      <p class="truncate font-medium">{{ formatWhen(item.startedAt) }}</p>
      <p class="mt-1 truncate text-sm text-muted-foreground">
        {{ item.topic || 'No topic yet' }}
        <span v-if="item.speakerCount"> · {{ item.speakerCount }} speakers</span>
      </p>
    </div>
    <div class="flex shrink-0 items-center gap-2">
      <span class="font-mono text-sm tabular-nums text-muted-foreground">{{
        formatClock(item.durationMs)
      }}</span>
      <span
        v-if="item.hasGoogleDrive"
        class="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-accent px-2 py-0.5 text-xs text-accent-foreground"
        title="Uploaded to Google Drive"
      >
        <Cloud class="size-3" aria-hidden="true" />
        Drive
      </span>
      <span
        v-if="item.hasOneDrive"
        class="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-accent px-2 py-0.5 text-xs text-accent-foreground"
        title="Uploaded to OneDrive"
      >
        <Cloud class="size-3" aria-hidden="true" />
        OneDrive
      </span>
      <span
        class="rounded-full border px-2 py-0.5 text-xs"
        :class="
          item.hasTranscript
            ? 'border-primary/30 bg-accent text-accent-foreground'
            : 'border-border text-muted-foreground'
        "
      >
        {{ item.hasTranscript ? 'Transcript' : 'No transcript' }}
      </span>
      <span
        class="rounded-full border px-2 py-0.5 text-xs"
        :class="
          item.hasSummary
            ? 'border-primary/30 bg-accent text-accent-foreground'
            : 'border-border text-muted-foreground'
        "
      >
        {{ item.hasSummary ? 'Summary' : 'No summary' }}
      </span>
    </div>
  </article>
</template>
