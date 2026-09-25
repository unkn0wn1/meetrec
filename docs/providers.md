# Providers

## Voice and AI defaults

Settings stores **one Voice default** and **one AI default**. They can be the same provider or two different ones. The choice lives in `userData/settings.json` (`voiceProviderId`, `aiProviderId`, and a `models` map). Main does not fall across providers. Transcribe uses the Voice default and its speech model. Generate summary uses the AI default and its chat model.

An older file that only has `provider` is rewritten the first time Settings loads. Both defaults become that id. A missing or unknown id becomes `xai-key`. With no cached catalog, a model id outside the seed list is replaced with that provider’s seed for the role. With a catalog, the current id stays when it is still listed; otherwise the first seed that appears in the list; otherwise the first listed id.

| Id          | Auth                                                        | STT                  | Summary     |
| ----------- | ----------------------------------------------------------- | -------------------- | ----------- |
| `xai-oauth` | Device-code OAuth (`auth.x.ai`), SuperGrok Heavy / eligible | xAI `/v1/stt`        | Grok chat   |
| `xai-key`   | API key (Settings or env `XAI_API_KEY`)                     | xAI `/v1/stt`        | Grok chat   |
| `openai`    | API key (Settings or env `OPENAI_API_KEY`)                  | OpenAI transcription | OpenAI chat |

OpenRouter and Anthropic are not registered. A later provider is a new id, a registry row (roles, models, credential form), a token resolver, and a family adapter.

## Models

Each card stores its own Voice model and AI model. The picker shows the last catalog from **Test** for that provider. Until Test has stored ids for a role, that select is disabled and reads “Test to load models”.

The registry still seeds one default per role. A fresh install uses those seeds, and selection falls back to them when a catalog does not include the current id:

| Provider | STT                                                                                           | Summary                         |
| -------- | --------------------------------------------------------------------------------------------- | ------------------------------- |
| xAI      | `grok-voice-transcribe-2.0` (`diarize=true`)                                                  | `grok-4.5` chat completions     |
| OpenAI   | `gpt-4o-transcribe-diarize` with `response_format=diarized_json` and `chunking_strategy=auto` | `gpt-4.1-mini` chat completions |

Test classifies ids as a best effort. Voice ids contain `transcribe` or `whisper` (including `grok-voice-transcribe`) and do not contain `realtime` or `tts`. OpenAI chat ids start with `gpt-`, `o` plus a digit, or `chatgpt-`. xAI chat ids start with `grok-`. Embedding, moderation, image, audio, video, TTS, and realtime ids stay out of chat. If nothing matches either role, both selects get the full id list. A seed is added to its role only when that exact id was in the response.

`gpt-4.1-mini` is the stable smaller chat alias (snapshot `gpt-4.1-mini-2025-04-14`). OpenAI STT uses the diarized model so speaker labels stay Speaker 1, Speaker 2, and so on.

A fresh install defaults both roles to `xai-key` with the xAI seeds above. xAI `GET /v1/models` often returns chat ids only and omits speech models. When Test’s Voice probe passes and the catalog has no Voice ids, meetrec stores the registry Voice seed (`grok-voice-transcribe-2.0`) so the select is usable. The same seed fallback applies to AI if a catalog omits chat ids after a passing AI probe. A failed catalog request (`GET /v1/models` rejected) still leaves both selects empty; device-code tokens are not documented for that route.

## xAI OAuth

Public device-code client (Hermes / Grok Build family). No client secret. Calendar OAuth is a different client (Google Cloud or Microsoft Entra, PKCE loopback). Do not mix those client ids with this one. See [oauth-clients.md](oauth-clients.md).

- Issuer / discovery: `https://auth.x.ai` (`.well-known/openid-configuration`)
- Device code: `https://auth.x.ai/oauth2/device/code`
- Token: `https://auth.x.ai/oauth2/token`
- Client ID: `b1a00492-073a-47ea-816f-4c329264a828` (public device-code client id, no secret, safe to commit)
- Scope: `openid profile email offline_access grok-cli:access api:access`
- Device grant: `urn:ietf:params:oauth:grant-type:device_code`
- API base: `https://api.x.ai/v1`

Main stores refresh and access tokens in `userData/secrets.bin` via Electron `safeStorage`. Access tokens refresh 60 seconds before expiry, before a Live check, a Test probe, STT, or chat. IPC returns the user code and verification URL only while a sign-in is in progress. It never returns tokens or API keys.

## Behaviour

- Each card shows **Live** (a green dot and a short message) after its credential check succeeds. xAI posts to `/v1/stt` with no file. OpenAI reads `/v1/models`. Live stays in memory and is not written to `settings.json`.
- **Test** runs a Voice probe, an AI probe, and `GET /v1/models` for that card (OpenAI and xAI, same bearer token). Live is hidden while they run. Voice posts the speech endpoint with the selected model and no audio file. AI sends a one-token chat completion. The row then shows passed, failed, or not available. A Voice probe can pass on “file required” before the host checks the model id. When a probe passes and the catalog has ids for that role, those ids and a per-role `fetchedAt` are stored in `settings.json` under `modelCache`. When a probe passes, the catalog request succeeded, and that role matched nothing, the registry seed for the role is stored instead. A failed probe or a failed list does not invent ids and does not clear a previous list. Live is unchanged and is not written to `settings.json`.
- Saving a key or finishing sign-in does not change either default. **Default for Voice** and **Default for AI** are the only controls that do. Exactly one provider is selected for each role.
- Library audio is 96 kbps MP3 (`libmp3lame`), stereo when the mix was stereo and mono when capture was mic-only, at the capture sample rate. Transcribe uploads that MP3 and does not re-encode it. Cleanup does not delete it. A prepared file of 24 MB or smaller is one upload. A larger library file is copied into a temp directory and split there with ffmpeg’s segment muxer (stream copy, ordered pieces). Piece length follows 96 kbps so each piece stays under 24 MB. Each piece is uploaded on its own. Segment and word times move forward by that piece’s start on the prepared timeline. Speaker numbers are first-seen inside each piece, so a voice in a later piece is a new Speaker N. OpenAI still sends `chunking_strategy=auto` on every request, including each piece; that field is the model’s diarization window for audio longer than 30 seconds. Temp files are removed when the job finishes. A recording that is still a WAV uses the mono 16 kHz 48 kbps compress path.
- Transcribe stays off until the Voice default is configured and Live. Generate summary stays off until the AI default is configured and Live. Pressing Test is not required before those actions.
- Secrets and OAuth tokens live in Electron main only. The renderer holds a key only while the password field is being typed.
- A saved key wins over the matching environment variable. The environment applies whenever that provider has no saved key, even if it is not a default. A job still resolves a token only for the provider selected for that role.
- `settings:get` returns `{ voiceProviderId, aiProviderId, cards, canTranscribe, canSummarize, voiceGate, aiGate, xaiKeySource, openaiKeySource, oauthPending, oauthUserCode, verificationUrl, oauthExpiresAt, oauthIntervalSec }`. Each card includes its label, credential form, cached model choices (empty until listed), the selected model ids, Live state, and the last Voice and AI probe. Cards do not include keys or tokens.
