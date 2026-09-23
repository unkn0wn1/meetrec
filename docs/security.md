# Security

## Secrets

- Store API keys and xAI OAuth refresh and access tokens with Electron `safeStorage` in `userData/secrets.bin`. If OS encryption is unavailable, the same file holds a marked plaintext fallback and main logs a warning. Still never `localStorage`.
- `userData/settings.json` holds the Voice default, the AI default, each provider’s selected model ids, and the cached model id lists from Test (`modelCache`). Those are not secrets.
- The renderer never receives long-lived provider API keys or OAuth tokens. Settings IPC returns provider ids, model ids, whether credentials exist, Live and Test results, and — only during device sign-in — the user code and verification URL. Credential checks, role probes, and model listing run in the main process. A failed model list does not return the response body.
- Redact secrets in logs.

## xAI device-code client

xAI sign-in uses the public device-code client id `b1a00492-073a-47ea-816f-4c329264a828`. There is no client secret, and the id is safe to commit. Refresh tokens and access tokens are still secrets. They live in `secrets.bin`, not in git. See [providers.md](providers.md).

## Electron hardening

- `contextIsolation: true`
- `nodeIntegration: false`
- Narrow preload API (`window.meetrec`)
- Local renderer only. Do not load remote scripts.

## Calendar OAuth (Google and Microsoft)

Google Calendar, Microsoft Calendar, and the separate Drive / OneDrive consent use this flow. It is separate from the xAI device-code client. Do not reuse that client id.

Desktop public client: authorization code + PKCE (S256) + loopback. The system browser opens the provider page. That page never loads inside Electron. `state` must match. A mismatch stores nothing.

| Provider  | Redirect                                                         | Token host                                 |
| --------- | ---------------------------------------------------------------- | ------------------------------------------ |
| Google    | `http://127.0.0.1:<port>/callback`                               | `https://oauth2.googleapis.com/token`      |
| Microsoft | `http://localhost:<port>/callback` (socket stays on `127.0.0.1`) | `https://login.microsoftonline.com/common` |

Microsoft authority stays `common`. The tenant id is not stored. Registering the app is in [oauth-clients.md](oauth-clients.md).

Calendar connect scopes:

- Google: `openid`, `email`, `https://www.googleapis.com/auth/calendar.readonly`
- Microsoft: `openid`, `profile`, `email`, `offline_access`, `User.Read`, `Calendars.Read`

Upload is a second consent. It adds `https://www.googleapis.com/auth/drive.file` or `Files.ReadWrite.AppFolder`. It does not request full Drive or `Files.ReadWrite.All`.

Where secrets live:

- `userData/secrets.bin` (safeStorage): Google client secret, Google refresh and access tokens, Microsoft refresh and access tokens.
- `userData/calendar.json` (not a secret): Google and Microsoft client ids, upload toggles.
- Environment fallbacks, only when nothing is saved: `MEETREC_GOOGLE_CLIENT_ID`, `MEETREC_GOOGLE_CLIENT_SECRET`, `MEETREC_MICROSOFT_CLIENT_ID`. Microsoft has no client secret.

The renderer never receives tokens or the Google client secret. Status IPC returns the client id, whether a secret is set, the account email, and connect errors. Token responses are redacted before they reach logs or thrown errors (`access_token`, `refresh_token`, `id_token`, `code`, `client_secret`).

While Google’s consent screen is in Testing, refresh tokens expire after about 7 days. This app does not submit that screen for verification.

## Consent

- A Recording indicator stays visible while capture is active.
- The person running the app tells other participants.
- There is no silent background recording.

## Reporting a vulnerability

Open a [GitHub issue](https://github.com/unkn0wn1/meetrec/issues). Leave out live API keys, refresh tokens, and recordings. The root [SECURITY.md](../SECURITY.md) points here.
