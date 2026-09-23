# Security

## Secrets

- Store API keys and xAI OAuth refresh and access tokens with Electron `safeStorage` in `userData/secrets.bin`. If OS encryption is unavailable, the same file holds a marked plaintext fallback and main logs a warning. Still never `localStorage`.
- The active provider id lives in `userData/settings.json`. It is not a secret.
- The renderer never receives long-lived provider API keys or OAuth tokens. Settings IPC returns the provider id, whether credentials exist, validation, and — only during device sign-in — the user code and verification URL.
- Redact secrets in logs.

## xAI device-code client

xAI sign-in uses the public device-code client id `b1a00492-073a-47ea-816f-4c329264a828`. There is no client secret, and the id is safe to commit. Refresh tokens and access tokens are still secrets. They live in `secrets.bin`, not in git. See [providers.md](providers.md).

## Electron hardening

- `contextIsolation: true`
- `nodeIntegration: false`
- Narrow preload API (`window.meetrec`)
- Local renderer only. Do not load remote scripts.

## Google OAuth

Not implemented. When calendar ships, use an OAuth client owned by this app, start with `calendar.readonly`, and add Drive scopes only if save-to-Drive is built. An installed app should use PKCE or a loopback redirect.

## Consent

- A Recording indicator stays visible while capture is active.
- The person running the app tells other participants.
- There is no silent background recording.

## Reporting a vulnerability

Open a [GitHub issue](https://github.com/unkn0wn1/meetrec/issues). Leave out live API keys, refresh tokens, and recordings. The root [SECURITY.md](../SECURITY.md) points here.
