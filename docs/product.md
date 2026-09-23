# Product

## Problem

Meeting bots that join calls are visible, often blocked, and tied to one conferencing vendor. We want a **desktop** tool that records what the user already hears and says, without joining the meeting.

## Primary user

The person running the app on their own computer. They are responsible for telling other participants that recording is happening.

## What 0.1 does

Manual Record, a local folder, Library, Transcribe, and Generate summary. Settings has one Voice default and one AI default. Calendar connect, the pre-meeting prompt, and optional Drive / OneDrive upload are decided and land in follow-up PRs. They are not in the app yet. Silence auto-stop stays out.

## Happy path

1. Google Calendar or Microsoft Calendar OAuth → upcoming timed events on the primary calendar.
2. App lives in the **system tray**. Hiding the window does not stop calendar polling.
3. **~10 minutes before** a timed event: notification and prompt with **Start recording**, **Dismiss**, or **Auto-arm**. The soonest event owns the prompt.
4. If Auto-arm was chosen, recording starts at **T−1 minute** (`AUTO_ARM_LEAD_MS`). Inside that last minute it starts immediately.
5. While recording, tray **Stop recording** ends the capture when the main window is hidden. The always-on-top Stop popup stays deferred.
6. Capture mic + system audio → one mixed **local** file.
7. Stop on user Stop, or — only for a recording started from that event — at the event end plus 2 minutes. A manual Record with no calendar link keeps today’s stop behavior.
8. Transcribe (default: xAI Grok Voice Transcribe 2.0, diarization on).
9. Show voice count; user names speakers if needed. Invitee names and emails are stored on `meta.json` for a later speaker map. This does not rename diarized speakers.
10. Generate minutes via selected LLM provider → save **locally** next to the audio. Optional upload can copy artifacts to Drive or the OneDrive app folder after that. It is off by default.

## Non-goals (v1)

- Being a visible meeting bot.
- Perfect goodbye / silence detection as the only stop signal. Silence auto-stop stays unwired.
- Equal Windows/macOS polish on day one (Linux first).
- Replacing local files with cloud storage. Optional Google Drive upload (folder `meetrec`) and OneDrive app-folder upload ship with the upload PR. Both stay off until the user enables them.
- Mac App Store polish.
- The always-on-top Stop popup. Tray Stop covers a hidden window.
- Browser-extension-only capture for Zoom/Teams **desktop** clients.
- Multi-tenant SaaS backend.

## Consent model

The recording user informs others. The UI must show a clear Recording indicator while active.
