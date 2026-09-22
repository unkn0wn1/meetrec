# Open decisions

## Resolved (2026-09-22)

### 1. Secrets path — LOCKED

Provider API keys and OAuth refresh tokens live in **Electron main** (OS secret store / safeStorage). Renderer talks **IPC** only. Provider HTTP runs in main.

### 2. UI kit — LOCKED

**shadcn-vue + Tailwind CSS.** Ionic dropped. Nuxt UI not chosen.

### 3. Package manager — LOCKED

**npm.**

### 4. Platform order — LOCKED

**Linux first** (Spencer’s machine). Windows/macOS capture marked experimental until verified.

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

## Still soft / rename anytime

- Project folder name: `/www/meetrec`
- Exact auto-arm clock (T−1 min vs meeting start) — default propose **T−1 minute** when Auto-arm was chosen
