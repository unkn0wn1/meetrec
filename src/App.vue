<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { RouterView } from 'vue-router'
import { useSettingsStore } from '@/stores/settings'

const settings = useSettingsStore()

function onFocus(): void {
  void settings.refreshAndValidate()
}

onMounted(() => {
  void settings.refreshAndValidate()
  window.addEventListener('focus', onFocus)
})

onUnmounted(() => {
  window.removeEventListener('focus', onFocus)
})
</script>

<template>
  <RouterView />
</template>
