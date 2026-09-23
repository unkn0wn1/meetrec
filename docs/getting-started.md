# Getting started

meetrec records microphone and system audio into a local WAV, then can transcribe and summarize it. You need Node.js 22 and npm. Linux is the day-to-day path. Windows capture is experimental until you verify it on that OS.

## ffmpeg

Linux and Windows installers include ffmpeg. You do not install it yourself to run the AppImage or the Windows exe.

`npm run dev` shells out to `ffmpeg` on `PATH`.

```bash
ffmpeg -version
```

Debian or Ubuntu: `sudo apt install ffmpeg`. Fedora: `sudo dnf install ffmpeg`. On Windows, install ffmpeg and open a new terminal so `PATH` includes it. Details and the LGPL build pin are in [packaging.md](packaging.md).

## Run the app

```bash
npm install
npm run dev
```

`npm run dev` starts electron-vite and passes `--no-sandbox`. That is the usual local setup. The sandbox alternative is in the root [README](../README.md).

## Choose Voice and AI defaults in Settings

Open **Settings → Providers** before you transcribe. Each provider has its own card. Pick one **Default for Voice** and one **Default for AI**. They can be the same card.

- **xAI sign-in** (device code in the browser)
- **xAI API key**
- **OpenAI** API key

Save the key, or finish sign-in, and wait until that card shows Live. Transcribe stays off until the Voice default is Live. Generate summary stays off until the AI default is Live.

The xAI sign-in client id `b1a00492-073a-47ea-816f-4c329264a828` is a public device-code client id. It has no client secret. Optional environment fallbacks are listed in [`.env.example`](../.env.example). Prefer Settings.

## Connect a calendar

Open **Settings → Calendars** and press **Connect Google** or **Connect** for Microsoft. The system browser opens. Each Google account is its own card. **Connect another Google account** adds a second login. Check the calendars to watch; the primary calendar starts checked. **Reconnect** or **Disconnect** applies to that card. **Calendar**, between Record and Settings, then lists timed events for the next 14 days from every checked calendar. A row shows the account email when meetrec has one. **Record with meetrec** is checked. Uncheck a row to skip that occurrence, or the whole series when the event repeats.

About 10 minutes before a selected event, meetrec opens a prompt and adds tray actions: **Start recording**, **Dismiss**, and **Auto-arm**. Auto-arm starts the recording one minute before the event. Turn on **Settings → General → Enable auto-record for selected meetings** to replace that prompt with a notification and an automatic start at one minute before. A recording started from that event stops about two minutes after it ends, unless you press Stop.

**General → Default destination** chooses Local only, or Google Drive / OneDrive after that provider’s upload checkbox is on. Library rows show a Drive or OneDrive badge once a copy has an upload id. The local file remains the original.

Publisher OAuth client setup (not an end-user step) is in [oauth-clients.md](oauth-clients.md).

## Make a recording

1. Open **Record**.
2. Press **Start**. Speak, and play meeting audio through the default output.
3. Press **Stop**.

Library shows the new row. Open it for playback. **Transcribe** writes `transcript.json`. **Generate summary** needs a transcript and writes `summary.md`. Rename speakers on the detail header when you want different labels.

Files are stored in Electron's `userData` directory. On Linux:

```
~/.config/meetrec/recordings/<id>/
```

On Windows the same tree is under `%APPDATA%\meetrec\recordings\<id>\`.

## Next

- [Docs index](README.md)
- [Providers](providers.md)
- [Audio capture](audio-capture.md)
- [Packaging](packaging.md)
- [Contributing](../CONTRIBUTING.md)
