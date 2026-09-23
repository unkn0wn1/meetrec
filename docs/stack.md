# Stack

## Locked

| Layer             | Choice                                                                         |
| ----------------- | ------------------------------------------------------------------------------ |
| Language          | TypeScript (strict)                                                            |
| UI framework      | **Vue 3.5.x** + `<script setup>`                                               |
| Component library | **shadcn-vue + Tailwind CSS**                                                  |
| State             | Pinia (setup stores)                                                           |
| Provider HTTP     | `fetch` in **Electron main** only; renderer uses IPC                           |
| Desktop shell     | Electron via **electron-vite**                                                 |
| Package manager   | **npm**                                                                        |
| Packaging         | **electron-builder** (Win NSIS + portable, Linux AppImage)                     |
| Platform priority | **Linux first**. Windows capture is experimental. macOS is a stub.             |
| Calendar          | Google Calendar readonly and Microsoft Graph are in the app (PKCE + loopback). |
| Default STT       | xAI Grok Voice Transcribe 2.0 (`diarize` on) on a fresh install                |
| Default LLM       | `grok-4.5` on a fresh install. Voice and AI defaults are separate              |
| Other users       | Pluggable provider list + API keys                                             |
| Artifacts         | Local files, plus optional Google Drive and OneDrive app-folder upload.        |
| Unit tests        | Vitest                                                                         |

## Vue baseline

- **Vue 3.5.x** only — do not pin 3.6 / Vapor / alien-signals for v1.
- Composition API: `useTemplateRef`, reactive props destructure, `defineModel`.
- No Options API. No Vapor Mode.
