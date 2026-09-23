import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { ProviderId, SettingsStatus } from '../../electron/shared/ipc-contract'
import { useMeetrec } from '@/composables/useMeetrec'

const GATE: Record<ProviderId, string> = {
  'xai-oauth': 'Sign in with xAI in Settings',
  'xai-key': 'Add a working xAI API key in Settings',
  openai: 'Add a working OpenAI API key in Settings'
}

export const useSettingsStore = defineStore('settings', () => {
  const provider = ref<ProviderId>('xai-key')
  const configured = ref(false)
  const validated = ref(false)
  const message = ref<string | null>(null)
  const xaiKeySource = ref<SettingsStatus['xaiKeySource']>('none')
  const openaiKeySource = ref<SettingsStatus['openaiKeySource']>('none')
  const oauthPending = ref(false)
  const oauthUserCode = ref<string | null>(null)
  const verificationUrl = ref<string | null>(null)
  const oauthExpiresAt = ref<number | null>(null)
  const oauthIntervalSec = ref<number | null>(null)
  const loading = ref(false)
  const saving = ref(false)

  const canUseProvider = computed(() => configured.value && validated.value)
  const gateHint = computed(() => (canUseProvider.value ? null : GATE[provider.value]))
  const statusLabel = computed(() =>
    describeStatus(provider.value, configured.value, xaiKeySource.value, openaiKeySource.value)
  )

  function applyStatus(status: SettingsStatus): void {
    provider.value = status.provider
    configured.value = status.configured
    validated.value = status.validated
    message.value = status.message || null
    xaiKeySource.value = status.xaiKeySource
    openaiKeySource.value = status.openaiKeySource
    oauthPending.value = status.oauthPending
    oauthUserCode.value = status.oauthUserCode
    verificationUrl.value = status.verificationUrl
    oauthExpiresAt.value = status.oauthExpiresAt
    oauthIntervalSec.value = status.oauthIntervalSec
  }

  async function refresh(): Promise<void> {
    loading.value = true
    try {
      applyStatus(await useMeetrec().settings.get())
    } catch (caught) {
      message.value = messageFrom(caught)
      configured.value = false
      validated.value = false
    } finally {
      loading.value = false
    }
  }

  async function validate(): Promise<boolean> {
    if (!configured.value && provider.value !== 'xai-oauth') {
      validated.value = false
      return false
    }
    try {
      applyStatus(await useMeetrec().settings.validate())
      return validated.value
    } catch (caught) {
      validated.value = false
      message.value = messageFrom(caught)
      return false
    }
  }

  async function refreshAndValidate(): Promise<void> {
    await refresh()
    if (configured.value) await validate()
  }

  async function chooseProvider(next: ProviderId): Promise<void> {
    if (next === provider.value) return
    saving.value = true
    try {
      applyStatus(await useMeetrec().settings.setProvider(next))
    } catch (caught) {
      message.value = messageFrom(caught)
    } finally {
      saving.value = false
    }
  }

  async function saveXaiKey(key: string): Promise<boolean> {
    return save(() => useMeetrec().settings.setXaiKey(key))
  }

  async function clearXaiKey(): Promise<void> {
    await save(() => useMeetrec().settings.clearXaiKey())
  }

  async function saveOpenAiKey(key: string): Promise<boolean> {
    return save(() => useMeetrec().settings.setOpenAiKey(key))
  }

  async function clearOpenAiKey(): Promise<void> {
    await save(() => useMeetrec().settings.clearOpenAiKey())
  }

  async function startXaiOAuth(): Promise<void> {
    await save(() => useMeetrec().settings.startXaiOAuth())
  }

  async function pollXaiOAuth(): Promise<void> {
    try {
      applyStatus(await useMeetrec().settings.pollXaiOAuth())
    } catch (caught) {
      message.value = messageFrom(caught)
      oauthPending.value = false
    }
  }

  async function signOutXaiOAuth(): Promise<void> {
    await save(() => useMeetrec().settings.signOutXaiOAuth())
  }

  async function save(call: () => Promise<SettingsStatus>): Promise<boolean> {
    saving.value = true
    try {
      applyStatus(await call())
      return validated.value
    } catch (caught) {
      message.value = messageFrom(caught)
      return false
    } finally {
      saving.value = false
    }
  }

  return {
    provider,
    configured,
    validated,
    message,
    xaiKeySource,
    openaiKeySource,
    oauthPending,
    oauthUserCode,
    verificationUrl,
    oauthExpiresAt,
    oauthIntervalSec,
    loading,
    saving,
    canUseProvider,
    gateHint,
    statusLabel,
    refresh,
    validate,
    refreshAndValidate,
    chooseProvider,
    saveXaiKey,
    clearXaiKey,
    saveOpenAiKey,
    clearOpenAiKey,
    startXaiOAuth,
    pollXaiOAuth,
    signOutXaiOAuth
  }
})

function describeStatus(
  provider: ProviderId,
  configured: boolean,
  xaiKeySource: SettingsStatus['xaiKeySource'],
  openaiKeySource: SettingsStatus['openaiKeySource']
): string {
  if (provider === 'xai-oauth') return configured ? 'Signed in with xAI.' : 'Not signed in.'
  if (provider === 'openai') {
    if (openaiKeySource === 'settings') return 'OpenAI key saved.'
    if (openaiKeySource === 'env') return 'Using OPENAI_API_KEY from the environment.'
    return 'Not configured.'
  }
  if (xaiKeySource === 'settings') return 'xAI key saved.'
  if (xaiKeySource === 'env') return 'Using XAI_API_KEY from the environment.'
  return 'Not configured.'
}

function messageFrom(caught: unknown): string {
  if (caught instanceof Error) return caught.message
  return 'Something went wrong.'
}
