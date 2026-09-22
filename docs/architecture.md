# Architecture

## Processes (Electron)

```
┌─────────────────────┐     IPC (typed)      ┌──────────────────────┐
│  Renderer (Vue + UI kit)│ ◄──────────────────► │  Main process         │
│  UI kit, Pinia, views    │                      │  Window, tray, sched  │
│  No raw API secrets  │                      │  Secrets store        │
└─────────────────────┘                      │  Provider HTTP calls  │
                                             │  Audio backend pick   │
                                             └──────────┬───────────┘
                                                        │
                                             ┌──────────▼───────────┐
                                             │  Capture backend     │
                                             │  win / mac / linux   │
                                             └──────────────────────┘
```

- **Renderer:** UI only. Pinia for UI/session state. Axios (or thin clients) talk to **main via IPC**, not straight to provider APIs with secrets.
- **Preload:** contextBridge — expose a narrow, typed API (`window.meetrec.*`).
- **Main:** calendar polling/scheduling, start/stop capture, persist settings/keys, call STT/LLM providers, write files.
- **Capture backends:** one interface, three implementations selected by `process.platform`.

## Domains (keep separate)

| Domain       | Owns                                                |
| ------------ | --------------------------------------------------- |
| `calendar`   | Google OAuth + upcoming events + arm/disarm         |
| `recording`  | Session lifecycle, Stop popup, silence/calendar end |
| `capture`    | OS audio backends only                              |
| `transcript` | STT job, diarization labels, speaker rename         |
| `minutes`    | LLM prompt + result artifact                        |
| `providers`  | Registry of STT/LLM configs (no UI widgets)         |
| `settings`   | Paths, thresholds, default providers                |

One domain → one folder. No god-services. Cross-domain calls go through small facades or IPC handlers, not deep imports of each other’s internals.

## Data artifacts (local)

- `recordings/<id>.wav` (or opus)
- `recordings/<id>.transcript.json`
- `recordings/<id>.minutes.md`
- `settings.json` / OS keychain for secrets (see security.md)
