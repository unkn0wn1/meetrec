# Open decisions

## Resolved (2026-09-22)

### 1. Secrets path — LOCKED

Provider API keys and OAuth refresh tokens live in **Electron main** (OS secret store / safeStorage). Renderer talks **IPC** only. Provider HTTP runs in main.

### 2. UI kit — LOCKED

**shadcn-vue + Tailwind CSS.** Ionic dropped. Nuxt UI not chosen.

### 3. Package manager — LOCKED

**npm.**

### 4. Platform order — LOCKED

**Linux first** (daily use). Windows capture is implemented and experimental until someone verifies it on a Windows machine. macOS capture stays a stub until verified; the Record UI and calendar prompt disable Start and show why.

### 5. Artifacts — LOCKED (2026-09-23)

**Local files stay the copy of record.** Optional upload copies artifacts to a `meetrec` folder in Google Drive and to the OneDrive app folder (`Files.ReadWrite.AppFolder`). Both stay off until the user turns them on.

### 6. Calendar / arm UX — LOCKED (2026-09-23)

- System **tray / toolbar** presence while the app runs. Hiding the window keeps calendar polling running.
- **Google Calendar** (readonly) and **Microsoft Calendar** (Graph). Google can be more than one signed-in account (up to five). Each account, and the single Microsoft account, can watch one or more calendars. The primary calendar starts checked. Cancelled, all-day, and declined events are skipped. A second Microsoft account is a follow-up. Drive upload uses the first Google connection whose token includes `drive.file`.
- **~10 minutes before** a timed event (`PROMPT_LEAD_MS`): a prompt and a desktop notification. Actions:
  - **Start recording**
  - **Dismiss**
  - **Auto-arm**
- Auto-arm starts at **T−1 minute** (`AUTO_ARM_LEAD_MS`). A user-facing offset control stays unwired. Inside that last minute, Auto-arm starts immediately.
- A recording started from that event stops at the event end plus **2 minutes** (`CALENDAR_END_GRACE_MS`). Manual Record with no calendar link keeps today’s stop behavior. User Stop or tray Stop cancels that grace.
- The always-on-top Stop popup stays deferred. Tray **Stop recording** stops a calendar-started recording while the main window is hidden.
- Google Calendar and Microsoft Calendar connect, the 10-minute prompt, Auto-arm, and optional Drive / OneDrive upload are in the app.

### 7. Vue version — LOCKED 2026-09-22

- **Vue 3.5.x** only.
- **No Vue 3.6**, **no Vapor Mode**, no alien-signals chase for v1.
- shadcn-vue / Reka on plain VDOM.

### 8. Packaging — LOCKED 2026-09-23

- **electron-builder**. `appId` is `io.techglint.meetrec`. `private: true` stays.
- Windows: NSIS installer and a portable exe, both x64. Linux: AppImage.
- Windows tag releases use electron-builder 26 `win.azureSignOptions` (Azure Trusted Signing), not a PFX. Public values: account `techglint`, profile `meetrec-public`, endpoint `https://eus.codesigning.azure.net/`, publisher `CN=TechGlint, O=TechGlint, L=London, S=Greater London, C=GB`. Credentials stay GitHub Actions secrets. Ad-hoc `package.yml` and local Windows builds stay unsigned. SmartScreen reputation is separate from the signature. Updated 2026-09-24. No auto-update yet.
- Linux and Windows installers ship a pinned BtbN LGPL-static ffmpeg under `resources/ffmpeg/`. `npm run dev` uses ffmpeg on `PATH`. See [packaging.md](packaging.md).

### 9. Calendar / Drive OAuth clients — LOCKED 2026-09-23

- Publisher registers Google Desktop and Microsoft public clients once.
- Client ids (and optional Google client secret) come only from `MEETREC_GOOGLE_CLIENT_ID`, `MEETREC_GOOGLE_CLIENT_SECRET`, `MEETREC_MICROSOFT_CLIENT_ID` at build/env. Settings is Connect / Disconnect only.
- Missing client → “This build has no OAuth client configured”. No end-user paste form.
- See [oauth-clients.md](oauth-clients.md).

### 10. Settings Voice and AI defaults — LOCKED 2026-09-23

- Exactly one Voice default and one AI default. They may be the same provider.
- Providers in this build: xAI sign-in, xAI API key, OpenAI. OpenRouter and Anthropic are not registered.
- Model pickers show the cached catalog from Test. The registry seeds stay `grok-voice-transcribe-2.0`, `grok-4.5`, `gpt-4o-transcribe-diarize`, and `gpt-4.1-mini`.
- A legacy `provider` value in `settings.json` becomes both defaults.

### 11. Calendar tab — LOCKED (2026-09-23)

- Mode nav **Calendar** sits between Record and Settings. It stays disabled until Google or Microsoft calendar is connected. Tooltip: "Connect a calendar in Settings".
- The tab lists timed events for the next **14 days** (`LOOKAHEAD_MS`, up to 100 events) merged from every checked calendar. Each row shows title, time, provider, and the account email when one is known. **Record with meetrec** is checked by default.
- Newly fetched occurrence keys are `google:v2:<account>:<calendar>:<event>:<start>` and `microsoft:v2:<calendar>:<event>:<start>`. Keys already stored in `calendar-state.json` are not rewritten, so an opt-out from an older build does not follow the event. Those keys age out with the existing prune.
- Unchecking an occurrence skips the 10-minute prompt, auto-arm, and tray actions for that occurrence. A repeating event can skip this occurrence or the whole series (Google `recurringEventId`, Microsoft `seriesMasterId`).
- Opt-outs live in `calendar-state.json` as `disabledOccurrences` and `disabledSeries`, separate from one-shot `dismissed`. Upload consent stays in `calendar.json`.

### 12. General preferences and library copies — LOCKED (2026-09-23)

- Settings sections: **General**, **Providers**, **Calendars**.
- **Default destination** in `settings.json`: **Local only**, or Google Drive / OneDrive when that calendar is connected and its upload checkbox and scope are on. Local files stay the copy of record. Auto-upload after save follows that one destination.
- **Enable auto-record for selected meetings** is off by default. Off keeps the 10-minute prompt (Start, Dismiss, Auto-arm). On, while the app is running, meetrec posts a notification about 10 minutes before and starts recording at **T−1 minute**. Opted-out occurrences and series are skipped. Manual Record is unchanged.
- Library rows show a **Drive** and/or **OneDrive** badge when `meta.json` has an upload file id for that provider.

## Still soft / rename anytime

- Silence auto-stop stays unwired. It is not a stop signal.
- Mapping stored invitee names onto diarized speakers stays unwired.
- xAI `GET /v1/models` often omits speech-to-text ids. After a passing Voice probe with a successful (chat-only) catalog, Settings stores the registry Voice seed so the picker is not stuck empty. A rejected catalog request still leaves selects empty (device-code tokens may be rejected by that route).
- macOS system audio is still unimplemented. The phased plan is [mac-system-audio-plan.md](mac-system-audio-plan.md). Platform order stays Linux first. `captureSupported` stays false on darwin until a later change ships mic + system mix.
