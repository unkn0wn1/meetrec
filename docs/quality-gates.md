# Quality gates

## Local (must pass before merge)

1. `npm run typecheck` — `tsc` for main/preload plus `vue-tsc` for the renderer.
2. `npm run lint:check` — ESLint flat config (Vue + TypeScript). `npm run lint` auto-fixes.
3. `npm run format:check` — Prettier. `npm run format` writes.
4. `npm run test` — Vitest. Pure helpers only (paths, duration, Pulse parse, Windows device lists, session status, folder layout, WAV migration, transcript segments, minutes markdown, provider selection, settings migration, provider registry, role probes, xAI device-code parsing, secret-bag codec, ffmpeg binary resolution). No Electron window required.
5. `npm run guard:file-size` — fail if a source file under `electron/`, `src/`, or `scripts/` exceeds 400 lines.

## Hooks

`npm install` runs `prepare` → Husky.

- **pre-commit:** block `main` (override `ALLOW_MAIN_COMMIT=1`), file-size guard, lint-staged (Prettier + ESLint), typecheck.
- **pre-push:** block `main` (override `ALLOW_MAIN_PUSH=1`), unit tests.

Do not disable hooks or skip gates to land a change. Fix the failure.

## CI

CI is present. `.github/workflows/ci.yml` runs on pull requests and on pushes to `main`. The job uses `ubuntu-latest` and Node 22:

1. `npm ci`
2. `npm run typecheck`
3. `npm run lint:check`
4. `npm run format:check`
5. `npm run guard:file-size`
6. `npm run test`

Installer **releases** are tag-only (`.github/workflows/release.yml` on `v*` tags): GitHub runners build AppImage + Windows exe and attach them to a GitHub Release. Tag releases sign Windows through Azure Trusted Signing when `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, and `AZURE_CLIENT_SECRET` are present. Ad-hoc artifacts without a release: `.github/workflows/package.yml` (`workflow_dispatch`). That workflow does not receive those secrets and stays unsigned. The Linux AppImage stays unsigned. See [packaging.md](packaging.md).

`npm run dist:linux` is optional local smoke. It is not a merge gate.

## Manual gates (capture)

- Linux PipeWire path: Start → `userData/recordings/<id>/audio.wav` → Stop. File must be playable PCM WAV. `meta.json` is written beside it.
- Library opens that folder. Transcribe writes `transcript.json`. Generate summary writes `summary.md` and sets `meta.topic`.
- Windows (manual, not CI): the packaged app includes ffmpeg. For `npm run dev`, `ffmpeg` on PATH (`ffmpeg -version`) is enough. Enable Stereo Mix if the driver hid it (Sound → Recording → show disabled devices). Start, play system audio, speak, Stop. `audio.wav` plays. `meta.json` `captureMode` is `mix`, or `mic-only` with a TODO note. The recorder shows that note.
- macOS capture stays a stub. The Record tab and calendar prompt must disable Start (and Auto-arm) and show `unsupportedReason` instead of throwing only after click. The phased plan is [mac-system-audio-plan.md](mac-system-audio-plan.md).

## Definition of done (feature)

- Docs updated if architecture or gates changed.
- No secrets in git.
- Unit tests for new pure logic.
- Recording UI shows Recording and Stop while capture is active.
