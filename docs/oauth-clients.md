# OAuth clients (publisher setup)

End users only press **Connect** / **Disconnect** in Settings. They never paste a client id or secret.

Spencer registers the Google and Microsoft desktop clients once. CI/release (and local `.env`) inject the values into the main process at build time. Do not commit real ids or the Google client secret. `.env` is gitignored.

The xAI device-code client id in [providers.md](providers.md) is unrelated.

## Env vars

| Variable                       | Required                          | Notes                                                                                                       |
| ------------------------------ | --------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `MEETREC_GOOGLE_CLIENT_ID`     | For Google Calendar / Drive       | Desktop OAuth client id                                                                                     |
| `MEETREC_GOOGLE_CLIENT_SECRET` | Optional                          | Send on token exchange when Google needs it. Prefer a PKCE public client with no secret when Google allows. |
| `MEETREC_MICROSOFT_CLIENT_ID`  | For Microsoft Calendar / OneDrive | Public client. No secret.                                                                                   |

If a required id is unset, Connect shows: **This build has no OAuth client configured**.

Local: copy [`.env.example`](../.env.example) to `.env`. Release: set the same names as GitHub Actions secrets; `release.yml` / `package.yml` pass them into `electron-vite` `define`.

## Google Cloud

1. [Google Cloud Console](https://console.cloud.google.com/) → project (e.g. `meetrec`).
2. Enable **Google Calendar API**. Enable **Google Drive API** before upload smoke.
3. OAuth consent screen → External → Testing. App name `meetrec`. Add test users. Scopes: `calendar.readonly`, `openid`, `email`, `drive.file`.
4. Credentials → OAuth client ID → **Desktop app**. Name `meetrec desktop`.
5. Put the client id (and secret if present) in CI secrets / `.env`. Do not create a Web client. Do not put the secret in git, an issue, or a log.
6. Testing mode: Google may expire the refresh token about every 7 days until the consent screen is verified.

Redirect used by the app: `http://127.0.0.1:<port>/callback`.

## Microsoft Entra

1. [Microsoft Entra admin center](https://entra.microsoft.com/) → App registrations → New registration. Name `meetrec`.
2. Supported accounts: any org directory and personal Microsoft accounts (`common`).
3. Authentication → **Mobile and desktop applications**. Custom redirect URI `http://localhost`. Entra ignores the port; the app still uses `http://localhost:<port>/callback`.
4. Allow public client flows: **Yes**. Do not create a client secret.
5. API permissions → Microsoft Graph delegated: `Calendars.Read`, `User.Read`, `offline_access`, `openid`, `profile`, `email`, and `Files.ReadWrite.AppFolder` before OneDrive smoke.
6. Put the Application (client) id in CI secrets / `.env`. Do not store the Directory (tenant) id. Authority stays `https://login.microsoftonline.com/common`.

## What the app stores

| Value                                   | Where                                                                                                                         |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Publisher client ids                    | Build-time env (not in Settings UI)                                                                                           |
| Google client secret                    | Build-time env when set                                                                                                       |
| Refresh and access tokens               | `userData/secrets.bin` (`googleConnections` for each Google account, `microsoftConnections` for up to two Microsoft accounts) |
| Upload on or off, selected calendar ids | `userData/calendar.json`                                                                                                      |

`calendar.readonly` covers `calendarList.list`. Google Calendar connect can be repeated for another Google account (up to five). Drive consent stays on the account that grants `drive.file`; upload uses the first such account. Microsoft Calendar connect can be repeated for a second account. OneDrive consent stays on the account that grants `Files.ReadWrite.AppFolder`; upload uses the first such account.

Legacy pasted client ids in old `calendar.json` / `secrets.bin` are ignored.
