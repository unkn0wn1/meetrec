import { createHash, randomBytes } from 'node:crypto'

/** 32 random bytes, base64url, no padding (43 characters). */
export function codeVerifier(): string {
  return randomBytes(32).toString('base64url')
}

export function codeChallenge(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url')
}

export function oauthState(): string {
  return randomBytes(32).toString('base64url')
}
