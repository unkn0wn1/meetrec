# OAuth clients for calendar and upload

meetrec does not ship a Google or Microsoft client id. You register a desktop client and paste the id into Settings, or set the environment variable. Nothing on this page belongs in git.

Google Calendar, Microsoft Calendar, and optional Drive / OneDrive upload are in Settings. Register each desktop client, including `drive.file` and `Files.ReadWrite.AppFolder`, before you try upload.

The xAI device-code client id in [providers.md](providers.md) is unrelated. Do not paste it here.

## Google Cloud

1. Open [Google Cloud Console](https://console.cloud.google.com/) and create or pick a project, for example `meetrec`.
2. APIs & Services → Library → enable **Google Calendar API**. Enable **Google Drive API** before you try upload.
3. OAuth consent screen → External → Testing. App name `meetrec`. Add the Google account that will sign in as a test user. Add scopes `calendar.readonly`, `openid`, `email`, and `drive.file`.
4. Credentials → Create credentials → OAuth client ID → application type **Desktop app**. Name `meetrec desktop`.
5. Copy the client id into Settings or `MEETREC_GOOGLE_CLIENT_ID`. Copy the client secret into Settings or `MEETREC_GOOGLE_CLIENT_SECRET`.
6. Do not create a Web client. Do not put the secret in the repo, an issue, or a log.
7. Testing mode: expect to press Connect again about 7 days later, when Google expires the refresh token. This app does not submit the consent screen for verification.

The desktop redirect is `http://127.0.0.1:<port>/callback`. Google’s desktop clients accept that loopback form. If consent returns `redirect_uri_mismatch`, the Google redirect host in the app is changed to `localhost` and the Microsoft-style flow is not added.

Token exchange sends the client secret when one is stored. Google’s Desktop client often has a secret enabled, and exchange without it can return `invalid_request` even when PKCE is correct.

## Microsoft Entra

1. Open [Microsoft Entra admin center](https://entra.microsoft.com/) → App registrations → New registration. Name `meetrec`.
2. Supported accounts: any organizational directory and personal Microsoft accounts (`common`).
3. Authentication → Add a platform → **Mobile and desktop applications**. Custom redirect URI `http://localhost`. Register that even though the app sends `http://localhost:<port>/callback`. Entra ignores the port.
4. Authentication → Allow public client flows: **Yes**. Do not create a client secret. A pasted Microsoft secret is ignored.
5. API permissions → Microsoft Graph delegated: `Calendars.Read`, `User.Read`, `offline_access`, `openid`, `profile`, `email`. Before OneDrive smoke, add `Files.ReadWrite.AppFolder`. Users consent at sign-in. Admin consent is only needed if the tenant blocks user consent.
6. Copy the Application (client) id into Settings or `MEETREC_MICROSOFT_CLIENT_ID`. Do not copy the Directory (tenant) id into the app. Authority stays `https://login.microsoftonline.com/common`.

If the portal rejects an `http://127.0.0.1` reply URL, leave the registration as `http://localhost`. The app uses that host for Microsoft. The listen socket stays on `127.0.0.1`.

## What the app stores

| Value                     | Where                                                    |
| ------------------------- | -------------------------------------------------------- |
| Client id                 | `userData/calendar.json` or the environment variable     |
| Google client secret      | `userData/secrets.bin` or `MEETREC_GOOGLE_CLIENT_SECRET` |
| Refresh and access tokens | `userData/secrets.bin`                                   |
| Upload on or off          | `userData/calendar.json`                                 |

A saved value wins over the environment. The renderer is shown the client id and whether a Google secret is set. It is not shown the secret or the tokens.
