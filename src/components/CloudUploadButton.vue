<script setup lang="ts">
import { ref } from 'vue'
import { Button } from '@/components/ui/button'
import { useMeetrec } from '@/composables/useMeetrec'
import { useCalendarStore } from '@/stores/calendar'

const props = defineProps<{
  recordingId: string
}>()

const calendar = useCalendarStore()
const message = ref<string | null>(null)
const busy = ref(false)

async function upload(provider: 'google' | 'microsoft'): Promise<void> {
  busy.value = true
  message.value = null
  try {
    const result = await useMeetrec().cloud.upload({ recordingId: props.recordingId, provider })
    message.value = result.ok ? 'Uploaded.' : result.message
  } catch (caught) {
    message.value = caught instanceof Error ? caught.message : 'Upload failed.'
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <section class="flex flex-col gap-2">
    <div class="flex flex-wrap gap-2">
      <Button
        variant="outline"
        :disabled="busy || !calendar.status?.google.uploadScopeGranted"
        @click="upload('google')"
      >
        Upload to Google Drive
      </Button>
      <Button
        variant="outline"
        :disabled="busy || !calendar.status?.microsoft.uploadScopeGranted"
        @click="upload('microsoft')"
      >
        Upload to OneDrive
      </Button>
    </div>
    <p v-if="message" class="text-sm text-muted-foreground" role="status">{{ message }}</p>
  </section>
</template>
