# Product

## Problem

Meeting bots that join calls are visible, often blocked, and tied to one conferencing vendor. We want a **desktop** tool that records what the user already hears and says, without joining the meeting.

## Primary user

The person running the app on their own computer. They are responsible for telling other participants that recording is happening.

## What 0.1 does

Manual Record, a local folder, Library (including permanent delete with confirm), Transcribe, and Generate summary. Settings has General, Providers, and Calendars. One Voice default and one AI default. The Calendar tab lists the next 14 days and can opt out of a meeting or a series. Google Calendar or Microsoft Calendar can prompt before a timed event, or auto-record selected meetings when that General switch is on. Optional upload can copy the audio, transcript, and summary to a `meetrec` folder in Google Drive or to the OneDrive app folder. Auto-upload follows the General destination and stays off until that provider’s upload checkbox is on. Delete confirm can also trash those Drive files and recycle those OneDrive items. The checkbox starts off, and the local folder stays if a cloud delete fails. Optional silence auto-stop stays off until Settings → General turns it on. Meeting search stays off until Settings → General turns it on and the person confirms the model download. A hit opens the recording at that point in the transcript. Calendar auto-record at T−1 minute is the shipped auto-start. Starting when audio resumes stays deferred.

## Happy path

1. Google Calendar or Microsoft Calendar Connect (publisher-bundled OAuth) → the Calendar tab lists timed events for the next 14 days. Connect another Google account, or a second Microsoft account, when a meeting lives on another login, and check the calendars to watch. **Record with meetrec** is on unless you opt out of an occurrence or a series.
2. App lives in the **system tray**. Hiding the window does not stop calendar polling.
3. **~10 minutes before** a selected timed event: notification and prompt with **Start recording**, **Dismiss**, or **Auto-arm**. The soonest event owns the prompt. If **Enable auto-record for selected meetings** is on, this step is a notification only ("recording will start 1 minute before") and the prompt window stays closed.
4. If Auto-arm was chosen, or auto-record is on, recording starts at **T−1 minute** (`AUTO_ARM_LEAD_MS`). Inside that last minute it starts immediately. Opted-out events do not start.
5. While recording, tray **Stop recording** ends the capture when the main window is hidden. The always-on-top Stop popup stays deferred.
6. Capture mic + system audio → one mixed **local** file.
7. Stop on user Stop, tray Stop, or — only for a recording started from that event — at the event end plus 2 minutes. When **Stop recording after sustained silence** is on, near-silence for the chosen threshold also stops that recording. Manual Stop still works. A manual Record with no calendar link has no calendar grace stop.
8. Transcribe (default: xAI Grok Voice Transcribe 2.0, diarization on).
9. Show voice count; user names speakers if needed. For a calendar-linked recording, each diarized speaker can be filled from an invitee, then saved onto that speaker. Invitees do not become speakers before diarization.
10. Generate minutes via selected LLM provider → save **locally** next to the audio. Optional upload can copy artifacts to Drive or the OneDrive app folder after that. It is off by default.

## Non-goals (v1)

- Being a visible meeting bot.
- Perfect goodbye detection as the only stop signal. Silence auto-stop is an optional extra and stays off until Settings turns it on. Starting a recording when audio resumes (an idle microphone watch) stays deferred.
- Equal Windows/macOS polish on day one (Linux first).
- Replacing local files with cloud storage. Optional Google Drive upload (folder `meetrec`) and OneDrive app-folder upload ship with the upload PR. Both stay off until the user enables them.
- Mac App Store polish.
- The always-on-top Stop popup. Tray Stop covers a hidden window.
- Browser-extension-only capture for Zoom/Teams **desktop** clients.
- Multi-tenant SaaS backend.
- Meeting search as a cloud service. MeetRec does not upload transcripts to build the index.

## Consent model

The recording user informs others. The UI must show a clear Recording indicator while active.
