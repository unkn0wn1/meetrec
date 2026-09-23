import { describe, expect, it } from 'vitest'
import { providerGateHint, type StoredSecretsView } from '../providers/auth'
import { defaultAppSettings, type AppSettings } from './settings-file'
import { buildSettingsSnapshot, type LiveEntry } from './card-snapshot'

const empty = { xaiApiKey: null, openaiApiKey: null, xaiOAuth: false }
const quietOauth = {
  pending: false,
  userCode: null,
  verificationUrl: null,
  expiresAt: null,
  intervalSec: null
}

function settings(patch: Partial<AppSettings>): AppSettings {
  return { ...defaultAppSettings(), ...patch, models: defaultAppSettings().models }
}

function snapshot(
  app: AppSettings,
  secrets: StoredSecretsView = empty,
  live: Partial<Record<AppSettings['voiceProviderId'], LiveEntry>> = {},
  env?: NodeJS.ProcessEnv
) {
  return buildSettingsSnapshot({
    settings: app,
    secrets,
    env,
    live,
    probes: {},
    oauth: quietOauth
  })
}

describe('settings snapshot', () => {
  it('enables transcribe only when the voice default is live', () => {
    const app = settings({ voiceProviderId: 'openai', aiProviderId: 'xai-key' })
    const status = snapshot(
      app,
      { xaiApiKey: 'xai', openaiApiKey: 'oa', xaiOAuth: false },
      { openai: { state: 'ok', message: 'OpenAI accepted the API key.' } }
    )
    expect(status.canTranscribe).toBe(true)
    expect(status.canSummarize).toBe(false)
    expect(status.voiceGate).toBeNull()
    expect(status.aiGate).toBe(providerGateHint('xai-key'))
    expect(status.cards.find((card) => card.id === 'openai')?.isVoiceDefault).toBe(true)
    expect(status.cards.find((card) => card.id === 'xai-key')?.isAiDefault).toBe(true)
  })

  it('uses the provider hint when the default has no credentials', () => {
    const status = snapshot(settings({}))
    expect(status.canTranscribe).toBe(false)
    expect(status.canSummarize).toBe(false)
    expect(status.voiceGate).toBe(providerGateHint('xai-key'))
    expect(status.aiGate).toBe(providerGateHint('xai-key'))
  })

  it('surfaces a failed live check as the role gate', () => {
    const message = 'OpenAI rejected the API key.'
    const status = snapshot(
      settings({ voiceProviderId: 'openai', aiProviderId: 'openai' }),
      { ...empty, openaiApiKey: 'oa' },
      { openai: { state: 'bad', message } }
    )
    expect(status.canTranscribe).toBe(false)
    expect(status.canSummarize).toBe(false)
    expect(status.voiceGate).toBe(message)
    expect(status.aiGate).toBe(message)
  })

  it('prefers a saved key and still marks an env-only provider configured', () => {
    const status = snapshot(
      settings({}),
      { ...empty, xaiApiKey: 'saved' },
      {},
      { XAI_API_KEY: 'from-env', OPENAI_API_KEY: 'from-env' }
    )
    const xai = status.cards.find((card) => card.id === 'xai-key')
    const openai = status.cards.find((card) => card.id === 'openai')
    expect(xai?.statusLabel).toBe('xAI key saved.')
    expect(xai?.configured).toBe(true)
    expect(openai?.statusLabel).toBe('Using OPENAI_API_KEY from the environment.')
    expect(openai?.configured).toBe(true)
    expect(status.xaiKeySource).toBe('settings')
    expect(status.openaiKeySource).toBe('env')
  })

  it('does not treat an xAI key and xAI sign-in as the same credential', () => {
    const oauthOnly = snapshot(settings({}), { ...empty, xaiOAuth: true })
    expect(oauthOnly.cards.find((card) => card.id === 'xai-oauth')?.configured).toBe(true)
    expect(oauthOnly.cards.find((card) => card.id === 'xai-key')?.configured).toBe(false)

    const keyOnly = snapshot(settings({}), { ...empty, xaiApiKey: 'xai' })
    expect(keyOnly.cards.find((card) => card.id === 'xai-key')?.configured).toBe(true)
    expect(keyOnly.cards.find((card) => card.id === 'xai-oauth')?.configured).toBe(false)
    expect(keyOnly.cards.find((card) => card.id === 'xai-oauth')?.statusLabel).toBe(
      'Not signed in.'
    )
  })
})
