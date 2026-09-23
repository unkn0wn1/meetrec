<script setup lang="ts">
import { computed } from 'vue'
import { Button } from '@/components/ui/button'
import CalendarChecklist from '@/components/CalendarChecklist.vue'
import GoogleAccountCard from '@/components/GoogleAccountCard.vue'
import { useCalendarStore } from '@/stores/calendar'

const calendar = useCalendarStore()
const accounts = computed(() => calendar.status?.googleAccounts ?? [])
const googlePending = computed(() => calendar.status?.connectPending === 'google')
const addingGoogle = computed(() => googlePending.value && !calendar.status?.connectTargetId)
const driveEmail = computed(
  () => accounts.value.find((account) => account.uploadScopeGranted)?.accountEmail ?? null
)
const uploadLabel = computed(() =>
  driveEmail.value
    ? `Upload to Google Drive as ${driveEmail.value} (folder meetrec in My Drive)`
    : 'Upload to Google Drive (folder meetrec in My Drive)'
)

function onUpload(provider: 'google' | 'microsoft', event: Event): void {
  const checked = event.target instanceof HTMLInputElement && event.target.checked
  void calendar.setUpload(provider, checked)
}
</script>

<template>
  <section class="flex flex-col gap-4">
    <div>
      <h2 class="text-lg font-semibold tracking-tight">Calendars</h2>
      <p class="mt-1 text-sm text-muted-foreground">
        Connect Google or Microsoft. Choose which calendars to watch. Upload stays off until you
        turn it on.
      </p>
    </div>

    <p v-if="calendar.error" class="text-sm text-destructive" role="alert">{{ calendar.error }}</p>

    <div class="flex flex-col gap-3">
      <h3 class="text-sm font-semibold">Google</h3>
      <div class="flex flex-wrap gap-2">
        <Button :disabled="calendar.busy || googlePending" @click="calendar.connectGoogle()">
          {{ accounts.length > 0 ? 'Connect another Google account' : 'Connect Google' }}
        </Button>
        <Button v-if="googlePending" variant="outline" @click="calendar.cancelConnect()">
          Cancel
        </Button>
      </div>
      <p v-if="addingGoogle" class="text-sm text-muted-foreground">Waiting for the browser…</p>
      <p v-if="calendar.status?.google.error" class="text-sm text-destructive" role="alert">
        {{ calendar.status.google.error }}
      </p>
      <GoogleAccountCard
        v-for="account in accounts"
        :key="account.id"
        :account="account"
        :busy="calendar.busy"
        :pending="googlePending && calendar.status?.connectTargetId === account.id"
        @reconnect="calendar.connectGoogle(account.id)"
        @disconnect="calendar.disconnectGoogle(account.id)"
        @drive="calendar.connectDrive('google', account.id)"
        @calendars="calendar.setCalendars('google', account.id, $event)"
      />
      <label class="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          :checked="calendar.status?.google.uploadEnabled === true"
          :disabled="calendar.busy || calendar.status?.google.uploadScopeGranted !== true"
          @change="onUpload('google', $event)"
        />
        {{ uploadLabel }}
      </label>
    </div>

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
      <CalendarChecklist
        v-if="calendar.status?.microsoft.calendars.length"
        :calendars="calendar.status.microsoft.calendars"
        :busy="calendar.busy"
        @change="calendar.setCalendars('microsoft', null, $event)"
      />
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
