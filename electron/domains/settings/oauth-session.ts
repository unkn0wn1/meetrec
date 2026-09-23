import type { DeviceCodeStart } from '../providers/xai-oauth'

export interface PublicOAuthPending {
  userCode: string
  verificationUrl: string
  intervalSec: number
  expiresAt: number
}

interface PendingFlow extends PublicOAuthPending {
  deviceCode: string
}

export class OAuthSession {
  private pending: PendingFlow | null = null

  start(flow: DeviceCodeStart): PublicOAuthPending {
    this.pending = {
      deviceCode: flow.deviceCode,
      userCode: flow.userCode,
      verificationUrl: flow.verificationUrl,
      intervalSec: flow.intervalSec,
      expiresAt: flow.expiresAt
    }
    return this.publicView()!
  }

  current(now = Date.now()): PublicOAuthPending | null {
    if (!this.pending) return null
    if (now >= this.pending.expiresAt) {
      this.pending = null
      return null
    }
    return this.publicView()
  }

  deviceCode(): string | null {
    return this.pending?.deviceCode ?? null
  }

  intervalSec(): number {
    return this.pending?.intervalSec ?? 5
  }

  slowDown(): void {
    if (!this.pending) return
    this.pending.intervalSec += 5
  }

  clear(): void {
    this.pending = null
  }

  private publicView(): PublicOAuthPending | null {
    if (!this.pending) return null
    return {
      userCode: this.pending.userCode,
      verificationUrl: this.pending.verificationUrl,
      intervalSec: this.pending.intervalSec,
      expiresAt: this.pending.expiresAt
    }
  }
}
