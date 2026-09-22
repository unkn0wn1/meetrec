# Providers

## Two registries

1. **STT providers** — turn audio file → transcript (+ optional diarization).
2. **LLM providers** — transcript (+ speaker map) → minutes markdown.

Each entry: `id`, `label`, `kind`, auth (`oauth` | `apiKey`), base URL, model id, enabled flag.

## Defaults

- STT: `xai-voice-transcribe-2` — batch `POST /v1/stt`, `diarize=true`, model pin `grok-voice-transcribe-2.0` when needed.
- LLM: Grok via SuperGrok Heavy entitlement / xAI API access.

## Non-Heavy users

Settings UI lists providers; user pastes API keys (stored by main/security). Examples to support early: OpenAI, Anthropic, generic OpenAI-compatible base URL. Local Whisper can be a later STT provider.

## Implementation rule

Provider HTTP runs in **main** (or a utility process). Renderer sends `providers.transcribe({ recordingId })` over IPC. Never ship raw keys to the Vue bundle or logs.
