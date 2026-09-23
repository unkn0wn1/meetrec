# Product

## Problem

Meeting bots that join calls are visible, often blocked, and tied to one conferencing vendor. We want a **desktop** tool that records what the user already hears and says, without joining the meeting.

## Primary user

The person running the app on their own computer. They are responsible for telling other participants that recording is happening.

## What 0.1 does

Manual Record, a local folder, Library, Transcribe, and Generate summary, with one provider chosen in Settings. The calendar notification, silence auto-stop, and cloud upload in the loop below are not built yet.

## Happy path

1. Google Calendar OAuth → upcoming events.
2. App lives in the **system tray**.
3. **~10 minutes before** a meeting: notification with **Start recording**, **Dismiss**, or **Auto-arm**.
4. If Auto-arm was chosen, recording starts near meeting time (default proposal: **T−1 minute**).
5. While recording: small always-on-top popup with **Stop**.
6. Capture mic + system audio → one mixed **local** file.
7. Stop on: user Stop, calendar end + grace, or long near-silence (heuristic only).
8. Transcribe (default: xAI Grok Voice Transcribe 2.0, diarization on).
9. Show voice count; user names speakers if needed (map to calendar invitees when possible).
10. Generate minutes via selected LLM provider → save **locally** next to the audio.

## Non-goals (v1)

- Being a visible meeting bot.
- Perfect goodbye / silence detection as the only stop signal.
- Equal Windows/macOS polish on day one (Linux first).
- Google Drive (or other cloud) upload.
- Mac App Store polish.
- Browser-extension-only capture for Zoom/Teams **desktop** clients.
- Multi-tenant SaaS backend.

## Consent model

The recording user informs others. The UI must show a clear Recording indicator while active.
