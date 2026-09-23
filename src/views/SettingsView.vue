<script setup lang="ts">
import { onMounted } from 'vue'
import ModeNav from '@/components/ModeNav.vue'
import SettingsPanel from '@/components/SettingsPanel.vue'
import { useSettingsStore } from '@/stores/settings'

const settings = useSettingsStore()

onMounted(() => {
  void settings.refreshAndValidate()
})
</script>

<template>
  <main class="mx-auto flex min-h-screen max-w-xl flex-col gap-6 px-6 py-8">
    <header class="flex items-start justify-between gap-4">
      <div>
        <p class="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">meetrec</p>
        <h1 class="mt-1 text-2xl font-semibold tracking-tight">Settings</h1>
      </div>
      <ModeNav />
    </header>
    <SettingsPanel />
  </main>
</template>
