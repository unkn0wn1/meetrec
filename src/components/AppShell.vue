<script setup lang="ts">
import BrandMark from '@/components/BrandMark.vue'
import ModeNav from '@/components/ModeNav.vue'
import UpdateBanner from '@/components/UpdateBanner.vue'

defineProps<{
  title?: string
}>()
</script>

<template>
  <main class="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-6 px-6 py-8">
    <header class="flex items-start justify-between gap-4">
      <div class="min-w-0">
        <slot name="heading">
          <BrandMark class="mb-2" />
          <h1 class="text-2xl font-semibold tracking-tight">{{ title }}</h1>
          <slot name="subtitle" />
        </slot>
      </div>
      <ModeNav />
    </header>
    <UpdateBanner />
    <slot />
  </main>
</template>
