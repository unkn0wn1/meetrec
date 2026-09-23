/** xAI speech-to-text. Diarized words come back on /v1/stt. */
export const XAI_STT_MODEL = 'grok-voice-transcribe-2.0'
export const XAI_STT_URL = 'https://api.x.ai/v1/stt'

/** Grok chat used for minutes JSON. */
export const XAI_CHAT_MODEL = 'grok-4.5'
export const XAI_CHAT_URL = 'https://api.x.ai/v1/chat/completions'

/**
 * OpenAI file transcription with speaker labels.
 * `gpt-4o-transcribe-diarize` + `diarized_json` is the stable diarized path.
 * `chunking_strategy=auto` is required for audio longer than 30 seconds.
 */
export const OPENAI_STT_MODEL = 'gpt-4o-transcribe-diarize'
export const OPENAI_STT_URL = 'https://api.openai.com/v1/audio/transcriptions'

/** Stable smaller chat model for minutes JSON. Alias of gpt-4.1-mini-2025-04-14. */
export const OPENAI_CHAT_MODEL = 'gpt-4.1-mini'
export const OPENAI_CHAT_URL = 'https://api.openai.com/v1/chat/completions'

export const OPENAI_MODELS_URL = 'https://api.openai.com/v1/models'
