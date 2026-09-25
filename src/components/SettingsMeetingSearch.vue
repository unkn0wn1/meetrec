<script setup lang="ts">
import { computed, ref } from 'vue'
import { Button } from '@/components/ui/button'
import { useMeetingSearchStore } from '@/stores/meeting-search'

const search = useMeetingSearchStore()
const confirming = ref(false)
const rebuildConfirm = ref(false)
const blocked = ref(false)

const enabled = computed(() => search.snapshot.prefs.enabled)
const downloading = computed(
  () => search.snapshot.phase === 'downloading' || search.snapshot.phase === 'installing'
)
const ready = computed(() => search.snapshot.phase === 'ready' && search.snapshot.modelsReady)
const megabytes = computed(() => {
  const bytes = search.snapshot.download?.bytes ?? 0
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
})
const downloadPercent = computed(() => search.snapshot.download?.percent ?? null)

async function onToggle(event: Event): Promise<void> {
  const checked = event.target instanceof HTMLInputElement && event.target.checked
  blocked.value = false
  if (!checked) {
    confirming.value = false
    await search.disable()
    return
  }
  await search.preflight()
  const runtime = search.snapshot.runtime
  if (!runtime.nodeOk && !runtime.qmdOnPath) {
    blocked.value = true
    if (event.target instanceof HTMLInputElement) event.target.checked = false
    return
  }
  if (runtime.needsDownload) {
    confirming.value = true
    return
  }
  await search.enable()
}

async function confirmDownload(): Promise<void> {
  confirming.value = false
  await search.enable()
}

function cancelConfirm(): void {
  confirming.value = false
}

function confirmRebuild(): void {
  rebuildConfirm.value = false
  void search.rebuild()
}

async function onSchedule(
  field: 'indexAfterTranscript' | 'indexAfterSummary' | 'idleCatchUp',
  event: Event
): Promise<void> {
  const checked = event.target instanceof HTMLInputElement && event.target.checked
  await search.setSchedule({
    indexAfterTranscript: search.snapshot.prefs.indexAfterTranscript,
    indexAfterSummary: search.snapshot.prefs.indexAfterSummary,
    idleCatchUp: search.snapshot.prefs.idleCatchUp,
    [field]: checked
  })
}
</script>

<template>
  <section class="flex flex-col gap-3 border-t border-white/10 pt-4">
    <label class="flex items-start gap-2 text-sm">
      <input
        class="mt-0.5"
        type="checkbox"
        :checked="enabled || confirming"
        :disabled="downloading"
        @change="onToggle"
      />
      <span>
        <span class="font-medium">Meeting search (local)</span>
        <span class="mt-1 block text-muted-foreground">
          Search transcripts on this computer. Off until you confirm the model download.
        </span>
      </span>
    </label>

    <p v-if="blocked" class="text-sm text-destructive" role="alert">
      MeetRec needs Node.js on PATH to install qmd.
    </p>

    <div v-if="confirming" class="flex flex-col gap-3 rounded-xl border border-white/10 p-3">
      <p class="text-sm text-muted-foreground">
        Meeting search downloads about 2 GB of local models (embeddinggemma, a reranker, and query
        expansion). It uses this computer’s CPU and memory. About 16 GB of RAM is recommended.
        Transcripts stay on this device and are not sent to a MeetRec server. The first index can
        take a while.
      </p>
      <div class="flex flex-wrap gap-2">
        <Button @click="confirmDownload">Download and turn on</Button>
        <Button variant="outline" @click="cancelConfirm">Cancel</Button>
      </div>
    </div>

    <p v-if="downloading" class="text-sm text-muted-foreground" role="status">
      Downloading {{ search.snapshot.download?.label || 'models' }}… {{ megabytes }}
      <span v-if="downloadPercent !== null">({{ downloadPercent }}%)</span>
    </p>
    <div v-if="downloading" class="flex">
      <Button variant="outline" @click="search.cancelDownload()">Cancel download</Button>
    </div>

    <p
      v-if="search.snapshot.phase === 'error' && search.snapshot.error"
      class="text-sm text-destructive"
      role="alert"
    >
      {{ search.snapshot.error }}
    </p>
    <div v-if="enabled && search.snapshot.phase === 'error'" class="flex">
      <Button variant="outline" @click="search.enable()">Download again</Button>
    </div>

    <div v-if="enabled" class="flex flex-col gap-2">
      <label class="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          :checked="search.snapshot.prefs.indexAfterTranscript"
          @change="onSchedule('indexAfterTranscript', $event)"
        />
        Index after transcript
      </label>
      <label class="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          :checked="search.snapshot.prefs.indexAfterSummary"
          @change="onSchedule('indexAfterSummary', $event)"
        />
        Index after summary
      </label>
      <label class="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          :checked="search.snapshot.prefs.idleCatchUp"
          @change="onSchedule('idleCatchUp', $event)"
        />
        Catch up once a day while the app is open
      </label>
      <div class="flex flex-wrap gap-2">
        <Button variant="outline" :disabled="!ready" @click="search.indexAll()">Index all</Button>
        <Button variant="outline" :disabled="!ready" @click="rebuildConfirm = true">Rebuild</Button>
      </div>
      <div v-if="rebuildConfirm" class="flex flex-col gap-2">
        <p class="text-sm text-muted-foreground">
          Rebuild deletes the local index and re-embeds every transcript. That can take a while.
        </p>
        <div class="flex gap-2">
          <Button @click="confirmRebuild">Rebuild index</Button>
          <Button variant="outline" @click="rebuildConfirm = false">Cancel</Button>
        </div>
      </div>
    </div>
  </section>
</template>
