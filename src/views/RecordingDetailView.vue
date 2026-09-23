<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import CloudUploadButton from '@/components/CloudUploadButton.vue'
import ModeNav from '@/components/ModeNav.vue'
import PlaybackPanel from '@/components/PlaybackPanel.vue'
import RecordingHeader from '@/components/RecordingHeader.vue'
import SummaryPanel from '@/components/SummaryPanel.vue'
import TranscriptPanel from '@/components/TranscriptPanel.vue'
import { Button } from '@/components/ui/button'
import { useLibraryStore } from '@/stores/library'
import { useSettingsStore } from '@/stores/settings'

const route = useRoute()
const router = useRouter()
const library = useLibraryStore()
const settings = useSettingsStore()
const pane = ref<'playback' | 'transcript' | 'summary'>('playback')

const id = computed(() => String(route.params.id ?? ''))

watch(
  id,
  (next) => {
    if (next) void library.open(next)
  },
  { immediate: true }
)

const panes = [
  { id: 'playback', label: 'Playback' },
  { id: 'transcript', label: 'Transcript' },
  { id: 'summary', label: 'Summary' }
] as const
</script>

<template>
  <main class="mx-auto flex min-h-screen max-w-5xl flex-col gap-6 px-6 py-8">
    <div class="flex items-center justify-between gap-4">
      <Button variant="ghost" size="sm" @click="router.push({ name: 'library' })">Back</Button>
      <ModeNav />
    </div>

    <p v-if="library.error" class="text-sm text-destructive" role="alert">{{ library.error }}</p>
    <p v-if="library.loading && !library.detail" class="text-sm text-muted-foreground">
      Loading recording…
    </p>

    <template v-if="library.detail">
      <RecordingHeader
        :meta="library.detail.meta"
        :busy="library.busy"
        @save="library.saveSpeakers(id, $event)"
      />
      <CloudUploadButton :recording-id="id" />

      <div class="grid gap-4 md:grid-cols-[11rem_1fr]">
        <nav class="flex flex-row gap-2 md:flex-col" aria-label="Recording sections">
          <Button
            v-for="item in panes"
            :key="item.id"
            class="justify-start"
            :variant="pane === item.id ? 'default' : 'outline'"
            @click="pane = item.id"
          >
            {{ item.label }}
          </Button>
        </nav>
        <section class="rounded-xl border bg-card p-5 shadow-sm">
          <PlaybackPanel v-if="pane === 'playback'" :audio-url="library.detail.audioUrl" />
          <TranscriptPanel
            v-else-if="pane === 'transcript'"
            :transcript="library.detail.transcript"
            :speakers="library.detail.meta.speakers"
            :busy="library.busy"
            :can-transcribe="settings.canTranscribe"
            :voice-gate="settings.voiceGate"
            @transcribe="library.transcribe(id)"
          />
          <SummaryPanel
            v-else
            :summary="library.detail.summary"
            :has-transcript="library.detail.hasTranscript"
            :busy="library.busy"
            :can-summarize="settings.canSummarize"
            :ai-gate="settings.aiGate"
            @summarize="library.summarize(id)"
          />
        </section>
      </div>
    </template>
  </main>
</template>
