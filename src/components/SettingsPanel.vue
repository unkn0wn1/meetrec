<script setup lang="ts">
import { onUnmounted, ref, watch } from 'vue'
import type { ProviderId } from '../../electron/shared/ipc-contract'
import { Button } from '@/components/ui/button'
import { useSettingsStore } from '@/stores/settings'

const settings = useSettingsStore()
const xaiDraft = ref('')
const openaiDraft = ref('')
let pollTimer: ReturnType<typeof setTimeout> | null = null

const choices: { id: ProviderId; label: string }[] = [
  { id: 'xai-oauth', label: 'xAI sign-in' },
  { id: 'xai-key', label: 'xAI API key' },
  { id: 'openai', label: 'OpenAI' }
]

watch(
  () => settings.oauthPending,
  (pending) => {
    clearPoll()
    if (pending) schedulePoll()
  },
  { immediate: true }
)

onUnmounted(() => {
  clearPoll()
})

function schedulePoll(): void {
  const seconds = settings.oauthIntervalSec ?? 5
  pollTimer = setTimeout(
    () => {
      void settings.pollXaiOAuth().finally(() => {
        if (settings.oauthPending) schedulePoll()
      })
    },
    Math.max(seconds, 1) * 1000
  )
}

function clearPoll(): void {
  if (pollTimer) clearTimeout(pollTimer)
  pollTimer = null
}

async function saveXai(): Promise<void> {
  const ok = await settings.saveXaiKey(xaiDraft.value)
  if (ok) xaiDraft.value = ''
}

async function saveOpenAi(): Promise<void> {
  const ok = await settings.saveOpenAiKey(openaiDraft.value)
  if (ok) openaiDraft.value = ''
}
</script>

<template>
  <section class="flex flex-col gap-5 rounded-xl border bg-card p-5 shadow-sm">
    <div>
      <h2 class="text-lg font-semibold tracking-tight">Provider</h2>
      <p class="mt-1 text-sm text-muted-foreground">
        Pick one. Transcribe and Generate summary use only that choice. Secrets stay in the main
        process and are never loaded back into this window.
      </p>
    </div>

    <div
      class="grid grid-cols-1 gap-2 sm:grid-cols-3"
      role="radiogroup"
      aria-label="Active provider"
    >
      <button
        v-for="choice in choices"
        :key="choice.id"
        type="button"
        role="radio"
        class="h-10 rounded-md border px-3 text-sm font-medium"
        :class="
          settings.provider === choice.id
            ? 'border-primary bg-primary text-primary-foreground'
            : 'border-input bg-background'
        "
        :aria-checked="settings.provider === choice.id"
        :disabled="settings.saving"
        @click="settings.chooseProvider(choice.id)"
      >
        {{ choice.label }}
      </button>
    </div>

    <p class="text-sm text-muted-foreground" role="status">{{ settings.statusLabel }}</p>
    <p
      v-if="settings.message && settings.message !== settings.statusLabel"
      class="text-sm"
      :class="settings.validated ? 'text-foreground' : 'text-destructive'"
      role="status"
    >
      {{ settings.message }}
    </p>

    <div v-if="settings.provider === 'xai-oauth'" class="flex flex-col gap-3">
      <p class="text-sm text-muted-foreground">
        Sign in with an eligible xAI account. A browser opens for the device code.
      </p>
      <div
        v-if="settings.oauthPending && settings.oauthUserCode"
        class="rounded-md border bg-muted/40 p-3"
      >
        <p class="text-xs uppercase tracking-wide text-muted-foreground">User code</p>
        <p class="mt-1 font-mono text-lg tracking-widest">{{ settings.oauthUserCode }}</p>
        <a
          v-if="settings.verificationUrl"
          class="mt-2 block break-all text-sm underline"
          :href="settings.verificationUrl"
          target="_blank"
          rel="noreferrer"
        >
          {{ settings.verificationUrl }}
        </a>
      </div>
      <div class="flex gap-2">
        <Button
          :disabled="settings.saving || settings.oauthPending"
          @click="settings.startXaiOAuth()"
        >
          {{ settings.oauthPending ? 'Waiting for browser…' : 'Sign in' }}
        </Button>
        <Button
          variant="outline"
          :disabled="settings.saving || (!settings.configured && !settings.oauthPending)"
          @click="settings.signOutXaiOAuth()"
        >
          Sign out
        </Button>
      </div>
    </div>

    <div v-else-if="settings.provider === 'xai-key'" class="flex flex-col gap-3">
      <label class="flex flex-col gap-2 text-sm font-medium" for="xai-api-key">
        xAI API key
        <input
          id="xai-api-key"
          v-model="xaiDraft"
          class="h-10 rounded-md border border-input bg-background px-3 font-normal"
          type="password"
          autocomplete="off"
          spellcheck="false"
          placeholder="Paste a key, then Save"
        />
      </label>
      <div class="flex gap-2">
        <Button :disabled="settings.saving || !xaiDraft.trim()" @click="saveXai">
          {{ settings.saving ? 'Saving…' : 'Save' }}
        </Button>
        <Button
          variant="outline"
          :disabled="settings.saving || settings.xaiKeySource !== 'settings'"
          @click="settings.clearXaiKey()"
        >
          Clear
        </Button>
      </div>
    </div>

    <div v-else class="flex flex-col gap-3">
      <label class="flex flex-col gap-2 text-sm font-medium" for="openai-api-key">
        OpenAI API key
        <input
          id="openai-api-key"
          v-model="openaiDraft"
          class="h-10 rounded-md border border-input bg-background px-3 font-normal"
          type="password"
          autocomplete="off"
          spellcheck="false"
          placeholder="Paste a key, then Save"
        />
      </label>
      <div class="flex gap-2">
        <Button :disabled="settings.saving || !openaiDraft.trim()" @click="saveOpenAi">
          {{ settings.saving ? 'Saving…' : 'Save' }}
        </Button>
        <Button
          variant="outline"
          :disabled="settings.saving || settings.openaiKeySource !== 'settings'"
          @click="settings.clearOpenAiKey()"
        >
          Clear
        </Button>
      </div>
    </div>
  </section>
</template>
