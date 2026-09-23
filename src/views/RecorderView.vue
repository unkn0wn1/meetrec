<script setup lang="ts">
import { onMounted } from 'vue'
import ModeNav from '@/components/ModeNav.vue'
import { Button } from '@/components/ui/button'
import { useRecordingSessionStore } from '@/stores/recordingSession'

const session = useRecordingSessionStore()

onMounted(() => {
  void session.refresh()
})
</script>

<template>
  <main class="mx-auto flex min-h-screen max-w-md flex-col gap-6 px-6 py-8">
    <header class="flex items-start justify-between gap-4">
      <div>
        <p class="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">meetrec</p>
        <h1 class="mt-1 text-2xl font-semibold tracking-tight">Record</h1>
      </div>
      <ModeNav />
    </header>
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

    <section class="rounded-xl border bg-card p-5 shadow-sm">
      <p class="font-mono text-4xl tabular-nums">{{ session.elapsedLabel }}</p>
      <p class="mt-2 text-sm text-muted-foreground">
        <template v-if="session.captureMode === 'mix'">Mic + system audio</template>
        <template v-else-if="session.captureMode === 'mic-only'">Microphone only</template>
        <template v-else>Mic and system monitor, one local WAV</template>
      </p>
      <p v-if="session.note" class="mt-3 text-sm text-amber-800">{{ session.note }}</p>
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
  </main>
</template>
