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

## Choose a provider in Settings

Open **Settings** before you transcribe. Pick one:

- **xAI sign-in** (device code in the browser)
- **xAI API key**
- **OpenAI** API key

Save the key, or finish sign-in, and wait until the check succeeds. Transcribe and Generate summary stay disabled until then.

The xAI sign-in client id `b1a00492-073a-47ea-816f-4c329264a828` is a public device-code client id. It has no client secret. Optional environment fallbacks are listed in [`.env.example`](../.env.example). Prefer Settings.

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
