<script setup lang="ts">
import { ref } from 'vue'
import type { ProviderCardStatus } from '../../electron/shared/ipc-contract'
import { Button } from '@/components/ui/button'
import { useSettingsStore } from '@/stores/settings'

defineProps<{
  card: ProviderCardStatus
}>()

const settings = useSettingsStore()
const xaiDraft = ref('')
const openaiDraft = ref('')

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
  <div v-if="card.credential === 'xai-oauth'" class="flex flex-col gap-3">
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
        :disabled="settings.saving || (!card.configured && !settings.oauthPending)"
        @click="settings.signOutXaiOAuth()"
      >
        Sign out
      </Button>
    </div>
  </div>

  <div v-else-if="card.credential === 'xai-key'" class="flex flex-col gap-3">
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
</template>
