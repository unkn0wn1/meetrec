# Recorder UI

## Shell

- The app opens on **Library** (the list of past recordings).
- Top-level modes: **Library**, **Record**, **Calendar**, and **Settings**. Calendar stays disabled until Google or Microsoft calendar is connected. The tooltip is "Connect a calendar in Settings".
- Library, Record, Calendar, Settings, and Recording detail share one centered column, `max-w-3xl` (48rem), with horizontal padding `px-6`, through `AppShell`.
- Record’s timer and Start / Stop stay in a left-aligned `max-w-md` block under that header. The header still spans the shell.
  On macOS, Start stays disabled and the panel shows that capture is not available in this build (Linux / Windows only until ScreenCaptureKit ships). The calendar prompt disables Start recording and Auto-arm the same way.
- The main window opens at 960×720. Navigation does not resize it. There is no minimum width; below 48rem the column shrinks with the window.
- The calendar prompt (`#/calendar-prompt`, 420×400) is not in this shell. It also does not show the update banner. When a calendar start records microphone only, that window stays open and shows the capture note. Close does not stop the recording. A manual Record start does not open the prompt; the Record tab shows the note there.
- When an update is ready, AppShell shows a banner above the page. During a recording the banner says to restart after recording and does not offer quit. While idle it offers Restart and install.
- **Calendar** (`#/calendar`) lists timed events for the next 14 days from every checked Google or Microsoft calendar. Each row shows title, time, provider, the account email when meetrec has one, and **Record with meetrec** (on by default). Unchecking a repeating event asks for this occurrence or the entire series.
- The AppShell header shows the mic-on-gradient tile plus a Meet**Rec** wordmark (Rec uses the marketing cyan→violet→pink gradient).
- Theme is always dark: ink-800 page shell (`#111527`), glass panels (`rounded-2xl border-white/10 bg-white/[0.03] backdrop-blur-xl` via `.glass`), solid cyan primary buttons (no purple), cyan-tinted accent/hover, white/10 borders — aligned with [meetrec.dev](https://meetrec.dev). Tokens and `.glass` live in `src/styles/globals.css`. Prefer `bg-background`, `text-muted-foreground`, `.glass`, etc. over one-off hex. Wordmark Rec may keep cyan→violet→pink; buttons must not.
- A tray icon is available (same gradient tile, filled mic for 16×16 readability). Opening the app focuses Library.
- About 10 minutes before a timed event that is still set to record, the tray adds **Start: {title}**, **Auto-arm (T−1 min)**, and **Dismiss**. While one is armed, it shows **Armed: {title}** and **Cancel auto-arm**. While recording, it shows **Stop recording**.
- The same Start, Dismiss, and Auto-arm actions appear in a small always-on-top prompt window (`#/calendar-prompt`). Auto-arm’s label says it starts one minute before. That route is not in the mode nav.
- **General → Enable auto-record for selected meetings** replaces that prompt with a notification ("recording will start 1 minute before") and starts the recording at T−1. Opted-out events stay quiet. If that start is microphone only, the prompt opens with the capture note.

## Library

- Rows show title or date, duration, and whether Transcript and Summary are missing or ready. A **Drive** or **OneDrive** badge appears when that recording’s `meta.json` has an upload file id. Local files stay the copy of record. A recording started from a calendar event uses the event title.
- Click a row to open **Recording detail** in the same window.

## Recording detail

**Header (always visible):**

- Title and started-at
- Duration (from the file or `meta.json`)
- Speakers: count plus editable names (empty until diarization or you type them). A calendar-linked meeting also lists its invitees; choosing one fills that speaker’s name, and Save writes it.
- Topic: filled after the summary; placeholder before
- Capture: "Mic + system audio" or "Microphone only". A microphone-only take keeps its note here after Stop.

**Delete:**

- Detail view and each library row confirm before anything is removed. The checkbox **Also remove uploaded Drive / OneDrive copies** starts off.
- Unchecked, delete removes the local `recordings/<id>/` folder (audio, transcript, summary, meta) and leaves uploaded copies. Checked, meetrec trashes the stored Drive file ids and recycles the stored OneDrive item ids first. If that fails, the local folder stays and the error names what failed. An in-progress recording cannot be deleted until Stop. There is no local recycle bin.

**Left rail:**

1. **Playback** — play, pause, stop, and a scrubber. The clocks follow the playhead while playing and while dragging. Dragging the scrubber seeks without starting playback. A transcript bubble switches to this pane, seeks to that segment’s start, and plays.
2. **Transcript** — one bubble per segment (speaker name and timestamp). Full text sits under a collapsed **Full text** disclosure. A missing transcript shows **Transcribe**.
3. **Summary** — minutes and action items, or **Generate summary** when it is missing (requires a transcript)

While Transcribe or Generate summary runs, the detail view shows a spinner, the current stage, and elapsed time (`mm:ss`). The button stays disabled. The row clears when the call finishes or fails. The error line is unchanged.

Order of work: record, optionally rename speakers, transcribe, then summarize. **Upload to Google Drive** and **Upload to OneDrive** copy the files that exist. They stay disabled until that provider's upload consent is granted under **Settings → Calendars**. Auto-upload after Stop, Transcribe, and Generate summary follows **Settings → General → Default destination**, and only if that provider’s upload checkbox and scope are on.

## Settings

Left rail: **General**, **Providers**, **Calendars**.

- **General** shows the app version, Check for updates, an update status line, and Restart and install when an update is ready and recording is idle. A shell banner stays up while a recording is in progress and an update is ready. General also shows the default destination (local, or an enabled Drive / OneDrive), auto-record for selected meetings, and **Stop recording after sustained silence** (off by default). The **Silence threshold** in seconds stays disabled until that box is on.
- **Providers** is the Voice and AI cards.
- **Calendars** is Connect / Disconnect and the upload checkboxes.

## Per-recording folder

Under Electron `userData` (on Linux, `~/.config/meetrec`):

```
recordings/<id>/
  meta.json          # id, startedAt, endedAt, durationMs, speakers[], topic?, paths
  audio.wav          # mixed capture
  transcript.json    # STT result and diarization segments
  summary.md         # minutes and actions
```

Older flat `*.wav` files are moved into folders on the first library scan when that is possible.

## Providers (main process only)

One Voice default and one AI default (see [providers.md](providers.md)):

- **Transcribe** uses the Voice default and its speech model, after that card’s Live check.
- **Generate summary** uses the AI default and its chat model, after that card’s Live check.
- **xAI sign-in** or **xAI API key** — before a catalog is stored, speech uses xAI Voice Transcribe 2.0 (`diarize=true`) and summary uses Grok chat. Settings pickers fill after Test (see [providers.md](providers.md)).
- **OpenAI API key** — before a catalog is stored, speech uses `gpt-4o-transcribe-diarize` and summary uses `gpt-4.1-mini`.

Keys and OAuth tokens come from Settings (`safeStorage` in userData). `XAI_API_KEY` and `OPENAI_API_KEY` apply to that provider when Settings has no saved key. The renderer never holds them.
