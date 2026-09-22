# Stack

## Locked

| Layer             | Choice                                                   |
| ----------------- | -------------------------------------------------------- |
| Language          | TypeScript (strict)                                      |
| UI framework      | **Vue 3.5.x** + `<script setup>`                         |
| Component library | **shadcn-vue + Tailwind CSS**                            |
| State             | Pinia (setup stores)                                     |
| Provider HTTP     | Axios/fetch in **Electron main** only; renderer uses IPC |
| Desktop shell     | Electron via **electron-vite**                           |
| Package manager   | **npm**                                                  |
| Packaging         | electron-builder (or electron-vite packaging)            |
| Platform priority | **Linux first**; win/mac experimental until tested       |
| Calendar          | Google OAuth (`calendar.readonly` first)                 |
| Default STT       | xAI Grok Voice Transcribe 2.0 (`diarize` on)             |
| Default LLM       | Grok via SuperGrok Heavy API access                      |
| Other users       | Pluggable provider list + API keys                       |
| Artifacts (v1)    | Local files only                                         |
| Unit tests        | Vitest                                                   |

## Vue baseline

- **Vue 3.5.x** only — do not pin 3.6 / Vapor / alien-signals for v1.
- Composition API: `useTemplateRef`, reactive props destructure, `defineModel`.
- No Options API. No Vapor Mode.
