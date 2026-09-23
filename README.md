# meetrec

Desktop app that records your microphone and system audio into one local WAV, then transcribes and summarizes that file on your machine.

It records what you already hear and say. It does not join the call. **0.1.0-alpha.1 is an early alpha, not a production release.**

## Features

- Mix the default microphone and system audio into one playable WAV.
- Library of past recordings, with playback, a transcript, and a summary.
- Voice and AI defaults in Settings: xAI sign-in, an xAI API key, or an OpenAI API key. Transcribe and summary can use different providers.
- Speaker labels you can rename. Summary markdown is saved next to the audio.
- Unsigned Linux AppImage and Windows installers (NSIS and portable).

## Status

| Area                    | Today                                                                                                                                                             |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Linux capture           | Daily path. ffmpeg and Pulse (PipeWire).                                                                                                                          |
| Windows capture         | Experimental. ffmpeg DirectShow, or WASAPI when that demuxer exists. Verify on a Windows machine.                                                                 |
| macOS capture           | Stub. Starting a recording throws.                                                                                                                                |
| Transcript and summary  | Available once the Voice default and the AI default pass a Live check and the machine can reach those APIs.                                                       |
| Google Calendar         | Connect in Settings. A prompt and tray actions appear about 10 minutes before a timed event. Register a desktop client in [oauth clients](docs/oauth-clients.md). |
| Microsoft Calendar      | Same prompt and tray actions via Microsoft Graph. No client secret. See [oauth clients](docs/oauth-clients.md).                                                   |
| Cloud upload            | Decided (Google Drive and the OneDrive app folder). Not in the app yet.                                                                                           |
| Silence auto-stop       | Not built.                                                                                                                                                        |
| Signing and auto-update | Not set up. Installers are unsigned. Linux and Windows builds include ffmpeg.                                                                                     |

## Requirements

- Node.js 22 and npm
- [ffmpeg](https://ffmpeg.org/) on `PATH` for `npm run dev` (`ffmpeg -version`). Installers include it.
- Linux for day-to-day use. Windows capture is experimental until you verify it on that OS.

## Quick start

```bash
npm install
npm run dev
```

The window opens on **Library**. Switch to **Record**, press Start, then Stop. Start creates a folder. Stop writes `audio.wav` and `meta.json`.

Recordings live in Electron's `userData` directory. On Linux that is `~/.config/meetrec`. On Windows it is `%APPDATA%\meetrec`.

```
recordings/<id>/
  audio.wav
  meta.json
  transcript.json    # after Transcribe
  summary.md         # after Generate summary
```

Older flat `*.wav` files in that recordings directory are moved into folders the first time Library scans.

### Linux sandbox

Electron expects `node_modules/electron/dist/chrome-sandbox` to be root-owned and mode `4755`. After `npm install` that is usually not the case, so `npm run dev` passes `--no-sandbox`. That is the right default for local development.

To use the sandbox helper instead:

```bash
sudo chown root:root node_modules/electron/dist/chrome-sandbox
sudo chmod 4755 node_modules/electron/dist/chrome-sandbox
npm run dev:sandboxed
```

Repeat the `chown` and `chmod` after Electron is reinstalled.

## Settings and providers

Open **Settings**. Each provider is its own card. Choose **Default for Voice** and **Default for AI** (they can be the same card). Transcribe stays off until the Voice default passes its Live check. Generate summary stays off until the AI default does.

1. **xAI sign-in** — device code in the browser. The client id `b1a00492-073a-47ea-816f-4c329264a828` is a public device-code client id and has no client secret. Sign out clears the stored tokens.
2. **xAI API key** — password field, then Save or Clear. When Settings has no saved xAI key, the main process can read `XAI_API_KEY` from the environment.
3. **OpenAI** — API key, then Save or Clear. `OPENAI_API_KEY` is the same kind of fallback. Speech uses `gpt-4o-transcribe-diarize`. Summaries use `gpt-4.1-mini`.

Saving a key does not move the Voice or AI default. The radios do. **Test** on a card checks Voice and AI separately.

Use the Settings screen. Optional placeholders are in [`.env.example`](.env.example). Keys and tokens stay in the main process. Electron `safeStorage` encrypts them when the OS allows it. The window never receives them.

## Packaging

```bash
npm run dist:linux
npm run dist:win
```

`dist:linux` writes an AppImage under `dist/`. `dist:win` writes an NSIS installer and a portable exe. Builds are unsigned and include ffmpeg (a pinned BtbN LGPL-static build; about 135 MiB on Linux and 127 MiB on Windows). `npm run dev` still uses ffmpeg on `PATH`. The app id stays `io.techglint.meetrec`.

Public alphas come from a **`v*` tag** (GitHub runners build Linux + Windows and attach files to a Release). Merging to `main` does not publish installers. Details: [docs/packaging.md](docs/packaging.md).

## Contributing

Work on a feature branch and open a pull request. The contributor guide is [CONTRIBUTING.md](CONTRIBUTING.md).

```bash
npm run typecheck
npm run lint:check
npm run format:check
npm run guard:file-size
npm run test
```

GitHub Actions runs those checks on Ubuntu with Node 22 for pull requests and for pushes to `main`. Husky runs the file-size guard, lint-staged, and typecheck before a commit, and unit tests before a push. Direct commits and pushes to `main` are blocked.

## Docs

The handbook is **[docs/README.md](docs/README.md)**. Start there for architecture, capture, providers, security, and packaging. A short install path is [Getting started](docs/getting-started.md).

## Further reading

- [Docs index](docs/README.md)
- [Getting started](docs/getting-started.md)
- [Contributing](CONTRIBUTING.md)
- [Packaging](docs/packaging.md)
- [Security](docs/security.md)
- [Architecture](docs/architecture.md)
