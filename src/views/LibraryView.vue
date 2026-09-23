<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import ModeNav from '@/components/ModeNav.vue'
import RecordingRow from '@/components/RecordingRow.vue'
import { Button } from '@/components/ui/button'
import { useLibraryStore } from '@/stores/library'
import { useSettingsStore } from '@/stores/settings'

const library = useLibraryStore()
const settings = useSettingsStore()
const router = useRouter()

onMounted(() => {
  void library.refresh()
  void settings.refreshAndValidate()
})

function open(id: string): void {
  void router.push({ name: 'recording', params: { id } })
}
</script>

<template>
  <main class="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-6 py-8">
    <header class="flex items-start justify-between gap-4">
      <div>
        <p class="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">meetrec</p>
        <h1 class="mt-1 text-2xl font-semibold tracking-tight">Library</h1>
      </div>
      <ModeNav />
    </header>

    <p v-if="library.error" class="text-sm text-destructive" role="alert">{{ library.error }}</p>

    <section
      v-if="library.items.length === 0 && !library.loading"
      class="rounded-xl border bg-card p-8"
    >
      <p class="font-medium">No recordings yet</p>
      <p class="mt-2 text-sm text-muted-foreground">
        Start a recording and it will show up here as a folder with the audio and notes.
      </p>
      <Button class="mt-4" @click="router.push({ name: 'record' })">Record</Button>
    </section>

    <section v-else class="overflow-hidden rounded-xl border bg-card shadow-sm">
      <ul>
        <li v-for="item in library.items" :key="item.id" class="border-b last:border-b-0">
          <button class="w-full text-left hover:bg-accent/60" type="button" @click="open(item.id)">
            <RecordingRow :item="item" />
          </button>
        </li>
      </ul>
    </section>
  </main>
</template>
