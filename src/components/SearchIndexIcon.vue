<script setup lang="ts">
import { computed } from 'vue'
import { Check, CircleAlert, Loader2 } from 'lucide-vue-next'
import { useMeetingSearchStore } from '@/stores/meeting-search'

const props = defineProps<{ id: string }>()
const search = useMeetingSearchStore()
const record = computed(() =>
  search.snapshot.prefs.enabled ? search.snapshot.records[props.id] : undefined
)
</script>

<template>
  <span v-if="record?.state === 'pending'" class="inline-flex p-2" title="Indexing for search">
    <Loader2 class="size-4 animate-spin text-muted-foreground" aria-hidden="true" />
  </span>
  <span
    v-else-if="record?.state === 'indexed'"
    class="inline-flex p-2"
    title="Included in meeting search"
  >
    <Check class="size-4 text-muted-foreground" aria-hidden="true" />
  </span>
  <button
    v-else-if="record?.state === 'error'"
    class="inline-flex p-2 text-destructive"
    type="button"
    :title="record.error || 'Search index failed'"
    @click="search.retry(id)"
  >
    <CircleAlert class="size-4" aria-hidden="true" />
  </button>
</template>
