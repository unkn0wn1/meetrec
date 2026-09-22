# meetrec

Personal desktop meeting recorder. Session 1 records the microphone and the default system monitor into one local WAV.

**Stack:** Electron (electron-vite) · Vue 3.5 · shadcn-vue · Tailwind · Pinia · npm. Linux first.

## Run

```bash
npm install
npm run dev
```

Start writes a WAV. Stop finalizes it. Files land in the Electron user-data folder:

`~/.config/meetrec/recordings/<timestamp>.wav`

On this box that is `/home/spence/.config/meetrec/recordings/`.

## Checks

```bash
npm run typecheck
npm run lint:check
npm run format:check
npm run test
npm run guard:file-size
```

Husky runs the file-size guard, lint-staged, and typecheck before a commit, and unit tests before a push. Commits and pushes on `main` are blocked.

## What is stubbed

- Windows and macOS capture throw. Linux (PipeWire / Pulse via ffmpeg) is the working path.
- Calendar, notifications, speech-to-text, and minutes are not in this session.

Docs: [`docs/README.md`](docs/README.md). Agent notes: [`AGENTS.md`](AGENTS.md).
