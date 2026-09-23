<script setup lang="ts">
import { Button } from '@/components/ui/button'
import { useCalendarStore } from '@/stores/calendar'

const calendar = useCalendarStore()

function onUpload(provider: 'google' | 'microsoft', event: Event): void {
  const checked = event.target instanceof HTMLInputElement && event.target.checked
  void calendar.setUpload(provider, checked)
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

    <div class="flex flex-col gap-3">
      <h3 class="text-sm font-semibold">Google</h3>
      <div class="flex flex-wrap gap-2">
        <Button
          :disabled="calendar.busy || calendar.status?.connectPending === 'google'"
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
      <label class="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          :checked="calendar.status?.google.uploadEnabled === true"
          :disabled="calendar.busy || calendar.status?.google.uploadScopeGranted !== true"
          @change="onUpload('google', $event)"
        />
        Upload to Google Drive (folder meetrec in My Drive)
      </label>
      <Button
        v-if="calendar.status?.google.uploadScopeGranted !== true"
        variant="outline"
        :disabled="calendar.busy || calendar.status?.connectPending === 'google'"
        @click="calendar.connectDrive('google')"
      >
        Connect Google Drive
      </Button>
    </div>

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
      <div class="flex flex-wrap gap-2">
        <Button
          :disabled="calendar.busy || calendar.status?.connectPending === 'microsoft'"
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
      <label class="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          :checked="calendar.status?.microsoft.uploadEnabled === true"
          :disabled="calendar.busy || calendar.status?.microsoft.uploadScopeGranted !== true"
          @change="onUpload('microsoft', $event)"
        />
        Upload to OneDrive (the meetrec app folder)
      </label>
      <Button
        v-if="calendar.status?.microsoft.uploadScopeGranted !== true"
        variant="outline"
        :disabled="calendar.busy || calendar.status?.connectPending === 'microsoft'"
        @click="calendar.connectDrive('microsoft')"
      >
        Connect OneDrive
      </Button>
    </div>
  </section>
</template>
