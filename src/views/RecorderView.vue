<script setup lang="ts">
import { onMounted } from 'vue'
import AppShell from '@/components/AppShell.vue'
import { Button } from '@/components/ui/button'
import { useRecordingSessionStore } from '@/stores/recordingSession'

const session = useRecordingSessionStore()

onMounted(() => {
  void session.refresh()
})
</script>

<template>
  <AppShell title="Record">
    <div class="flex w-full max-w-md flex-col gap-6">
      <div class="flex justify-end">
        <p
          class="rounded-full border px-3 py-1 text-xs font-medium"
          :class="
            session.isRecording
              ? 'border-destructive/40 bg-destructive/10 text-destructive'
              : 'border-border text-muted-foreground'
          "
          role="status"
        >
          {{ session.isRecording ? 'Recording' : 'Idle' }}
        </p>
      </div>

      <section class="glass p-5">
        <p class="font-mono text-4xl tabular-nums">{{ session.elapsedLabel }}</p>
        <p class="mt-2 text-sm text-muted-foreground">
          <template v-if="session.captureMode === 'mix'">Mic + system audio</template>
          <template v-else-if="session.captureMode === 'mic-only'">Microphone only</template>
          <template v-else>Mic and system monitor, one local WAV</template>
        </p>
        <p v-if="session.note" class="mt-3 text-sm text-amber-300">{{ session.note }}</p>
        <p v-if="session.error" class="mt-3 text-sm text-destructive" role="alert">
          {{ session.error }}
        </p>
      </section>

      <div class="flex gap-3">
        <Button
          v-if="!session.isRecording"
          size="lg"
          class="flex-1"
          :disabled="session.busy"
          @click="session.start()"
        >
          Start
        </Button>
        <Button
          v-else
          size="lg"
          variant="destructive"
          class="flex-1"
          :disabled="session.busy"
          @click="session.stop()"
        >
          Stop
        </Button>
      </div>

      <p v-if="session.outPath" class="break-all text-xs text-muted-foreground">
        {{ session.outPath }}
      </p>
    </div>
  </AppShell>
</template>
