<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import type { SearchHit } from '../../electron/shared/search-contract'
import { Button } from '@/components/ui/button'
import { formatClock } from '@/lib/format'
import { useMeetingSearchStore } from '@/stores/meeting-search'

const search = useMeetingSearchStore()
const router = useRouter()
const text = ref('')

function submit(): void {
  void search.runQuery(text.value)
}

function openHit(hit: SearchHit): void {
  search.closeDialog()
  const query = hit.startMs === null ? {} : { t: String(hit.startMs) }
  void router.push({ name: 'recording', params: { id: hit.recordingId }, query })
}
</script>

<template>
  <div
    v-if="search.dialogOpen"
    class="fixed inset-0 z-50 flex items-start justify-center bg-black/50 px-4 pt-24"
    @click.self="search.closeDialog()"
  >
    <div
      class="glass w-full max-w-lg p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Meeting search"
    >
      <form class="flex gap-2" @submit.prevent="submit">
        <input
          v-model="text"
          class="h-10 min-w-0 flex-1 rounded-md border border-white/15 bg-white/5 px-3 text-sm focus:border-cyan-400/60 focus:outline-none"
          type="search"
          placeholder="Search transcripts"
          aria-label="Search transcripts"
        />
        <Button type="submit" :disabled="search.querying">Search</Button>
      </form>
      <p v-if="search.queryError" class="mt-3 text-sm text-destructive" role="alert">
        {{ search.queryError }}
      </p>
      <p
        v-else-if="!search.querying && search.hits.length === 0"
        class="mt-3 text-sm text-muted-foreground"
      >
        Hits show the meeting and the moment in the transcript.
      </p>
      <ul v-else class="mt-3 flex max-h-80 flex-col gap-2 overflow-auto">
        <li v-for="(hit, index) in search.hits" :key="`${hit.recordingId}-${index}`">
          <button
            class="w-full rounded-xl border border-white/10 px-3 py-2 text-left hover:bg-accent/60"
            type="button"
            @click="openHit(hit)"
          >
            <span class="block text-sm font-medium">{{ hit.title }}</span>
            <span v-if="hit.startMs !== null" class="font-mono text-xs text-muted-foreground">
              {{ formatClock(hit.startMs) }}
            </span>
            <span class="mt-1 block text-sm text-muted-foreground">{{ hit.snippet }}</span>
          </button>
        </li>
      </ul>
    </div>
  </div>
</template>
