# Folder structure (proposed)

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
      recording/        # session status helpers (v1)
      calendar/         # later
      transcript/       # later
      minutes/          # later
      providers/        # later
      settings/         # later
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
  scripts/              # guard-file-size and similar
  package.json
```

Rules:

- Prefer many small files over one large module.
- `capture/*` must not import Vue or Pinia.
- Renderer must not import `electron` or Node `fs` directly.
