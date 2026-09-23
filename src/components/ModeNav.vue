<script setup lang="ts">
import { Settings } from 'lucide-vue-next'
import { useRoute, useRouter } from 'vue-router'
import { Button } from '@/components/ui/button'

const route = useRoute()
const router = useRouter()

function go(name: 'library' | 'record' | 'settings'): void {
  void router.push({ name })
}
</script>

<template>
  <nav class="flex items-center gap-2" aria-label="Modes">
    <Button
      size="sm"
      :variant="route.name === 'library' || route.name === 'recording' ? 'default' : 'outline'"
      @click="go('library')"
    >
      Library
    </Button>
    <Button
      size="sm"
      :variant="route.name === 'record' ? 'default' : 'outline'"
      @click="go('record')"
    >
      Record
    </Button>
    <Button
      size="icon"
      variant="outline"
      aria-label="Settings"
      title="Settings"
      :class="route.name === 'settings' ? 'bg-accent text-accent-foreground' : ''"
      @click="go('settings')"
    >
      <Settings class="size-4" />
    </Button>
  </nav>
</template>
