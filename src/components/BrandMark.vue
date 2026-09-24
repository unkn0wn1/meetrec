<script setup lang="ts">
withDefaults(
  defineProps<{
    size?: 'sm' | 'md'
    showWordmark?: boolean
  }>(),
  { size: 'sm', showWordmark: true }
)
</script>

<template>
  <span class="inline-flex items-center gap-2" aria-label="MeetRec">
    <span
      class="flex shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400 to-violet-500"
      :class="size === 'md' ? 'size-8' : 'size-6'"
      aria-hidden="true"
    >
      <svg
        class="text-[#05060a]"
        :class="size === 'md' ? 'size-[18px]' : 'size-3.5'"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M12 3a4 4 0 0 1 4 4v3a4 4 0 1 1-8 0V7a4 4 0 0 1 4-4Z"
          stroke="currentColor"
          stroke-width="2"
        />
        <path
          d="M5 12a7 7 0 0 0 14 0M12 19v2"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
        />
      </svg>
    </span>
    <span
      v-if="showWordmark"
      class="text-sm font-semibold tracking-tight text-foreground"
      :class="size === 'md' ? 'text-base' : ''"
    >
      Meet<span
        class="bg-gradient-to-r from-cyan-300 via-violet-300 to-pink-300 bg-clip-text text-transparent"
        >Rec</span
      >
    </span>
  </span>
</template>
