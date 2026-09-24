import { legacyMicrosoftConnectionId, type MicrosoftConnection } from '../settings/secret-codec'
import { MAX_MICROSOFT_CONNECTIONS, MICROSOFT_APPFOLDER_SCOPE } from './constants'
import { scopeIncludes } from './tokens'

export const MICROSOFT_ACCOUNT_CAP_ERROR =
  'Meetrec already has two Microsoft accounts. Disconnect one to connect another.'

export function isProvisionalMicrosoftId(id: string): boolean {
  return id === 'legacy' || id.startsWith('email:')
}

/** OneDrive upload stays on the first connection that granted the app folder. */
export function oneDriveConnection(connections: MicrosoftConnection[]): MicrosoftConnection | null {
  return connections.find((item) => scopeIncludes(item.scope, MICROSOFT_APPFOLDER_SCOPE)) ?? null
}

/** Graph user id when the profile has one, otherwise the legacy email id. */
export function microsoftConnectionId(profile: {
  id: string | null
  email: string | null
}): string | null {
  const id = profile.id?.trim() || null
  if (id) return id
  if (profile.email) return legacyMicrosoftConnectionId(profile.email)
  return null
}

export function replaceMicrosoftConnection(
  connections: MicrosoftConnection[],
  next: MicrosoftConnection
): MicrosoftConnection[] {
  const index = connections.findIndex((item) => item.id === next.id)
  if (index < 0) return connections
  const copy = connections.slice()
  copy[index] = next
  return copy
}

/** Insert or replace by Microsoft user id. `replaceId` drops that card when the signed-in user differs. */
export function applyMicrosoftSignIn(
  connections: MicrosoftConnection[],
  next: MicrosoftConnection,
  replaceId: string | null
): { connections: MicrosoftConnection[]; droppedId: string | null } {
  const droppedId = replaceId && replaceId !== next.id ? replaceId : null
  const kept = droppedId ? connections.filter((item) => item.id !== droppedId) : connections
  const index = kept.findIndex((item) => item.id === next.id)
  if (index < 0 && kept.length >= MAX_MICROSOFT_CONNECTIONS) {
    throw new Error(MICROSOFT_ACCOUNT_CAP_ERROR)
  }
  if (index < 0) return { connections: [...kept, next], droppedId }
  const copy = kept.slice()
  copy[index] = next
  return { connections: copy, droppedId }
}

/** Point a migrated `legacy` or `email:` row at the Graph user id. */
export function rekeyMicrosoftConnection(
  connections: MicrosoftConnection[],
  fromId: string,
  toId: string
): MicrosoftConnection[] {
  if (fromId === toId) return connections
  const from = connections.find((item) => item.id === fromId)
  if (!from) return connections
  if (connections.some((item) => item.id === toId)) {
    return connections.filter((item) => item.id !== fromId)
  }
  return connections.map((item) => (item.id === fromId ? { ...item, id: toId } : item))
}

/** Fold a migrated email row into the Graph user id before applying that sign-in. */
export function prepareMicrosoftSignIn(
  connections: MicrosoftConnection[],
  next: MicrosoftConnection
): { connections: MicrosoftConnection[]; rekeyedFrom: string | null } {
  if (isProvisionalMicrosoftId(next.id) || !next.accountEmail) {
    return { connections, rekeyedFrom: null }
  }
  const email = next.accountEmail.toLowerCase()
  const provisional = connections.find(
    (item) =>
      item.id !== next.id &&
      isProvisionalMicrosoftId(item.id) &&
      item.accountEmail?.toLowerCase() === email
  )
  if (!provisional) return { connections, rekeyedFrom: null }
  return {
    connections: rekeyMicrosoftConnection(connections, provisional.id, next.id),
    rekeyedFrom: provisional.id
  }
}
