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

## Where logic lives

| Kind | Put it in |
| --- | --- |
| Capture, files, secrets, provider HTTP, recording lifecycle | Electron **main domains** (`electron/domains/`, `electron/capture/`) |
| Shared UI / session state across views | **Pinia** setup stores (call `window.meetrec` IPC) |
| Reusable UI helpers with no cross-route state | **Composables** under `src/composables/`, or pure helpers under `src/lib/` |
| Layout and wiring only | Vue **views / components** (keep SFCs thin) |

Do **not** put filesystem, ffmpeg, or credential logic in composables or Pinia. Do **not** empty Pinia in favor of “composables only” — stores are for shared reactive session state; composables are for reusable view glue.

## Pinia

- One store per UI concern (`recordingSession`, `speakerMap`, `providerSettings` UI mirrors).
- Domain logic that needs secrets or filesystem stays in main; stores hold view-model state and call IPC.

## Provider HTTP

- `fetch` from Electron main only (`electron/domains/providers/`).
- Do not put provider base URLs or keys in the renderer.

## IPC

- Typed request/response map in `electron/shared/ipc-contract.ts`.
- No ad-hoc `ipcRenderer.send` string soup.

## Naming

- Files: `kebab-case.ts`, Vue SFCs: `PascalCase.vue`.
- Avoid `helpers`, `common`, `misc` folders.

## UI components

- Prefer the chosen component library’s primitives (shadcn-vue or Nuxt UI).
- Keep view files thin: compose library components; no giant page SFCs.
- Desktop-first layout (Stop popup, settings) — not mobile-app chrome.
