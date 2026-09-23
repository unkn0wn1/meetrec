# Recorder UI

## Shell

- The app opens on **Library** (the list of past recordings).
- Top-level modes: **Library** and **Record**.
- A tray icon is available. Opening the app focuses Library.

## Library

- Rows show title or date, duration, and whether Transcript and Summary are missing or ready.
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

Order of work: record, optionally rename speakers, transcribe, then summarize.

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

Exactly one active provider (see [providers.md](providers.md)):

- **xAI sign-in** or **xAI API key** — speech: xAI Voice Transcribe 2.0 (`diarize=true`). Summary: Grok chat.
- **OpenAI API key** — speech: `gpt-4o-transcribe-diarize`. Summary: `gpt-4.1-mini`.

Keys and OAuth tokens come from Settings (`safeStorage` in userData). `XAI_API_KEY` and `OPENAI_API_KEY` apply only to the matching active choice, and only when Settings has no saved key. The renderer never holds them.
