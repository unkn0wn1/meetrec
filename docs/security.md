# Security

## Secrets

- Store API keys and OAuth refresh tokens in OS-backed secret storage when practical (`keytar` / safeStorage), not in plain `localStorage`.
- Renderer never receives long-lived provider API keys in cleartext for routine calls.
- Redact secrets in logs.

## Electron hardening

- `contextIsolation: true`
- `nodeIntegration: false`
- Narrow preload API
- CSP appropriate for Electron + Ionic assets

## Google OAuth

- Own Google Cloud OAuth client for this app.
- Start with `calendar.readonly`. Add Drive scopes only when save-to-Drive ships.
- PKCE / loopback redirect suitable for installed apps.

## Consent

- Persistent Recording indicator while capturing.
- Docs/UI copy: user informs other participants.
- No silent background recording without the popup.
