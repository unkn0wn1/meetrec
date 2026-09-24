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
    <svg
      class="shrink-0 rounded-[22%]"
      :class="size === 'md' ? 'size-8' : 'size-6'"
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect width="64" height="64" rx="14" fill="#0a0c14" />
      <circle cx="32" cy="28" r="10" stroke="#22d3ee" stroke-width="3" />
      <path
        d="M20 44c2.5-6 7-9 12-9s9.5 3 12 9"
        stroke="#a78bfa"
        stroke-width="3"
        stroke-linecap="round"
      />
      <circle cx="46" cy="18" r="4" fill="#22d3ee" />
    </svg>
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
