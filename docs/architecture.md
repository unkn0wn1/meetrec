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
- **Main:** window and tray, start and stop capture, library files, settings and secrets, speech-to-text and summary HTTP (STT upload is mono 16 kHz MP3 from the WAV), Google and Microsoft calendar polls, the pre-meeting prompt, and optional Drive / OneDrive upload.
- **Library job progress:** transcribe and summarize push `library:job-progress` to the calling window (`id`, `job`, `stage`, `startedAt`). `stage: null` clears the row. The renderer shows the stage label and elapsed time. There is no percent.
- **Capture backends:** one interface, three implementations selected by `process.platform`. The macOS implementation rejects; `RecordingStatus.captureSupported` is false so the UI disables Start.

## Domains (keep separate)

| Domain       | Owns                                                                                      |
| ------------ | ----------------------------------------------------------------------------------------- |
| `recording`  | Folder layout, library scan, permanent local delete, manual start/stop                    |
| `capture`    | OS audio backends only                                                                    |
| `transcript` | STT document, diarization labels, speaker rename                                          |
| `minutes`    | Summary prompt and `summary.md`                                                           |
| `providers`  | xAI and OpenAI speech and chat (no UI widgets)                                            |
| `settings`   | Voice default, AI default, secret bag, device-code session                                |
| `calendar`   | OAuth, 14-day poll of selected calendars, opt-out, prompt or auto-record, arm, grace stop |
| `cloud`      | Optional upload, and optional trash or recycle of those stored file ids                   |

One domain, one folder. Cross-domain calls go through small facades or IPC handlers.

## Data artifacts (local)

One folder per recording (see [recorder-ui.md](recorder-ui.md)), under Electron `userData`:

- `recordings/<id>/audio.wav`
- `recordings/<id>/meta.json`
- `recordings/<id>/transcript.json`
- `recordings/<id>/summary.md`
- `settings.json` and `secrets.bin` beside the recordings directory (see [security.md](security.md)). `settings.json` also stores the default destination and the auto-record switch.
- `calendar.json` (upload toggles and selected calendar ids) and `calendar-state.json` (dismiss, notify, occurrence and series opt-out, arm, linked stop). `secrets.bin` stores one Microsoft token and a list of Google connections (`googleConnections`). A file that still has a single `googleOAuth` token is read as one connection.
- Occurrence keys for newly fetched events include the account and calendar (`google:v2:…` or `microsoft:v2:…`). Older keys in `calendar-state.json` are left as they are and will not match those events. The existing time prune drops them once the event is in the past.
- `meta.json` `calendar` field: provider, occurrence, title, times, and invitee names and emails for a recording started from an event. Optional `uploads` records Drive file ids and OneDrive item ids. When delete confirm includes cloud copies, those file ids are trashed on Drive or recycled on OneDrive before the local folder is removed. A failed cloud delete leaves the folder in place.

Playback loads audio through the `meetrec://` protocol. The renderer does not read those files itself.
