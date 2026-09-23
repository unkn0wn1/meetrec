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

### 5. Artifacts — LOCKED (v1)

**Local files only.** No Google Drive upload in v1.

### 6. Calendar / arm UX — LOCKED

- System **tray / toolbar** presence while the app runs.
- **~10 minutes before** a calendar meeting: desktop notification with actions:
  - **Start recording**
  - **Dismiss**
  - **Auto-arm** (start automatically at T−1 minute or at meeting start — exact offset configurable later)
- While recording: always-on-top Stop popup (see product.md).

### 7. Vue version — LOCKED 2026-09-22

- **Vue 3.5.x** only.
- **No Vue 3.6**, **no Vapor Mode**, no alien-signals chase for v1.
- shadcn-vue / Reka on plain VDOM.

### 8. Packaging — LOCKED 2026-09-23

- **electron-builder**. `appId` is `io.techglint.meetrec`. `private: true` stays.
- Windows: NSIS installer and a portable exe, both x64. Linux: AppImage.
- Unsigned. Authenticode later via `CSC_LINK` and `CSC_KEY_PASSWORD` (`WIN_CSC_LINK` is the Windows alias). No auto-update yet.
- Linux and Windows installers ship a pinned BtbN LGPL-static ffmpeg under `resources/ffmpeg/`. `npm run dev` uses ffmpeg on `PATH`. See [packaging.md](packaging.md).

## Still soft / rename anytime

- Exact auto-arm clock (T−1 min vs meeting start) — default proposal is **T−1 minute** when Auto-arm was chosen. Calendar arm is not built yet.
