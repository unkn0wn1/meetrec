# Contributing

## Branching

Work on a feature branch. Open a PR into `main`. Husky blocks commits and pushes on `main`.

Emergency override: `ALLOW_MAIN_COMMIT=1` or `ALLOW_MAIN_PUSH=1`. Use it only when a hook is the thing being fixed and you have said so.

## Goals

- Keep changes small and readable.
- One domain, one responsibility. Capture does not know about Vue. The renderer does not touch the filesystem.
- Prefer a second copy over a wrong abstraction. Extract when the third copy appears.
- Desktop layout. The recording indicator stays visible while capture is active.

## Principles

- DRY where the duplication is real.
- Explicit IPC. Channel names live in `electron/shared/ipc-contract.ts`.
- Small files. If a file needs a table of contents, split it by behavior.
- Vue 3.5 `<script setup>` only. No Options API. No Vapor Mode.

## File size

`npm run guard:file-size` fails when a source file under `electron/`, `src/`, or `scripts/` exceeds 400 lines. Split by behavior (types, platform backend, session status). Do not raise the limit to silence the script.

## When guards fail

| Guard                                   | Pre-commit | Pre-push |
| --------------------------------------- | ---------- | -------- |
| `guard:file-size`                       | yes        |          |
| lint-staged (Prettier + ESLint `--fix`) | yes        |          |
| `typecheck`                             | yes        |          |
| `test`                                  |            | yes      |

CI, when added, should run `typecheck`, `lint:check`, `format:check`, `guard:file-size`, and `test` on Linux. Do not disable a gate to get a green commit.

## Capture notes

Linux is the supported path (ffmpeg + Pulse / PipeWire). Windows and macOS throw from their stubs. A mic-only fallback must leave a TODO in the status note so system audio is not silently dropped.
