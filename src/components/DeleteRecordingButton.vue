<script setup lang="ts">
import { ref } from 'vue'
import { Button } from '@/components/ui/button'

withDefaults(
  defineProps<{
    busy: boolean
    appearance?: 'panel' | 'row'
  }>(),
  { appearance: 'panel' }
)

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
  <section v-if="appearance !== 'row'" class="glass p-5">
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
  <div v-else class="shrink-0" @click.stop>
    <Button
      v-if="!confirming"
      size="sm"
      variant="destructive"
      type="button"
      :disabled="busy"
      @click.stop="ask"
    >
      Delete
    </Button>
    <div v-else class="flex max-w-56 flex-col items-end gap-2">
      <p class="text-right text-xs text-muted-foreground">Local folder only. Cloud copies stay.</p>
      <div class="flex flex-wrap justify-end gap-2">
        <Button size="sm" variant="outline" type="button" :disabled="busy" @click.stop="cancel">
          Cancel
        </Button>
        <Button
          size="sm"
          variant="destructive"
          type="button"
          :disabled="busy"
          @click.stop="confirm"
        >
          Delete permanently
        </Button>
      </div>
    </div>
  </div>
</template>
