<script setup lang="ts">
import { Button } from '@/components/ui/button'
import { useRecordingSessionStore } from '@/stores/recordingSession'
import { useUpdaterStore } from '@/stores/updater'

const updater = useUpdaterStore()
const recording = useRecordingSessionStore()
</script>

<template>
  <section v-if="updater.snapshot.phase === 'ready'" class="glass px-4 py-3">
    <p class="text-sm" :class="recording.isRecording ? 'text-amber-300' : ''" role="status">
      {{ updater.snapshot.message }}
    </p>
    <div v-if="!recording.isRecording" class="mt-3 flex flex-col items-start gap-2">
      <Button @click="updater.confirmOrInstall()">Restart and install</Button>
      <p v-if="updater.confirming" class="text-sm text-muted-foreground">
        This closes meetrec and installs the update.
      </p>
    </div>
  </section>
</template>
