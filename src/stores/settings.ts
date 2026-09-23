import { defineStore } from 'pinia'
import { ref } from 'vue'
import type {
  ProviderCardStatus,
  ProviderId,
  ProviderRole,
  RecordingDestination,
  SettingsStatus
} from '../../electron/shared/ipc-contract'
import { useMeetrec } from '@/composables/useMeetrec'

export const useSettingsStore = defineStore('settings', () => {
  const voiceProviderId = ref<ProviderId>('xai-key')
  const aiProviderId = ref<ProviderId>('xai-key')
  const cards = ref<ProviderCardStatus[]>([])
  const canTranscribe = ref(false)
  const canSummarize = ref(false)
  const voiceGate = ref<string | null>(null)
  const aiGate = ref<string | null>(null)
  const xaiKeySource = ref<SettingsStatus['xaiKeySource']>('none')
  const openaiKeySource = ref<SettingsStatus['openaiKeySource']>('none')
  const oauthPending = ref(false)
  const oauthUserCode = ref<string | null>(null)
  const verificationUrl = ref<string | null>(null)
  const oauthExpiresAt = ref<number | null>(null)
  const oauthIntervalSec = ref<number | null>(null)
  const destination = ref<RecordingDestination>('local')
  const autoRecord = ref(false)
  const loading = ref(false)
  const saving = ref(false)
  const testingProviderId = ref<ProviderId | null>(null)
  const error = ref<string | null>(null)

  function applyStatus(status: SettingsStatus): void {
    voiceProviderId.value = status.voiceProviderId
    aiProviderId.value = status.aiProviderId
    cards.value = status.cards
    canTranscribe.value = status.canTranscribe
    canSummarize.value = status.canSummarize
    voiceGate.value = status.voiceGate
    aiGate.value = status.aiGate
    xaiKeySource.value = status.xaiKeySource
    openaiKeySource.value = status.openaiKeySource
    oauthPending.value = status.oauthPending
    oauthUserCode.value = status.oauthUserCode
    verificationUrl.value = status.verificationUrl
    oauthExpiresAt.value = status.oauthExpiresAt
    oauthIntervalSec.value = status.oauthIntervalSec
    destination.value = status.destination
    autoRecord.value = status.autoRecord
    error.value = null
  }

  function busy(): boolean {
    return saving.value || testingProviderId.value !== null
  }

  async function refresh(): Promise<void> {
    if (busy()) return
    loading.value = true
    try {
      applyStatus(await useMeetrec().settings.get())
    } catch (caught) {
      error.value = messageFrom(caught)
    } finally {
      loading.value = false
    }
  }

  async function refreshAndValidate(): Promise<void> {
    if (busy()) return
    loading.value = true
    try {
      applyStatus(await useMeetrec().settings.get())
      applyStatus(await useMeetrec().settings.validate())
    } catch (caught) {
      error.value = messageFrom(caught)
    } finally {
      loading.value = false
    }
  }

  async function setVoiceDefault(provider: ProviderId): Promise<void> {
    if (provider === voiceProviderId.value) return
    await save(() => useMeetrec().settings.setVoiceDefault(provider))
  }

  async function setAiDefault(provider: ProviderId): Promise<void> {
    if (provider === aiProviderId.value) return
    await save(() => useMeetrec().settings.setAiDefault(provider))
  }

  async function setModel(
    provider: ProviderId,
    role: ProviderRole,
    modelId: string
  ): Promise<void> {
    await save(() => useMeetrec().settings.setModel({ providerId: provider, role, modelId }))
  }

  async function testProvider(provider: ProviderId): Promise<void> {
    if (busy()) return
    testingProviderId.value = provider
    saving.value = true
    try {
      applyStatus(await useMeetrec().settings.testProvider(provider))
    } catch (caught) {
      error.value = messageFrom(caught)
    } finally {
      testingProviderId.value = null
      saving.value = false
    }
  }

  async function saveXaiKey(key: string): Promise<boolean> {
    const status = await save(() => useMeetrec().settings.setXaiKey(key))
    return status?.cards.find((card) => card.id === 'xai-key')?.live === 'ok'
  }

  async function clearXaiKey(): Promise<void> {
    await save(() => useMeetrec().settings.clearXaiKey())
  }

  async function saveOpenAiKey(key: string): Promise<boolean> {
    const status = await save(() => useMeetrec().settings.setOpenAiKey(key))
    return status?.cards.find((card) => card.id === 'openai')?.live === 'ok'
  }

  async function clearOpenAiKey(): Promise<void> {
    await save(() => useMeetrec().settings.clearOpenAiKey())
  }

  async function startXaiOAuth(): Promise<void> {
    await save(() => useMeetrec().settings.startXaiOAuth())
  }

  async function pollXaiOAuth(): Promise<void> {
    if (testingProviderId.value) return
    try {
      applyStatus(await useMeetrec().settings.pollXaiOAuth())
    } catch (caught) {
      error.value = messageFrom(caught)
      oauthPending.value = false
    }
  }

  async function signOutXaiOAuth(): Promise<void> {
    await save(() => useMeetrec().settings.signOutXaiOAuth())
  }

  async function setDestination(next: RecordingDestination): Promise<void> {
    if (next === destination.value) return
    await save(() => useMeetrec().settings.setDestination(next))
  }

  async function setAutoRecord(enabled: boolean): Promise<void> {
    if (enabled === autoRecord.value) return
    await save(() => useMeetrec().settings.setAutoRecord(enabled))
  }

  async function save(call: () => Promise<SettingsStatus>): Promise<SettingsStatus | null> {
    saving.value = true
    try {
      const status = await call()
      applyStatus(status)
      return status
    } catch (caught) {
      error.value = messageFrom(caught)
      return null
    } finally {
      saving.value = false
    }
  }

  return {
    voiceProviderId,
    aiProviderId,
    cards,
    canTranscribe,
    canSummarize,
    voiceGate,
    aiGate,
    xaiKeySource,
    openaiKeySource,
    oauthPending,
    oauthUserCode,
    verificationUrl,
    oauthExpiresAt,
    oauthIntervalSec,
    destination,
    autoRecord,
    loading,
    saving,
    testingProviderId,
    error,
    refresh,
    refreshAndValidate,
    setVoiceDefault,
    setAiDefault,
    setModel,
    testProvider,
    saveXaiKey,
    clearXaiKey,
    saveOpenAiKey,
    clearOpenAiKey,
    startXaiOAuth,
    pollXaiOAuth,
    signOutXaiOAuth,
    setDestination,
    setAutoRecord
  }
})

function messageFrom(caught: unknown): string {
  if (caught instanceof Error) return caught.message
  return 'Something went wrong.'
}
