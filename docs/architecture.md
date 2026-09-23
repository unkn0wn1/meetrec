# Architecture

## Processes (Electron)

```
┌─────────────────────┐     IPC (typed)      ┌──────────────────────┐
│  Renderer (Vue)      │ ◄──────────────────► │  Main process        │
│  Pinia, views        │                      │  Window, tray, library│
│  No provider secrets │                      │  Secrets store       │
└─────────────────────┘                      │  Provider HTTP       │
                                             │  Audio backend pick  │
                                             └──────────┬───────────┘
                                                        │
                                             ┌──────────▼───────────┐
                                             │  Capture backend     │
                                             │  win / mac / linux   │
                                             └──────────────────────┘
```

- **Renderer:** UI only. Pinia holds view state and calls `window.meetrec`. Provider HTTP stays in main.
- **Preload:** `contextBridge` exposes a narrow typed API (`window.meetrec.*`).
- **Main:** window and tray, start and stop capture, library files, settings and secrets, speech-to-text and summary HTTP, Google Calendar poll, and the pre-meeting prompt. Cloud upload is not in the app yet. Microsoft Calendar follows.
- **Capture backends:** one interface, three implementations selected by `process.platform`. The macOS implementation throws.

## Domains (keep separate)

| Domain       | Owns                                                                                  |
| ------------ | ------------------------------------------------------------------------------------- |
| `recording`  | Folder layout, library scan, manual start/stop                                        |
| `capture`    | OS audio backends only                                                                |
| `transcript` | STT document, diarization labels, speaker rename                                      |
| `minutes`    | Summary prompt and `summary.md`                                                       |
| `providers`  | xAI and OpenAI speech and chat (no UI widgets)                                        |
| `settings`   | Voice default, AI default, secret bag, device-code session                            |
| `calendar`   | Google and Microsoft OAuth, primary-calendar poll, prompt, arm, grace stop            |
| `cloud`      | Optional upload of audio, transcript, and summary to Drive or the OneDrive app folder |

One domain, one folder. Cross-domain calls go through small facades or IPC handlers.

## Data artifacts (local)

One folder per recording (see [recorder-ui.md](recorder-ui.md)), under Electron `userData`:

- `recordings/<id>/audio.wav`
- `recordings/<id>/meta.json`
- `recordings/<id>/transcript.json`
- `recordings/<id>/summary.md`
- `settings.json` and `secrets.bin` beside the recordings directory (see [security.md](security.md))
- `calendar.json` (client ids and upload toggles) and `calendar-state.json` (dismiss, notify, arm, linked stop)
- `meta.json` `calendar` field: provider, occurrence, title, times, and invitee names and emails for a recording started from an event

Playback loads audio through the `meetrec://` protocol. The renderer does not read those files itself.
