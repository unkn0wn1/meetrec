# Agent notes — meetrec

Desktop meeting recorder. Linux capture plus a local library, transcript, and summary. Do not deploy. Do not delete `docs/`.

## Stack (locked)

- Electron via electron-vite. Vue **3.5.x** `<script setup>`. No Vue 3.6, Vapor, Capacitor, or Ionic.
- shadcn-vue + Tailwind. Pinia setup stores. npm.
- Secrets and provider HTTP stay in the main process. The renderer talks through `window.meetrec`.
- Linux first. Windows capture is implemented (ffmpeg DirectShow, or WASAPI when that demuxer exists). macOS capture is still a stub.
- Artifacts are local files. No cloud upload in v1.
- Installers use electron-builder and stay unsigned. They ship a pinned LGPL ffmpeg under `resources/ffmpeg/`. `npm run dev` uses `ffmpeg` on PATH when that file is absent. No auto-update yet. See `docs/packaging.md`.

## Process boundary

- Renderer (`src/`) must not import `electron` or Node `fs`.
- Capture (`electron/capture/`) must not import Vue or Pinia.
- IPC names live in `electron/shared/ipc-contract.ts`. Do not invent ad-hoc channel strings.
- Transcribe uses the Voice default and its speech model. Summary uses the AI default and its chat model.
- Logic placement: main domains for product/IO; Pinia for shared UI session state; composables/`src/lib` for reusable view helpers; thin SFCs. See `docs/coding-guidelines.md`.

## Quality gates

Fix the failure. Do not disable Husky, raise the file-size limit, or skip typecheck to land a change.

| Check                           | When                               |
| ------------------------------- | ---------------------------------- |
| `guard:file-size` (400 lines)   | pre-commit                         |
| lint-staged (Prettier + ESLint) | pre-commit                         |
| `typecheck`                     | pre-commit                         |
| `test` (Vitest)                 | pre-push                           |
| `format:check`, `lint:check`    | before you call the work done      |
| CI (Ubuntu, Node 22)            | pull requests and pushes to `main` |

`.github/workflows/ci.yml` runs `npm ci`, typecheck, `lint:check`, `format:check`, `guard:file-size`, and `test`. Tag `v*` runs `.github/workflows/release.yml` (GitHub Release with installers). `.github/workflows/package.yml` is manual ad-hoc artifacts only.

Direct commits and pushes to `main` are blocked. Override only for an emergency: `ALLOW_MAIN_COMMIT=1` / `ALLOW_MAIN_PUSH=1`.

## Capture

Linux records with ffmpeg against Pulse (PipeWire). Prefer a mix of the default mic and `<default sink>.monitor`. If the monitor is missing, mic-only is allowed and the note must say so, including a TODO for system audio. Capture uses the packaged binary under `process.resourcesPath/ffmpeg` when it is there, and `ffmpeg` on PATH otherwise.

Windows records with ffmpeg. DirectShow mixes the mic and a Stereo Mix / loopback capture device. If `ffmpeg -devices` lists a `wasapi` demuxer whose help shows a loopback option, that path is used instead. Mic-only still requires a TODO in the note. Live Windows smoke is manual.

A recording is not done until Start writes `recordings/<id>/audio.wav` and Stop leaves a playable WAV plus `meta.json`. Older flat `*.wav` files are migrated into that layout on library scan. Transcription and summary HTTP stay in main.

## Docs

Before you start a branch, read the relevant files under `docs/` (and this file) so you match locked stack, capture, packaging, and gates.

When you finish a branch — before you open or update the PR — check the docs again and update anything that drifted: architecture, capture, providers, packaging, quality gates, getting started, README, CONTRIBUTING, or this file. Do not leave “we’ll document it later.” Keep files short. Style follows the product docs already in this repo, not an Angular SPA.

## Linux Electron sandbox

`npm run dev` uses `--no-sandbox`. Prefer that for daily work; see README for setuid chrome-sandbox setup.
