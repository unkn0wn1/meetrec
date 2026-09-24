import type {
  ProviderId,
  ProviderCardStatus,
  RoleProbe,
  SettingsStatus
} from '../../shared/ipc-contract'
import {
  canUseRole,
  isProviderConfigured,
  providerGateHint,
  providerKeySources,
  type StoredSecretsView
} from '../providers/auth'
import { PROVIDER_IDS } from '../providers/ids'
import { providerDefinition } from '../providers/registry'
import { idleProbe } from '../providers/probes'
import type { AppSettings } from './settings-file'

export interface LiveEntry {
  state: 'ok' | 'bad'
  message: string
}

export interface ProbePair {
  voice: RoleProbe
  ai: RoleProbe
}

export interface SnapshotOauth {
  pending: boolean
  userCode: string | null
  verificationUrl: string | null
  expiresAt: number | null
  intervalSec: number | null
}

export function buildSettingsSnapshot(input: {
  settings: AppSettings
  secrets: StoredSecretsView
  env?: NodeJS.ProcessEnv
  live: Partial<Record<ProviderId, LiveEntry>>
  probes: Partial<Record<ProviderId, ProbePair>>
  oauth: SnapshotOauth
}): SettingsStatus {
  const sources = providerKeySources(input.secrets, input.env)
  const cards = PROVIDER_IDS.map((id) =>
    cardFor(id, input.settings, input.secrets, input.env, input.live[id], input.probes[id])
  )
  const voice = cards.find((card) => card.id === input.settings.voiceProviderId) ?? cards[0]
  const ai = cards.find((card) => card.id === input.settings.aiProviderId) ?? cards[0]
  const voiceReady = roleReady(voice)
  const aiReady = roleReady(ai)
  return {
    voiceProviderId: input.settings.voiceProviderId,
    aiProviderId: input.settings.aiProviderId,
    cards,
    canTranscribe: voiceReady.enabled,
    canSummarize: aiReady.enabled,
    voiceGate: voiceReady.gate,
    aiGate: aiReady.gate,
    xaiKeySource: sources.xaiKeySource,
    openaiKeySource: sources.openaiKeySource,
    oauthPending: input.oauth.pending,
    oauthUserCode: input.oauth.userCode,
    verificationUrl: input.oauth.verificationUrl,
    oauthExpiresAt: input.oauth.expiresAt,
    oauthIntervalSec: input.oauth.intervalSec,
    destination: input.settings.destination,
    autoRecord: input.settings.autoRecord,
    silenceAutoStop: input.settings.silenceAutoStop,
    silenceAutoStopSeconds: input.settings.silenceAutoStopSeconds
  }
}

function cardFor(
  id: ProviderId,
  settings: AppSettings,
  secrets: StoredSecretsView,
  env: NodeJS.ProcessEnv | undefined,
  live: LiveEntry | undefined,
  probes: ProbePair | undefined
): ProviderCardStatus {
  const definition = providerDefinition(id)
  const configured = isProviderConfigured(id, secrets, env)
  const sources = providerKeySources(secrets, env)
  const liveState = live?.state ?? 'unknown'
  return {
    id,
    label: definition.label,
    credential: definition.credential,
    configured,
    statusLabel: statusLabel(id, configured, sources.xaiKeySource, sources.openaiKeySource),
    supportsVoice: definition.supportsVoice,
    supportsAi: definition.supportsAi,
    voiceModels: settings.modelCache[id].voice.ids.map((modelId) => ({
      id: modelId,
      label: modelId
    })),
    aiModels: settings.modelCache[id].ai.ids.map((modelId) => ({
      id: modelId,
      label: modelId
    })),
    voiceModel: settings.models[id].voice,
    aiModel: settings.models[id].ai,
    isVoiceDefault: settings.voiceProviderId === id,
    isAiDefault: settings.aiProviderId === id,
    live: liveState,
    liveMessage: liveState === 'unknown' ? '' : (live?.message ?? ''),
    voiceProbe: probes?.voice ?? idleProbe(),
    aiProbe: probes?.ai ?? idleProbe()
  }
}

function roleReady(card: ProviderCardStatus | undefined): {
  enabled: boolean
  gate: string | null
} {
  if (!card) return { enabled: false, gate: providerGateHint('xai-key') }
  const enabled = canUseRole(card.configured, card.live === 'ok')
  if (enabled) return { enabled: true, gate: null }
  if (card.live === 'bad' && card.liveMessage) return { enabled: false, gate: card.liveMessage }
  return { enabled: false, gate: providerGateHint(card.id) }
}

function statusLabel(
  id: ProviderId,
  configured: boolean,
  xaiKeySource: SettingsStatus['xaiKeySource'],
  openaiKeySource: SettingsStatus['openaiKeySource']
): string {
  if (id === 'xai-oauth') return configured ? 'Signed in with xAI.' : 'Not signed in.'
  if (id === 'openai') {
    if (openaiKeySource === 'settings') return 'OpenAI key saved.'
    if (openaiKeySource === 'env') return 'Using OPENAI_API_KEY from the environment.'
    return 'Not configured.'
  }
  if (xaiKeySource === 'settings') return 'xAI key saved.'
  if (xaiKeySource === 'env') return 'Using XAI_API_KEY from the environment.'
  return 'Not configured.'
}
