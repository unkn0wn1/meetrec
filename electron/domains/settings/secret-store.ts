import { chmod, readFile, unlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import {
  PLAIN_MAGIC,
  SECRET_MAGIC,
  decodeSecretBag,
  emptySecretBag,
  encodeSecretBag,
  type OAuthTokenSet,
  type SecretBag
} from './secret-codec'

export interface SafeStorageLike {
  isEncryptionAvailable(): boolean
  encryptString(plain: string): Buffer
  decryptString(encrypted: Buffer): string
}

export interface SecretStoreDeps {
  userDataDir: () => string
  safeStorage: SafeStorageLike
  warn?: (message: string) => void
}

export class SecretStore {
  private warnedPlain = false
  private chain: Promise<void> = Promise.resolve()

  constructor(private readonly deps: SecretStoreDeps) {}

  /** Serialize read-modify-write so a token refresh cannot clobber a key save. */
  async update(mutator: (bag: SecretBag) => void): Promise<{ encrypted: boolean }> {
    return this.enqueue(async () => {
      const bag = await this.readBag()
      mutator(bag)
      return this.writeBagUnlocked(bag)
    })
  }

  private enqueue<T>(work: () => Promise<T>): Promise<T> {
    const run = this.chain.then(work, work)
    this.chain = run.then(
      () => undefined,
      () => undefined
    )
    return run
  }

  filePath(): string {
    return join(this.deps.userDataDir(), 'secrets.bin')
  }

  async readBag(): Promise<SecretBag> {
    let bytes: Buffer
    try {
      bytes = await readFile(this.filePath())
    } catch {
      return emptySecretBag()
    }
    return this.decode(bytes) ?? emptySecretBag()
  }

  async writeBag(bag: SecretBag): Promise<{ encrypted: boolean }> {
    return this.enqueue(() => this.writeBagUnlocked(bag))
  }

  private async writeBagUnlocked(bag: SecretBag): Promise<{ encrypted: boolean }> {
    if (!bagHasSecret(bag)) {
      await unlink(this.filePath()).catch(() => undefined)
      return { encrypted: this.deps.safeStorage.isEncryptionAvailable() }
    }
    return this.writeRaw(encodeSecretBag(bag))
  }

  async readXaiApiKey(): Promise<string | null> {
    return (await this.readBag()).xaiApiKey
  }

  async writeXaiApiKey(key: string): Promise<{ encrypted: boolean }> {
    const trimmed = key.trim()
    if (!trimmed) throw new Error('Enter an xAI API key before saving.')
    return this.update((bag) => {
      bag.xaiApiKey = trimmed
    })
  }

  async clearXaiApiKey(): Promise<void> {
    await this.update((bag) => {
      bag.xaiApiKey = null
    })
  }

  async readOpenAiApiKey(): Promise<string | null> {
    return (await this.readBag()).openaiApiKey
  }

  async writeOpenAiApiKey(key: string): Promise<{ encrypted: boolean }> {
    const trimmed = key.trim()
    if (!trimmed) throw new Error('Enter an OpenAI API key before saving.')
    return this.update((bag) => {
      bag.openaiApiKey = trimmed
    })
  }

  async clearOpenAiApiKey(): Promise<void> {
    await this.update((bag) => {
      bag.openaiApiKey = null
    })
  }

  async readXaiOAuth(): Promise<OAuthTokenSet | null> {
    return (await this.readBag()).xaiOAuth
  }

  async writeXaiOAuth(tokens: OAuthTokenSet): Promise<{ encrypted: boolean }> {
    if (!tokens.accessToken.trim() || !tokens.refreshToken.trim()) {
      throw new Error('xAI sign-in did not return tokens.')
    }
    return this.update((bag) => {
      bag.xaiOAuth = tokens
    })
  }

  async clearXaiOAuth(): Promise<void> {
    await this.update((bag) => {
      bag.xaiOAuth = null
    })
  }

  private async writeRaw(payload: string): Promise<{ encrypted: boolean }> {
    const encrypted = this.deps.safeStorage.isEncryptionAvailable()
    const body = encrypted
      ? this.deps.safeStorage.encryptString(payload)
      : Buffer.from(payload, 'utf8')
    if (!encrypted) this.warnPlaintext()
    const magic = Buffer.from(encrypted ? SECRET_MAGIC : PLAIN_MAGIC, 'utf8')
    const file = Buffer.concat([magic, Buffer.from([0]), body])
    await writeFile(this.filePath(), file, { mode: 0o600 })
    await chmod(this.filePath(), 0o600).catch(() => undefined)
    return { encrypted }
  }

  private decode(bytes: Buffer): SecretBag | null {
    const marker = bytes.indexOf(0)
    if (marker <= 0) return null
    const magic = bytes.subarray(0, marker).toString('utf8')
    const body = bytes.subarray(marker + 1)
    if (magic === SECRET_MAGIC) {
      if (!this.deps.safeStorage.isEncryptionAvailable()) return null
      try {
        return decodeSecretBag(this.deps.safeStorage.decryptString(body))
      } catch {
        return null
      }
    }
    if (magic === PLAIN_MAGIC) {
      this.warnPlaintext()
      return decodeSecretBag(body.toString('utf8'))
    }
    return null
  }

  private warnPlaintext(): void {
    if (this.warnedPlain) return
    this.warnedPlain = true
    this.deps.warn?.(
      'OS encryption is unavailable. Provider secrets are stored in the user-data folder without safeStorage. They are still kept out of the renderer.'
    )
  }
}

function bagHasSecret(bag: SecretBag): boolean {
  return Boolean(
    bag.xaiApiKey ||
    bag.openaiApiKey ||
    bag.xaiOAuth ||
    bag.googleClientSecret ||
    bag.googleConnections.length > 0 ||
    bag.microsoftConnections.length > 0
  )
}
