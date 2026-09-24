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
  confirm: [removeCloud: boolean]
}>()

const confirming = ref(false)
const removeCloud = ref(false)

function ask(): void {
  removeCloud.value = false
  confirming.value = true
}

function cancel(): void {
  confirming.value = false
  removeCloud.value = false
}

function confirm(): void {
  emit('confirm', removeCloud.value)
}
</script>

<template>
  <section v-if="appearance !== 'row'" class="glass p-5">
    <template v-if="!confirming">
      <p class="text-sm text-muted-foreground">
        Remove this take from the library. The next step deletes the local folder. You can also
        remove Drive and OneDrive copies this app uploaded. That option starts off.
      </p>
      <Button class="mt-3" size="sm" variant="destructive" :disabled="busy" @click="ask">
        Delete recording
      </Button>
    </template>
    <template v-else>
      <p class="text-sm font-medium text-destructive">Delete permanently?</p>
      <p class="mt-2 text-sm text-muted-foreground">
        This removes the recording folder on this computer. Uploaded copies stay unless you check
        the box. If a cloud delete fails, the local folder is kept.
      </p>
      <label class="mt-3 flex items-start gap-2 text-sm">
        <input v-model="removeCloud" class="mt-0.5" type="checkbox" :disabled="busy" />
        <span>Also remove uploaded Drive / OneDrive copies</span>
      </label>
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
    <div v-else class="flex max-w-72 flex-col items-stretch gap-2">
      <p class="text-left text-xs text-muted-foreground">
        Uploaded copies stay unless you check the box. If a cloud delete fails, the local folder is
        kept.
      </p>
      <label class="flex items-start gap-2 text-left text-xs">
        <input v-model="removeCloud" class="mt-0.5" type="checkbox" :disabled="busy" />
        <span>Also remove uploaded Drive / OneDrive copies</span>
      </label>
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
