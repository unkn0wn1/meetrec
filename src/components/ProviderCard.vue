<script setup lang="ts">
import { computed } from 'vue'
import type { ProbeState, ProviderCardStatus, RoleProbe } from '../../electron/shared/ipc-contract'
import ProviderCredentialFields from '@/components/ProviderCredentialFields.vue'
import { Button } from '@/components/ui/button'
import { useSettingsStore } from '@/stores/settings'

const props = defineProps<{
  card: ProviderCardStatus
}>()

const settings = useSettingsStore()
const testing = computed(() => settings.testingProviderId === props.card.id)
const showLiveOk = computed(() => props.card.live === 'ok' && !testing.value)
const showLiveBad = computed(
  () => props.card.live === 'bad' && !testing.value && props.card.liveMessage !== ''
)

function onModel(role: 'voice' | 'ai', event: Event): void {
  const value = (event.target as HTMLSelectElement).value
  const current = role === 'voice' ? props.card.voiceModel : props.card.aiModel
  if (value === current) return
  void settings.setModel(props.card.id, role, value)
}

function probeClass(state: ProbeState): string {
  if (state === 'pass') return 'text-success'
  if (state === 'fail') return 'text-destructive'
  return 'text-muted-foreground'
}

function probeLine(label: string, probe: RoleProbe): string {
  const result =
    probe.state === 'pass' ? 'passed' : probe.state === 'fail' ? 'failed' : 'not available'
  return probe.message ? `${label} ${result}. ${probe.message}` : `${label} ${result}.`
}
</script>

<template>
  <article class="flex flex-col gap-4 rounded-xl border bg-card p-5 shadow-sm">
    <div>
      <h3 class="text-base font-semibold tracking-tight">{{ card.label }}</h3>
      <p class="mt-1 text-sm text-muted-foreground">{{ card.statusLabel }}</p>
    </div>

    <p v-if="showLiveOk" class="flex items-center gap-2 text-sm" role="status">
      <span class="size-2.5 rounded-full bg-success" aria-hidden="true" />
      {{ card.liveMessage }}
    </p>
    <p v-else-if="showLiveBad" class="text-sm text-destructive" role="status">
      {{ card.liveMessage }}
    </p>

    <ProviderCredentialFields :card="card" />

    <div class="grid gap-3 sm:grid-cols-2">
      <label v-if="card.supportsVoice" class="flex flex-col gap-2 text-sm font-medium">
        Voice model
        <select
          class="h-10 rounded-md border border-input bg-background px-3 font-normal"
          :value="card.voiceModel"
          :disabled="settings.saving"
          @change="onModel('voice', $event)"
        >
          <option v-for="model in card.voiceModels" :key="model.id" :value="model.id">
            {{ model.label }}
          </option>
        </select>
      </label>
      <label v-if="card.supportsAi" class="flex flex-col gap-2 text-sm font-medium">
        AI model
        <select
          class="h-10 rounded-md border border-input bg-background px-3 font-normal"
          :value="card.aiModel"
          :disabled="settings.saving"
          @change="onModel('ai', $event)"
        >
          <option v-for="model in card.aiModels" :key="model.id" :value="model.id">
            {{ model.label }}
          </option>
        </select>
      </label>
    </div>

    <div class="flex flex-col gap-2">
      <label v-if="card.supportsVoice" class="flex items-center gap-2 text-sm">
        <input
          type="radio"
          name="voice-default"
          :value="card.id"
          :checked="card.isVoiceDefault"
          :disabled="settings.saving"
          @change="settings.setVoiceDefault(card.id)"
        />
        Default for Voice
      </label>
      <label v-if="card.supportsAi" class="flex items-center gap-2 text-sm">
        <input
          type="radio"
          name="ai-default"
          :value="card.id"
          :checked="card.isAiDefault"
          :disabled="settings.saving"
          @change="settings.setAiDefault(card.id)"
        />
        Default for AI
      </label>
    </div>

    <div class="flex flex-col gap-2">
      <div>
        <Button :disabled="settings.saving" @click="settings.testProvider(card.id)">
          {{ testing ? 'Testing…' : 'Test' }}
        </Button>
      </div>
      <p v-if="testing && card.supportsVoice" class="text-sm text-muted-foreground" role="status">
        Voice: Checking…
      </p>
      <p
        v-else-if="card.voiceProbe.state !== 'idle'"
        class="text-sm"
        :class="probeClass(card.voiceProbe.state)"
        role="status"
      >
        {{ probeLine('Voice', card.voiceProbe) }}
      </p>
      <p v-if="testing && card.supportsAi" class="text-sm text-muted-foreground" role="status">
        AI: Checking…
      </p>
      <p
        v-else-if="card.aiProbe.state !== 'idle'"
        class="text-sm"
        :class="probeClass(card.aiProbe.state)"
        role="status"
      >
        {{ probeLine('AI', card.aiProbe) }}
      </p>
    </div>
  </article>
</template>
