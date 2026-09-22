# Coding guidelines

## Principles

- **KISS / DRY** — duplicate twice before inventing a wrong abstraction; then extract.
- **One domain, one responsibility** — no monolith services or “utils.ts” dumping grounds.
- **Small files** — if a file needs a table of contents, split it.
- **Explicit over clever** — especially around IPC and audio.

## Vue / TypeScript

- Always `<script setup lang="ts">`.
- Prefer Composition API + Pinia **setup stores**.
- Use Vue 3.5+ patterns: `defineModel`, `useTemplateRef`, reactive props destructure (pass destructured props into watchers/composables via `() => prop`).
- Options API: do not use.
- Vue **3.5.x** only. Do not use Vue 3.6 / Vapor Mode in v1.

## Pinia

- One store per UI concern (`recordingSession`, `speakerMap`, `providerSettings` UI mirrors).
- Domain logic that needs secrets or filesystem stays in main; stores hold view-model state and call IPC.

## Axios

- Allowed for HTTP **from main** and for any renderer calls that hit **local** bridges if we expose HTTP locally.
- Prefer a tiny `api` wrapper per provider in main (`providers/xaiStt.ts`) over scattered axios calls.
- Do not put provider base URLs + keys into a global renderer axios instance.

## IPC

- Typed request/response map in one module (`ipc/contract.ts`) shared as types only.
- No ad-hoc `ipcRenderer.send` string soup.

## Naming

- Files: `kebab-case.ts`, Vue SFCs: `PascalCase.vue`.
- Avoid `helpers`, `common`, `misc` folders.

## UI components

- Prefer the chosen component library’s primitives (shadcn-vue or Nuxt UI).
- Keep view files thin: compose library components; no giant page SFCs.
- Desktop-first layout (Stop popup, settings) — not mobile-app chrome.
