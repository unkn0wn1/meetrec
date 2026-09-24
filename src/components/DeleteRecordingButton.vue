<script setup lang="ts">
import { ref } from 'vue'
import { Button } from '@/components/ui/button'

defineProps<{
  busy: boolean
}>()

const emit = defineEmits<{
  confirm: []
}>()

const confirming = ref(false)

function ask(): void {
  confirming.value = true
}

function cancel(): void {
  confirming.value = false
}

function confirm(): void {
  emit('confirm')
}
</script>

<template>
  <section class="glass p-5">
    <template v-if="!confirming">
      <p class="text-sm text-muted-foreground">
        Remove this take from the library. Local audio, transcript, and summary are deleted. Cloud
        copies stay if you already uploaded.
      </p>
      <Button class="mt-3" size="sm" variant="destructive" :disabled="busy" @click="ask">
        Delete recording
      </Button>
    </template>
    <template v-else>
      <p class="text-sm font-medium text-destructive">Delete permanently?</p>
      <p class="mt-2 text-sm text-muted-foreground">
        This cannot be undone. The recording folder on this computer will be removed.
      </p>
      <div class="mt-3 flex flex-wrap gap-2">
        <Button size="sm" variant="outline" :disabled="busy" @click="cancel">Cancel</Button>
        <Button size="sm" variant="destructive" :disabled="busy" @click="confirm">
          Delete permanently
        </Button>
      </div>
    </template>
  </section>
</template>
