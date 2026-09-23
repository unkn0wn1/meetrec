# Recorder UI

## Shell

- The app opens on **Library** (the list of past recordings).
- Top-level modes: **Library** and **Record**.
- A tray icon is available. Opening the app focuses Library.
- About 10 minutes before a timed Google or Microsoft calendar event, the tray adds **Start: {title}**, **Auto-arm (T−1 min)**, and **Dismiss**. While one is armed, it shows **Armed: {title}** and **Cancel auto-arm**. While recording, it shows **Stop recording**.
- The same Start, Dismiss, and Auto-arm actions appear in a small always-on-top prompt window (`#/calendar-prompt`). Auto-arm’s label says it starts one minute before. That route is not in the mode nav.

## Library

- Rows show title or date, duration, and whether Transcript and Summary are missing or ready. A recording started from a calendar event uses the event title.
- Click a row to open **Recording detail** in the same window.

## Recording detail

**Header (always visible):**

- Title and started-at
- Duration (from the file or `meta.json`)
- Speakers: count plus editable names (empty until diarization or you type them)
- Topic: filled after the summary; placeholder before

**Left rail:**

1. **Playback** — play, pause, stop, and progress
2. **Transcript** — full text, or a **Transcribe** button when it is missing
3. **Summary** — minutes and action items, or **Generate summary** when it is missing (requires a transcript)

Order of work: record, optionally rename speakers, transcribe, then summarize. **Upload to Google Drive** and **Upload to OneDrive** copy the files that exist. They stay disabled until that provider's upload consent is granted in Settings. When the matching upload checkbox is on, meetrec also uploads after Stop, after Transcribe, and after Generate summary.

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
