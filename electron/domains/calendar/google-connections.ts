import type { GoogleConnection } from '../settings/secret-codec'
import { GOOGLE_DRIVE_SCOPE, MAX_GOOGLE_CONNECTIONS } from './constants'
import { scopeIncludes } from './tokens'

export const GOOGLE_ACCOUNT_CAP_ERROR =
  'Meetrec already has five Google accounts. Disconnect one to connect another.'

export function isProvisionalGoogleId(id: string): boolean {
  return id === 'legacy' || id.startsWith('email:')
}

export function driveConnection(connections: GoogleConnection[]): GoogleConnection | null {
  return connections.find((item) => scopeIncludes(item.scope, GOOGLE_DRIVE_SCOPE)) ?? null
}

export function replaceGoogleConnection(
  connections: GoogleConnection[],
  next: GoogleConnection
): GoogleConnection[] {
  const index = connections.findIndex((item) => item.id === next.id)
  if (index < 0) return connections
  const copy = connections.slice()
  copy[index] = next
  return copy
}

/** Insert or replace by Google user id. `replaceId` drops that card when the signed-in user differs. */
export function applyGoogleSignIn(
  connections: GoogleConnection[],
  next: GoogleConnection,
  replaceId: string | null
): { connections: GoogleConnection[]; droppedId: string | null } {
  const droppedId = replaceId && replaceId !== next.id ? replaceId : null
  const kept = droppedId ? connections.filter((item) => item.id !== droppedId) : connections
  const index = kept.findIndex((item) => item.id === next.id)
  if (index < 0 && kept.length >= MAX_GOOGLE_CONNECTIONS) {
    throw new Error(GOOGLE_ACCOUNT_CAP_ERROR)
  }
  if (index < 0) return { connections: [...kept, next], droppedId }
  const copy = kept.slice()
  copy[index] = next
  return { connections: copy, droppedId }
}

/** Point a migrated `legacy` or `email:` row at the Google user id. */
export function rekeyGoogleConnection(
  connections: GoogleConnection[],
  fromId: string,
  toId: string
): GoogleConnection[] {
  if (fromId === toId) return connections
  const from = connections.find((item) => item.id === fromId)
  if (!from) return connections
  if (connections.some((item) => item.id === toId)) {
    return connections.filter((item) => item.id !== fromId)
  }
  return connections.map((item) => (item.id === fromId ? { ...item, id: toId } : item))
}
