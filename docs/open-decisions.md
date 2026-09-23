# Open decisions

## Resolved (2026-09-22)

### 1. Secrets path — LOCKED

Provider API keys and OAuth refresh tokens live in **Electron main** (OS secret store / safeStorage). Renderer talks **IPC** only. Provider HTTP runs in main.

### 2. UI kit — LOCKED

**shadcn-vue + Tailwind CSS.** Ionic dropped. Nuxt UI not chosen.

### 3. Package manager — LOCKED

**npm.**

### 4. Platform order — LOCKED

**Linux first** (daily use). Windows capture is implemented and experimental until someone verifies it on a Windows machine. macOS capture stays a stub until verified.

### 5. Artifacts — LOCKED (2026-09-23)

**Local files stay the copy of record.** Optional upload is in scope: a `meetrec` folder in Google Drive, and the OneDrive app folder (`Files.ReadWrite.AppFolder`). Upload is off until the user turns it on. The control ships with the upload work; it is not in the app yet.

### 6. Calendar / arm UX — LOCKED (2026-09-23)

- System **tray / toolbar** presence while the app runs. Hiding the window keeps calendar polling running.
- **Google Calendar** (readonly) and **Microsoft Calendar** (Graph) on the primary calendar. Cancelled, all-day, and declined events are skipped.
- **~10 minutes before** a timed event (`PROMPT_LEAD_MS`): a prompt and a desktop notification. Actions:
  - **Start recording**
  - **Dismiss**
  - **Auto-arm**
- Auto-arm starts at **T−1 minute** (`AUTO_ARM_LEAD_MS`). A user-facing offset control stays unwired. Inside that last minute, Auto-arm starts immediately.
- A recording started from that event stops at the event end plus **2 minutes** (`CALENDAR_END_GRACE_MS`). Manual Record with no calendar link keeps today’s stop behavior. User Stop or tray Stop cancels that grace.
- The always-on-top Stop popup stays deferred. Tray **Stop recording** stops a calendar-started recording while the main window is hidden.
- Google Calendar connect, the 10-minute prompt, and Auto-arm are in the app. Microsoft Calendar is not yet.

### 7. Vue version — LOCKED 2026-09-22

- **Vue 3.5.x** only.
- **No Vue 3.6**, **no Vapor Mode**, no alien-signals chase for v1.
- shadcn-vue / Reka on plain VDOM.

### 8. Packaging — LOCKED 2026-09-23

- **electron-builder**. `appId` is `io.techglint.meetrec`. `private: true` stays.
- Windows: NSIS installer and a portable exe, both x64. Linux: AppImage.
- Unsigned. Authenticode later via `CSC_LINK` and `CSC_KEY_PASSWORD` (`WIN_CSC_LINK` is the Windows alias). No auto-update yet.
- Linux and Windows installers ship a pinned BtbN LGPL-static ffmpeg under `resources/ffmpeg/`. `npm run dev` uses ffmpeg on `PATH`. See [packaging.md](packaging.md).

### 9. Settings Voice and AI defaults — LOCKED 2026-09-23

- Exactly one Voice default and one AI default. They may be the same provider.
- Providers in this build: xAI sign-in, xAI API key, OpenAI. OpenRouter and Anthropic are not registered.
- Model pickers show the cached catalog from Test. The registry seeds stay `grok-voice-transcribe-2.0`, `grok-4.5`, `gpt-4o-transcribe-diarize`, and `gpt-4.1-mini`.
- A legacy `provider` value in `settings.json` becomes both defaults.

## Still soft / rename anytime

- Silence auto-stop stays unwired. It is not a stop signal.
- Mapping stored invitee names onto diarized speakers stays unwired.
- xAI `GET /v1/models` may omit speech-to-text ids (`grok-voice-transcribe-1.0`, `grok-voice-transcribe-2.0`). Device-code access tokens may be rejected by that route. Meetrec does not invent a list until a live Test shows otherwise.
