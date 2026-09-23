<script setup lang="ts">
import { onMounted } from 'vue'
import AppShell from '@/components/AppShell.vue'
import SettingsPanel from '@/components/SettingsPanel.vue'
import { useSettingsStore } from '@/stores/settings'

const settings = useSettingsStore()

onMounted(() => {
  void settings.refreshAndValidate()
})
</script>

<template>
  <AppShell title="Settings">
    <SettingsPanel />
  </AppShell>
</template>
