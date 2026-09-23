import type { RecordingDestination } from '../../shared/destination'
import type { ProviderId, ProviderRole, SettingsStatus } from '../../shared/ipc-contract'
import {
  isProviderConfigured,
  providerGateHint,
  resolveActiveAuth,
  type ActiveAuth,
  type StoredSecretsView
} from '../providers/auth'
import { PROVIDER_IDS, isProviderId } from '../providers/ids'
import { listProviderModels } from '../providers/list-models'
import { validateOpenAiApiKey } from '../providers/openai-ping'
import { probeAi, probeVoice } from '../providers/probes'
import { assertRole, isAllowedModel, providerDefinition } from '../providers/registry'
import { validateXaiApiKey } from '../providers/xai-ping'
import {
  accessNeedsRefresh,
  pollDeviceCode,
  refreshAccessToken,
  requestDeviceCode
} from '../providers/xai-oauth'
import {
  buildSettingsSnapshot,
  type LiveEntry,
  type ProbePair,
  type SnapshotOauth
} from './card-snapshot'
import { mergeListedModels } from './model-cache'
import { OAuthSession, type PublicOAuthPending } from './oauth-session'
import type { SecretStore } from './secret-store'
import { readAppSettings, writeAppSettings, type AppSettings } from './settings-file'

export interface SettingsServiceDeps {
  secrets: SecretStore
  userDataDir: () => string
  env?: NodeJS.ProcessEnv
  fetchImpl?: typeof fetch
  openExternal?: (url: string) => Promise<void>
  now?: () => number
  session?: OAuthSession
}

export class SettingsService {
  private readonly live = new Map<ProviderId, LiveEntry>()
  private readonly probes = new Map<ProviderId, ProbePair>()
  private readonly liveInflight = new Map<ProviderId, Promise<void>>()
  private migrated = false
  private migrating: Promise<void> | null = null
  private afterAutoRecord: (() => void) | null = null
  private readonly session: OAuthSession

  constructor(private readonly deps: SettingsServiceDeps) {
    this.session = deps.session ?? new OAuthSession()
  }

  async status(): Promise<SettingsStatus> {
    return this.snapshot()
  }

  async setVoiceDefault(provider: ProviderId): Promise<SettingsStatus> {
    return this.setDefault(provider, 'voice')
  }

  async setAiDefault(provider: ProviderId): Promise<SettingsStatus> {
    return this.setDefault(provider, 'ai')
  }

  async setModel(
    provider: ProviderId,
    role: ProviderRole,
    modelId: string
  ): Promise<SettingsStatus> {
    this.requireProvider(provider)
    assertRole(provider, role)
    const settings = await this.loadSettings()
    const listed = settings.modelCache[provider][role].ids
    const allowed =
      listed.length > 0 ? listed.includes(modelId) : isAllowedModel(provider, role, modelId)
    if (!allowed) throw new Error('That model is not available.')
    const models = {
      ...settings.models,
      [provider]: { ...settings.models[provider], [role]: modelId }
    }
    await writeAppSettings(this.deps.userDataDir(), { ...settings, models })
    const pair = this.probes.get(provider)
    if (pair) this.probes.set(provider, { ...pair, [role]: { state: 'idle', message: '' } })
    return this.snapshot()
  }

  async setXaiKey(key: string): Promise<SettingsStatus> {
    await this.deps.secrets.writeXaiApiKey(key)
    return this.afterCredentialChange('xai-key')
  }

  async clearXaiKey(): Promise<SettingsStatus> {
    await this.deps.secrets.clearXaiApiKey()
    return this.afterCredentialChange('xai-key')
  }

  async setOpenAiKey(key: string): Promise<SettingsStatus> {
    await this.deps.secrets.writeOpenAiApiKey(key)
    return this.afterCredentialChange('openai')
  }

  async clearOpenAiKey(): Promise<SettingsStatus> {
    await this.deps.secrets.clearOpenAiApiKey()
    return this.afterCredentialChange('openai')
  }

  async startXaiOAuth(): Promise<SettingsStatus> {
    this.clearCard('xai-oauth')
    const flow = await requestDeviceCode({ fetchImpl: this.deps.fetchImpl, now: this.now() })
    const pending = this.session.start(flow)
    if (this.deps.openExternal) {
      await this.deps.openExternal(pending.verificationUrl).catch(() => undefined)
    }
    return this.snapshot()
  }

  async pollXaiOAuth(): Promise<SettingsStatus> {
    const deviceCode = this.session.deviceCode()
    if (!deviceCode) {
      this.live.set('xai-oauth', { state: 'bad', message: 'Start xAI sign-in again.' })
      return this.snapshot()
    }
    const result = await pollDeviceCode({
      deviceCode,
      intervalSec: this.session.intervalSec(),
      fetchImpl: this.deps.fetchImpl,
      now: this.now()
    })
    if (result.kind === 'pending') return this.snapshot()
    if (result.kind === 'slow_down') {
      this.session.slowDown()
      return this.snapshot()
    }
    if (result.kind === 'tokens') {
      await this.deps.secrets.writeXaiOAuth(result.tokens)
      this.session.clear()
      return this.afterCredentialChange('xai-oauth')
    }
    this.session.clear()
    this.clearCard('xai-oauth')
    this.live.set('xai-oauth', { state: 'bad', message: result.message })
    return this.snapshot()
  }

  async signOutXaiOAuth(): Promise<SettingsStatus> {
    this.session.clear()
    await this.deps.secrets.clearXaiOAuth()
    this.clearCard('xai-oauth')
    return this.snapshot()
  }

  async validate(): Promise<SettingsStatus> {
    await this.migrateIfNeeded()
    const secrets = await this.secretView()
    const configured = PROVIDER_IDS.filter((id) => isProviderConfigured(id, secrets, this.env()))
    await Promise.all(configured.map((id) => this.checkLive(id)))
    return this.snapshot()
  }

  async testProvider(provider: ProviderId): Promise<SettingsStatus> {
    this.requireProvider(provider)
    const definition = providerDefinition(provider)
    const settings = await this.loadSettings()
    const token = await this.tokenFor(provider)
    const missing = providerGateHint(provider)
    const selected = settings.models[provider]
    if (!token) this.live.delete(provider)
    const [voice, ai, listed] = await Promise.all([
      probeVoice({
        family: definition.family,
        model: selected.voice,
        token,
        supported: definition.supportsVoice,
        missingMessage: missing,
        fetchImpl: this.deps.fetchImpl
      }),
      probeAi({
        family: definition.family,
        model: selected.ai,
        token,
        supported: definition.supportsAi,
        missingMessage: missing,
        fetchImpl: this.deps.fetchImpl
      }),
      token
        ? listProviderModels({
            family: definition.family,
            token,
            fetchImpl: this.deps.fetchImpl
          })
        : Promise.resolve(null),
      token ? this.checkLive(provider) : Promise.resolve()
    ])
    this.probes.set(provider, { voice, ai })
    const next = mergeListedModels(
      settings,
      provider,
      { voice, ai },
      listed,
      new Date(this.now()).toISOString()
    )
    if (next !== settings) await writeAppSettings(this.deps.userDataDir(), next)
    return this.snapshot()
  }

  watchAutoRecord(listener: () => void): void {
    this.afterAutoRecord = listener
  }

  async setDestination(destination: RecordingDestination): Promise<SettingsStatus> {
    const settings = await this.loadSettings()
    if (settings.destination === destination) return this.snapshot()
    await writeAppSettings(this.deps.userDataDir(), { ...settings, destination })
    return this.snapshot()
  }

  async setAutoRecord(enabled: boolean): Promise<SettingsStatus> {
    const settings = await this.loadSettings()
    if (settings.autoRecord === enabled) return this.snapshot()
    await writeAppSettings(this.deps.userDataDir(), { ...settings, autoRecord: enabled })
    this.afterAutoRecord?.()
    return this.snapshot()
  }

  async readAuth(role: ProviderRole): Promise<ActiveAuth> {
    const settings = await this.loadSettings()
    const provider = role === 'voice' ? settings.voiceProviderId : settings.aiProviderId
    assertRole(provider, role)
    const token = await this.tokenFor(provider)
    if (!token) throw new Error(providerGateHint(provider))
    return { provider, token, model: settings.models[provider][role] }
  }

  private async setDefault(provider: ProviderId, role: ProviderRole): Promise<SettingsStatus> {
    this.requireProvider(provider)
    assertRole(provider, role)
    const settings = await this.loadSettings()
    const next: AppSettings =
      role === 'voice'
        ? { ...settings, voiceProviderId: provider }
        : { ...settings, aiProviderId: provider }
    await writeAppSettings(this.deps.userDataDir(), next)
    const configured = isProviderConfigured(provider, await this.secretView(), this.env())
    if (configured && !this.live.has(provider)) await this.checkLive(provider)
    return this.snapshot()
  }

  private async afterCredentialChange(provider: ProviderId): Promise<SettingsStatus> {
    this.clearCard(provider)
    if (isProviderConfigured(provider, await this.secretView(), this.env())) {
      await this.checkLive(provider)
    }
    return this.snapshot()
  }

  private requireProvider(provider: string): asserts provider is ProviderId {
    if (!isProviderId(provider)) throw new Error('Unknown provider.')
  }

  private clearCard(provider: ProviderId): void {
    this.live.delete(provider)
    this.probes.delete(provider)
  }

  private checkLive(provider: ProviderId): Promise<void> {
    const existing = this.liveInflight.get(provider)
    if (existing) return existing
    const job = this.runLive(provider).finally(() => {
      this.liveInflight.delete(provider)
    })
    this.liveInflight.set(provider, job)
    return job
  }

  private async runLive(provider: ProviderId): Promise<void> {
    const token = await this.tokenFor(provider)
    if (!token) {
      this.live.delete(provider)
      return
    }
    const result =
      provider === 'openai'
        ? await validateOpenAiApiKey({ apiKey: token, fetchImpl: this.deps.fetchImpl })
        : await validateXaiApiKey({ apiKey: token, fetchImpl: this.deps.fetchImpl })
    this.live.set(provider, { state: result.ok ? 'ok' : 'bad', message: result.message })
  }

  private async tokenFor(provider: ProviderId): Promise<string | null> {
    if (provider === 'xai-oauth') {
      const tokens = await this.deps.secrets.readXaiOAuth()
      if (!tokens) return null
      if (!accessNeedsRefresh(tokens, this.now())) return tokens.accessToken
      const refreshed = await refreshAccessToken({
        tokens,
        fetchImpl: this.deps.fetchImpl,
        now: this.now()
      })
      await this.deps.secrets.writeXaiOAuth(refreshed)
      return refreshed.accessToken
    }
    const auth = resolveActiveAuth({
      provider,
      secrets: await this.secretView(),
      env: this.env()
    })
    return auth?.token ?? null
  }

  private async snapshot(): Promise<SettingsStatus> {
    await this.migrateIfNeeded()
    const settings = (await readAppSettings(this.deps.userDataDir())).settings
    const bag = await this.deps.secrets.readBag()
    const pending = this.session.current(this.now())
    return buildSettingsSnapshot({
      settings,
      secrets: {
        xaiApiKey: bag.xaiApiKey,
        openaiApiKey: bag.openaiApiKey,
        xaiOAuth: Boolean(bag.xaiOAuth)
      },
      env: this.env(),
      live: Object.fromEntries(this.live) as Partial<Record<ProviderId, LiveEntry>>,
      probes: Object.fromEntries(this.probes) as Partial<Record<ProviderId, ProbePair>>,
      oauth: oauthView(pending)
    })
  }

  private migrateIfNeeded(): Promise<void> {
    if (this.migrated) return Promise.resolve()
    if (!this.migrating) {
      this.migrating = this.runMigration().finally(() => {
        this.migrating = null
      })
    }
    return this.migrating
  }

  private async runMigration(): Promise<void> {
    const parsed = await readAppSettings(this.deps.userDataDir())
    if (parsed.legacy) await writeAppSettings(this.deps.userDataDir(), parsed.settings)
    this.migrated = true
  }

  private async loadSettings(): Promise<AppSettings> {
    await this.migrateIfNeeded()
    return (await readAppSettings(this.deps.userDataDir())).settings
  }

  private async secretView(): Promise<StoredSecretsView> {
    const bag = await this.deps.secrets.readBag()
    return {
      xaiApiKey: bag.xaiApiKey,
      openaiApiKey: bag.openaiApiKey,
      xaiOAuth: Boolean(bag.xaiOAuth)
    }
  }

  private env(): NodeJS.ProcessEnv {
    return this.deps.env ?? process.env
  }

  private now(): number {
    return this.deps.now?.() ?? Date.now()
  }
}

function oauthView(pending: PublicOAuthPending | null): SnapshotOauth {
  return {
    pending: Boolean(pending),
    userCode: pending?.userCode ?? null,
    verificationUrl: pending?.verificationUrl ?? null,
    expiresAt: pending?.expiresAt ?? null,
    intervalSec: pending?.intervalSec ?? null
  }
}
