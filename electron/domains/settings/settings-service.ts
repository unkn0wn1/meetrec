import type { ActiveAuth, ProviderAuthStatus } from '../providers/auth'
import { providerAuthStatus, providerGateHint, resolveActiveAuth } from '../providers/auth'
import { parseProviderId, type ProviderId } from '../providers/ids'
import { validateOpenAiApiKey } from '../providers/openai-ping'
import { validateXaiApiKey, type XaiValidation } from '../providers/xai-ping'
import {
  accessNeedsRefresh,
  pollDeviceCode,
  refreshAccessToken,
  requestDeviceCode
} from '../providers/xai-oauth'
import { readAppSettings, writeAppSettings } from './settings-file'
import { OAuthSession, type PublicOAuthPending } from './oauth-session'
import type { SecretStore } from './secret-store'

export interface SettingsServiceDeps {
  secrets: SecretStore
  userDataDir: () => string
  env?: NodeJS.ProcessEnv
  fetchImpl?: typeof fetch
  openExternal?: (url: string) => Promise<void>
  now?: () => number
  session?: OAuthSession
}

export interface SettingsSnapshot extends ProviderAuthStatus {
  validated: boolean
  message: string
  oauthUserCode: string | null
  verificationUrl: string | null
  oauthExpiresAt: number | null
  oauthIntervalSec: number | null
}

const NOT_CHECKED = 'Not checked yet.'

export class SettingsService {
  private validatedProvider: ProviderId | null = null
  private validatedOk = false
  private lastMessage = NOT_CHECKED
  private readonly session: OAuthSession

  constructor(private readonly deps: SettingsServiceDeps) {
    this.session = deps.session ?? new OAuthSession()
  }

  async status(): Promise<SettingsSnapshot> {
    const auth = await this.authStatus()
    const pending = this.session.current(this.now())
    const validated = this.validatedOk && this.validatedProvider === auth.provider
    return {
      ...auth,
      oauthPending: auth.provider === 'xai-oauth' && Boolean(pending),
      validated,
      message: this.lastMessage,
      oauthUserCode: pending?.userCode ?? null,
      verificationUrl: pending?.verificationUrl ?? null,
      oauthExpiresAt: pending?.expiresAt ?? null,
      oauthIntervalSec: pending?.intervalSec ?? null
    }
  }

  async setProvider(provider: ProviderId): Promise<SettingsSnapshot> {
    const next = parseProviderId(provider)
    await writeAppSettings(this.deps.userDataDir(), { provider: next })
    this.invalidate()
    const snapshot = await this.status()
    if (!snapshot.configured) {
      this.lastMessage = ''
      return this.status()
    }
    return this.validate()
  }

  async setXaiKey(key: string): Promise<SettingsSnapshot> {
    await this.deps.secrets.writeXaiApiKey(key)
    await this.activate('xai-key')
    return this.validate()
  }

  async clearXaiKey(): Promise<SettingsSnapshot> {
    await this.deps.secrets.clearXaiApiKey()
    this.invalidate()
    const snapshot = await this.status()
    if (snapshot.provider === 'xai-key' && snapshot.xaiKeySource === 'none') {
      this.lastMessage = 'xAI API key cleared.'
      return this.status()
    }
    if (snapshot.provider === 'xai-key') return this.validate()
    this.lastMessage = 'xAI API key cleared.'
    return this.status()
  }

  async setOpenAiKey(key: string): Promise<SettingsSnapshot> {
    await this.deps.secrets.writeOpenAiApiKey(key)
    await this.activate('openai')
    return this.validate()
  }

  async clearOpenAiKey(): Promise<SettingsSnapshot> {
    await this.deps.secrets.clearOpenAiApiKey()
    this.invalidate()
    const snapshot = await this.status()
    if (snapshot.provider === 'openai' && snapshot.openaiKeySource === 'none') {
      this.lastMessage = 'OpenAI API key cleared.'
      return this.status()
    }
    if (snapshot.provider === 'openai') return this.validate()
    this.lastMessage = 'OpenAI API key cleared.'
    return this.status()
  }

  async startXaiOAuth(): Promise<SettingsSnapshot> {
    await this.activate('xai-oauth')
    this.invalidate()
    const flow = await requestDeviceCode({ fetchImpl: this.deps.fetchImpl, now: this.now() })
    const pending = this.session.start(flow)
    this.lastMessage = `Enter ${pending.userCode} in the browser to finish sign-in.`
    if (this.deps.openExternal) {
      await this.deps.openExternal(pending.verificationUrl).catch(() => undefined)
    }
    return this.status()
  }

  async pollXaiOAuth(): Promise<SettingsSnapshot> {
    const deviceCode = this.session.deviceCode()
    if (!deviceCode) {
      this.lastMessage = 'Start xAI sign-in again.'
      return this.status()
    }
    const result = await pollDeviceCode({
      deviceCode,
      intervalSec: this.session.intervalSec(),
      fetchImpl: this.deps.fetchImpl,
      now: this.now()
    })
    if (result.kind === 'pending') return this.status()
    if (result.kind === 'slow_down') {
      this.session.slowDown()
      return this.status()
    }
    if (result.kind === 'tokens') {
      await this.deps.secrets.writeXaiOAuth(result.tokens)
      this.session.clear()
      await this.activate('xai-oauth')
      return this.validate()
    }
    this.session.clear()
    this.invalidate()
    this.lastMessage = result.message
    return this.status()
  }

  async signOutXaiOAuth(): Promise<SettingsSnapshot> {
    this.session.clear()
    await this.deps.secrets.clearXaiOAuth()
    this.invalidate()
    this.lastMessage = 'Signed out of xAI.'
    return this.status()
  }

  async validate(): Promise<SettingsSnapshot> {
    const provider = await this.readProvider()
    const result = await this.validateActive(provider)
    this.validatedProvider = provider
    this.validatedOk = result.ok
    this.lastMessage = result.message
    return this.status()
  }

  async readAuthForActiveProvider(): Promise<ActiveAuth> {
    const provider = await this.readProvider()
    if (provider !== 'xai-oauth') {
      const auth = resolveActiveAuth({
        provider,
        secrets: await this.secretView(),
        env: this.env()
      })
      if (!auth) throw new Error(providerGateHint(provider))
      return auth
    }
    const tokens = await this.deps.secrets.readXaiOAuth()
    if (!tokens) throw new Error(providerGateHint('xai-oauth'))
    if (!accessNeedsRefresh(tokens, this.now())) {
      return { provider: 'xai-oauth', token: tokens.accessToken }
    }
    const refreshed = await refreshAccessToken({
      tokens,
      fetchImpl: this.deps.fetchImpl,
      now: this.now()
    })
    await this.deps.secrets.writeXaiOAuth(refreshed)
    return { provider: 'xai-oauth', token: refreshed.accessToken }
  }

  private async validateActive(provider: ProviderId): Promise<XaiValidation> {
    try {
      const auth = await this.readAuthForActiveProvider()
      if (provider === 'openai') {
        return validateOpenAiApiKey({ apiKey: auth.token, fetchImpl: this.deps.fetchImpl })
      }
      return validateXaiApiKey({ apiKey: auth.token, fetchImpl: this.deps.fetchImpl })
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Credential check failed.'
      return { ok: false, message }
    }
  }

  private async authStatus(): Promise<ProviderAuthStatus> {
    const bag = await this.deps.secrets.readBag()
    return providerAuthStatus({
      provider: await this.readProvider(),
      secrets: {
        xaiApiKey: bag.xaiApiKey,
        openaiApiKey: bag.openaiApiKey,
        xaiOAuth: Boolean(bag.xaiOAuth)
      },
      env: this.env(),
      oauthPending: Boolean(this.session.current(this.now()))
    })
  }

  private async secretView(): Promise<{
    xaiApiKey: string | null
    openaiApiKey: string | null
    xaiOAuth: boolean
  }> {
    const bag = await this.deps.secrets.readBag()
    return {
      xaiApiKey: bag.xaiApiKey,
      openaiApiKey: bag.openaiApiKey,
      xaiOAuth: Boolean(bag.xaiOAuth)
    }
  }

  private async readProvider(): Promise<ProviderId> {
    return (await readAppSettings(this.deps.userDataDir())).provider
  }

  private async activate(provider: ProviderId): Promise<void> {
    await writeAppSettings(this.deps.userDataDir(), { provider })
  }

  private invalidate(): void {
    this.validatedOk = false
    this.validatedProvider = null
  }

  private env(): NodeJS.ProcessEnv {
    return this.deps.env ?? process.env
  }

  private now(): number {
    return this.deps.now?.() ?? Date.now()
  }
}

export type { PublicOAuthPending }
