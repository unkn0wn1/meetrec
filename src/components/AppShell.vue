<script setup lang="ts">
import ModeNav from '@/components/ModeNav.vue'

defineProps<{
  title?: string
}>()
</script>

<template>
  <main
    class="mx-auto flex min-h-screen w-full min-w-0 max-w-3xl flex-col gap-6 overflow-x-hidden px-6 py-8"
  >
    <header class="flex items-start justify-between gap-4">
      <div class="min-w-0">
        <slot name="heading">
          <p class="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            meetrec
          </p>
          <h1 class="mt-1 text-2xl font-semibold tracking-tight">{{ title }}</h1>
          <slot name="subtitle" />
        </slot>
      </div>
      <ModeNav />
    </header>
    <slot />
  </main>
</template>
