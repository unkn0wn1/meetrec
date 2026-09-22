import { randomBytes } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

const ID_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789'

export function createRecordingId(now: Date = new Date()): string {
  const stamp = now.toISOString().replace(/[:.]/g, '-')
  const suffix = randomBytes(4).toString('hex').slice(0, 6)
  return `${stamp}-${suffix}`
}

export function recordingFileName(id: string): string {
  return `${id}.wav`
}

export function ensureRecordingsDir(dir: string): string {
  mkdirSync(dir, { recursive: true })
  return dir
}

export function buildRecordingPath(recordingsDir: string, now: Date = new Date()): string {
  const id = createRecordingId(now)
  return join(ensureRecordingsDir(recordingsDir), recordingFileName(id))
}

export function isSafeRecordingId(id: string): boolean {
  if (id.length < 8 || id.length > 80) return false
  for (const ch of id) {
    const ok = ID_ALPHABET.includes(ch) || ch === '-' || ch === 'T' || ch === 'Z'
    if (!ok) return false
  }
  return id.endsWith('Z') || id.includes('T')
}
