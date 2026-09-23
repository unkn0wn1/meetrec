# Folder structure

```
meetrec/
  docs/                 # this set
  electron/
    main/               # app entry, windows, tray, IPC
    preload/            # contextBridge API
    shared/             # IPC contract types (no Electron runtime)
    capture/            # platform backends + types
      types.ts
      index.ts          # pick backend
      windows.ts
      macos.ts
      linux.ts
    domains/            # main-side domain modules (small files)
      recording/        # session status, folder layout, library scan
      calendar/         # later
      transcript/       # STT document + diarization segments
      minutes/          # summary markdown
      providers/        # xAI + OpenAI STT/chat, OAuth helpers (main only)
      settings/         # provider choice, secret bag, device-code session
  src/                  # renderer (Vue) — electron-vite renderer root
    main.ts
    App.vue
    index.html
    router/
    stores/             # Pinia — one store per UI concern
    views/
    components/         # small, presentational + shadcn-vue ui/
    composables/        # thin wrappers over window.meetrec
    styles/
  scripts/              # guard-file-size, fetch-ffmpeg
  vendor/ffmpeg/        # gitignored BtbN binaries fetched before packaging
  electron-builder.yml  # installer targets (NSIS, portable, AppImage)
  build/                # later: icon.png and icon.ico
  dist/                 # installer output, gitignored
  out/                  # electron-vite compile output, gitignored
  package.json
```

Rules:

- Prefer many small files over one large module.
- `capture/*` must not import Vue or Pinia.
- Renderer must not import `electron` or Node `fs` directly.
