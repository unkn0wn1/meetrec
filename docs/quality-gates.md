# Quality gates

## Local (must pass before merge)

1. `npm run typecheck` — `tsc` for main/preload plus `vue-tsc` for the renderer.
2. `npm run lint:check` — ESLint flat config (Vue + TypeScript). `npm run lint` auto-fixes.
3. `npm run format:check` — Prettier. `npm run format` writes.
4. `npm run test` — Vitest. Pure helpers only (paths, duration, Pulse parse, session status). No Electron window required.
5. `npm run guard:file-size` — fail if a source file under `electron/`, `src/`, or `scripts/` exceeds 400 lines.

## Hooks

`npm install` runs `prepare` → Husky.

- **pre-commit:** block `main` (override `ALLOW_MAIN_COMMIT=1`), file-size guard, lint-staged (Prettier + ESLint), typecheck.
- **pre-push:** block `main` (override `ALLOW_MAIN_PUSH=1`), unit tests.

Do not disable hooks or skip gates to land a change. Fix the failure.

## CI

Not wired yet. When the repo exists on GitHub: install, typecheck, lint, format check, file-size guard, unit tests on Linux. Windows/macOS package smoke is later.

## Manual gates (capture)

- Linux PipeWire path: Start → WAV on disk under Electron `userData/recordings` → Stop. File must be playable PCM WAV.
- Windows and macOS capture stay experimental (stubs that throw) until someone on that OS verifies them.

## Definition of done (feature)

- Docs updated if architecture or gates changed.
- No secrets in git.
- Unit tests for new pure logic.
- Recording UI shows Recording and Stop while capture is active.
