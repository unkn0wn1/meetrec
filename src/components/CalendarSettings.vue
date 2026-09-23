<script setup lang="ts">
import { ref, watch } from 'vue'
import { Button } from '@/components/ui/button'
import { useCalendarStore } from '@/stores/calendar'

const calendar = useCalendarStore()
const clientId = ref('')
const clientSecret = ref('')
const clientDirty = ref(false)
const microsoftClientId = ref('')
const microsoftDirty = ref(false)

watch(
  () => calendar.status?.microsoft.clientId,
  (value) => {
    if (microsoftDirty.value) return
    microsoftClientId.value = value ?? ''
  },
  { immediate: true }
)

watch(
  () => calendar.status?.google.clientId,
  (value) => {
    if (clientDirty.value) return
    clientId.value = value ?? ''
  },
  { immediate: true }
)

async function saveMicrosoft(): Promise<void> {
  const ok = await calendar.saveMicrosoft(microsoftClientId.value)
  if (ok) microsoftDirty.value = false
}

async function save(): Promise<void> {
  const ok = await calendar.saveGoogle(clientId.value, clientSecret.value)
  if (ok) {
    clientSecret.value = ''
    clientDirty.value = false
  }
}

function formatWhen(iso: string): string {
  const parsed = Date.parse(iso)
  if (Number.isNaN(parsed)) return iso
  return new Date(parsed).toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  })
}
</script>

<template>
  <section class="mt-2 flex flex-col gap-4 border-t pt-6">
    <div>
      <h2 class="text-lg font-semibold tracking-tight">Calendar</h2>
      <p class="mt-1 text-sm text-muted-foreground">
        A connected calendar prompts about 10 minutes before a timed event.
      </p>
    </div>

    <p v-if="calendar.error" class="text-sm text-destructive" role="alert">{{ calendar.error }}</p>

    <label class="flex flex-col gap-2 text-sm font-medium" for="google-client-id">
      Google client id
      <input
        id="google-client-id"
        v-model="clientId"
        class="h-10 rounded-md border border-input bg-background px-3 font-normal"
        type="text"
        autocomplete="off"
        spellcheck="false"
        @input="clientDirty = true"
      />
    </label>

    <label class="flex flex-col gap-2 text-sm font-medium" for="google-client-secret">
      Google client secret
      <input
        id="google-client-secret"
        v-model="clientSecret"
        class="h-10 rounded-md border border-input bg-background px-3 font-normal"
        type="password"
        autocomplete="off"
        spellcheck="false"
        :placeholder="calendar.status?.google.secretSet ? 'Secret is set' : 'Client secret'"
      />
    </label>

    <div class="flex flex-wrap gap-2">
      <Button :disabled="calendar.busy || !clientId.trim()" @click="save">Save</Button>
      <Button
        variant="outline"
        :disabled="calendar.busy || !calendar.status?.google.secretSet"
        @click="calendar.clearGoogleSecret()"
      >
        Clear secret
      </Button>
      <Button
        :disabled="
          calendar.busy || !clientId.trim() || calendar.status?.connectPending === 'google'
        "
        @click="calendar.connectGoogle()"
      >
        Connect
      </Button>
      <Button
        v-if="calendar.status?.google.connected"
        variant="outline"
        :disabled="calendar.busy"
        @click="calendar.disconnectGoogle()"
      >
        Disconnect
      </Button>
      <Button
        v-if="calendar.status?.connectPending === 'google'"
        variant="outline"
        @click="calendar.cancelConnect()"
      >
        Cancel
      </Button>
    </div>

    <p v-if="calendar.status?.connectPending === 'google'" class="text-sm text-muted-foreground">
      Waiting for the browser…
    </p>
    <p v-if="calendar.status?.google.connected" class="text-sm">
      Connected as {{ calendar.status.google.accountEmail || 'Google account' }}
    </p>
    <p v-if="calendar.status?.google.error" class="text-sm text-destructive" role="alert">
      {{ calendar.status.google.error }}
    </p>

    <ul v-if="calendar.status && calendar.status.upcoming.length > 0" class="flex flex-col gap-2">
      <li
        v-for="event in calendar.status.upcoming"
        :key="event.occurrenceKey"
        class="text-sm text-muted-foreground"
      >
        {{ event.title }} · {{ formatWhen(event.startsAt) }} ·
        {{ event.provider === 'google' ? 'Google' : 'Microsoft' }}
      </li>
    </ul>
    <p
      v-else-if="calendar.status?.google.connected || calendar.status?.microsoft.connected"
      class="text-sm text-muted-foreground"
    >
      No upcoming events.
    </p>

    <div class="flex flex-col gap-3 border-t pt-4">
      <h3 class="text-sm font-semibold">Microsoft</h3>
      <label class="flex flex-col gap-2 text-sm font-medium" for="microsoft-client-id">
        Microsoft client id
        <input
          id="microsoft-client-id"
          v-model="microsoftClientId"
          class="h-10 rounded-md border border-input bg-background px-3 font-normal"
          type="text"
          autocomplete="off"
          spellcheck="false"
          @input="microsoftDirty = true"
        />
      </label>
      <div class="flex flex-wrap gap-2">
        <Button :disabled="calendar.busy || !microsoftClientId.trim()" @click="saveMicrosoft">
          Save
        </Button>
        <Button
          :disabled="
            calendar.busy ||
            !microsoftClientId.trim() ||
            calendar.status?.connectPending === 'microsoft'
          "
          @click="calendar.connectMicrosoft()"
        >
          Connect
        </Button>
        <Button
          v-if="calendar.status?.microsoft.connected"
          variant="outline"
          :disabled="calendar.busy"
          @click="calendar.disconnectMicrosoft()"
        >
          Disconnect
        </Button>
        <Button
          v-if="calendar.status?.connectPending === 'microsoft'"
          variant="outline"
          @click="calendar.cancelConnect()"
        >
          Cancel
        </Button>
      </div>
      <p
        v-if="calendar.status?.connectPending === 'microsoft'"
        class="text-sm text-muted-foreground"
      >
        Waiting for the browser…
      </p>
      <p v-if="calendar.status?.microsoft.connected" class="text-sm">
        Connected as {{ calendar.status.microsoft.accountEmail || 'Microsoft account' }}
      </p>
      <p v-if="calendar.status?.microsoft.error" class="text-sm text-destructive" role="alert">
        {{ calendar.status.microsoft.error }}
      </p>
    </div>
  </section>
</template>
