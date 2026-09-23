# Vue ecosystem notes (approx. last 6 months → 2026-09)

Sources: Vue blog, `vuejs/core` releases, Pinia docs, electron-vite, shadcn-vue. Verify versions at scaffold time.

## meetrec choice (locked)

**Vue 3.5.x** + shadcn-vue + Tailwind. No Vue 3.6, no Vapor Mode, no alien-signals dependency for v1.

Vue 3.6 (alien-signals + Vapor) can wait. The project stays on Vue 3.5 while the UI kit is shadcn-vue / Reka, so the renderer stays compatible.

## Vue 3.5 habits we use

- `<script setup lang="ts">`
- Reactive props destructure; wrap for `watch` / composables as `() => prop`
- `useTemplateRef`, `defineModel`
- No Options API

As of mid/late 2026, 3.5.x is still receiving patches (e.g. 3.5.43 around 2026-09-17).

## Pinia

Setup stores. Secrets/HTTP stay in Electron main, not in Pinia.

## Tooling

electron-vite + Vue 3.5 + Tailwind + shadcn-vue (Reka). Vitest + `vue-tsc`.
