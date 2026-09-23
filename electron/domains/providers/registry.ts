import type { CredentialKind, ModelOption, ProviderRole } from '../../shared/ipc-contract'
import { PROVIDER_IDS, type ProviderId } from './ids'
import { OPENAI_CHAT_MODEL, OPENAI_STT_MODEL, XAI_CHAT_MODEL, XAI_STT_MODEL } from './models'

export type ProviderFamily = 'xai' | 'openai'

export interface ProviderDefinition {
  id: ProviderId
  label: string
  family: ProviderFamily
  credential: CredentialKind
  supportsVoice: boolean
  supportsAi: boolean
  voiceModels: ModelOption[]
  aiModels: ModelOption[]
}

function option(id: string): ModelOption {
  return { id, label: id }
}

const XAI_VOICE = [option(XAI_STT_MODEL)]
const XAI_AI = [option(XAI_CHAT_MODEL)]
const OPENAI_VOICE = [option(OPENAI_STT_MODEL)]
const OPENAI_AI = [option(OPENAI_CHAT_MODEL)]

export const PROVIDER_REGISTRY: readonly ProviderDefinition[] = [
  {
    id: 'xai-oauth',
    label: 'xAI sign-in',
    family: 'xai',
    credential: 'xai-oauth',
    supportsVoice: true,
    supportsAi: true,
    voiceModels: XAI_VOICE,
    aiModels: XAI_AI
  },
  {
    id: 'xai-key',
    label: 'xAI API key',
    family: 'xai',
    credential: 'xai-key',
    supportsVoice: true,
    supportsAi: true,
    voiceModels: XAI_VOICE,
    aiModels: XAI_AI
  },
  {
    id: 'openai',
    label: 'OpenAI',
    family: 'openai',
    credential: 'openai-key',
    supportsVoice: true,
    supportsAi: true,
    voiceModels: OPENAI_VOICE,
    aiModels: OPENAI_AI
  }
]

export function providerDefinition(id: ProviderId): ProviderDefinition {
  const found = PROVIDER_REGISTRY.find((row) => row.id === id)
  if (!found) throw new Error('Unknown provider.')
  return found
}

export function supportsRole(id: ProviderId, role: ProviderRole): boolean {
  const row = providerDefinition(id)
  return role === 'voice' ? row.supportsVoice : row.supportsAi
}

export function modelOptions(id: ProviderId, role: ProviderRole): ModelOption[] {
  const row = providerDefinition(id)
  return role === 'voice' ? row.voiceModels : row.aiModels
}

export function defaultModel(id: ProviderId, role: ProviderRole): string {
  return modelOptions(id, role)[0]?.id ?? ''
}

export function isAllowedModel(id: ProviderId, role: ProviderRole, modelId: string): boolean {
  return modelOptions(id, role).some((item) => item.id === modelId)
}

export function coerceModel(id: ProviderId, role: ProviderRole, modelId: unknown): string {
  if (typeof modelId === 'string' && isAllowedModel(id, role, modelId)) return modelId
  return defaultModel(id, role)
}

export function assertRole(id: ProviderId, role: ProviderRole): void {
  if (supportsRole(id, role)) return
  throw new Error(
    role === 'voice' ? 'This provider does not transcribe.' : 'This provider does not summarize.'
  )
}

export function registryMatchesIds(): boolean {
  const ids = PROVIDER_REGISTRY.map((row) => row.id)
  return ids.length === PROVIDER_IDS.length && ids.every((id, index) => id === PROVIDER_IDS[index])
}
