# Providers

## Auth choice (OR — exactly one active)

Settings picks **one** active provider. The choice is stored in `userData/settings.json` (`provider`). Main does not fall across providers.

| Id          | Auth                                                        | STT                  | Summary     |
| ----------- | ----------------------------------------------------------- | -------------------- | ----------- |
| `xai-oauth` | Device-code OAuth (`auth.x.ai`), SuperGrok Heavy / eligible | xAI `/v1/stt`        | Grok chat   |
| `xai-key`   | API key (Settings or env `XAI_API_KEY`)                     | xAI `/v1/stt`        | Grok chat   |
| `openai`    | API key (Settings or env `OPENAI_API_KEY`)                  | OpenAI transcription | OpenAI chat |

Anthropic is **out** (no dedicated STT).

## Models

| Provider | STT                                                                                           | Summary                         |
| -------- | --------------------------------------------------------------------------------------------- | ------------------------------- |
| xAI      | `grok-voice-transcribe-2.0` (`diarize=true`)                                                  | `grok-4.5` chat completions     |
| OpenAI   | `gpt-4o-transcribe-diarize` with `response_format=diarized_json` and `chunking_strategy=auto` | `gpt-4.1-mini` chat completions |

`gpt-4.1-mini` is the stable smaller chat alias (snapshot `gpt-4.1-mini-2025-04-14`). OpenAI STT uses the diarized model so speaker labels stay Speaker 1, Speaker 2, and so on.

## xAI OAuth

Public device-code client (Hermes / Grok Build family). No client secret.

- Issuer / discovery: `https://auth.x.ai` (`.well-known/openid-configuration`)
- Device code: `https://auth.x.ai/oauth2/device/code`
- Token: `https://auth.x.ai/oauth2/token`
- Client ID: `b1a00492-073a-47ea-816f-4c329264a828` (public device-code client id, no secret, safe to commit)
- Scope: `openid profile email offline_access grok-cli:access api:access`
- Device grant: `urn:ietf:params:oauth:grant-type:device_code`
- API base: `https://api.x.ai/v1`

Main stores refresh and access tokens in `userData/secrets.bin` via Electron `safeStorage`. Access tokens refresh 60 seconds before expiry, before STT or chat. IPC returns the user code and verification URL only while a sign-in is in progress. It never returns tokens or API keys.

## Behaviour

- Switching provider clears “validated”. If the new choice already has credentials, main runs the light check immediately. Otherwise Transcribe and Summary stay greyed until save or sign-in.
- Transcribe / Summary stay greyed until the **active** provider has working credentials.
- Secrets and OAuth tokens live in Electron main only. Renderer holds a key only while the password field is being typed.
- A saved key wins over the matching environment variable. The environment is used only for the active provider.
- `settings:get` returns `{ provider, configured, validated, message, xaiKeySource, openaiKeySource, oauthPending, oauthUserCode, verificationUrl, oauthExpiresAt, oauthIntervalSec }`.
