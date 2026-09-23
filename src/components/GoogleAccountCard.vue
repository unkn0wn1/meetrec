<script setup lang="ts">
import type { GoogleConnectionStatus } from '../../electron/shared/calendar-contract'
import { Button } from '@/components/ui/button'
import CalendarChecklist from '@/components/CalendarChecklist.vue'

defineProps<{
  account: GoogleConnectionStatus
  busy: boolean
  pending: boolean
}>()

const emit = defineEmits<{
  reconnect: []
  disconnect: []
  drive: []
  calendars: [calendarIds: string[]]
}>()
</script>

<template>
  <div class="flex flex-col gap-2 rounded-lg border px-3 py-3">
    <p class="text-sm font-medium">
      {{ account.accountEmail || 'Google account' }}
    </p>
    <p v-if="pending" class="text-sm text-muted-foreground">Waiting for the browser…</p>
    <p v-if="account.error" class="text-sm text-destructive" role="alert">{{ account.error }}</p>
    <CalendarChecklist
      v-if="account.calendars.length > 0"
      :calendars="account.calendars"
      :busy="busy || pending"
      @change="emit('calendars', $event)"
    />
    <div class="flex flex-wrap gap-2">
      <Button variant="outline" :disabled="busy || pending" @click="emit('reconnect')">
        Reconnect
      </Button>
      <Button variant="outline" :disabled="busy || pending" @click="emit('disconnect')">
        Disconnect
      </Button>
      <Button
        v-if="!account.uploadScopeGranted"
        variant="outline"
        :disabled="busy || pending"
        @click="emit('drive')"
      >
        Connect Google Drive
      </Button>
    </div>
  </div>
</template>
