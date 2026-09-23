import type { CalendarTokenSet } from '../settings/secret-codec'
import { FETCH_LOOKBEHIND_MS, LOOKAHEAD_MS, SNAPSHOT_MAX_AGE_MS } from './constants'
import type { CalendarDeps, CalendarMemory } from './deps'
import {
  OAUTH_CLIENT_MISSING,
  effectiveGoogleClientId,
  effectiveGoogleSecret,
  effectiveMicrosoftClientId
} from './env'
import { CalendarHttpError, listGoogleEvents } from './google-events'
import { refreshGoogleTokens } from './google-oauth'
import { listMicrosoftEvents } from './microsoft-events'
import { refreshMicrosoftTokens } from './microsoft-oauth'
import { mergeEvents } from './schedule'
import type { CalendarEvent } from './source'
import { needsRefresh } from './tokens'

export async function fetchGoogleSnapshot(
  deps: CalendarDeps,
  memory: CalendarMemory
): Promise<void> {
  const now = deps.now()
  const bag = await deps.secrets.readBag()
  const tokens = bag.googleOAuth
  if (!tokens?.refreshToken) {
    memory.events.google = []
    memory.fetchedAt.google = null
    return
  }
  const clientId = effectiveGoogleClientId()
  if (!clientId) {
    memory.errors.google = OAUTH_CLIENT_MISSING
    return
  }
  const secret = effectiveGoogleSecret()
  try {
    let current = tokens
    if (needsRefresh(current, now)) {
      current = await refreshOrDisconnect(deps, current, clientId, secret, now)
    }
    memory.events.google = await listOrRefresh(deps, current, clientId, secret, now)
    memory.fetchedAt.google = deps.now()
    memory.errors.google = null
  } catch (error) {
    if (isConnectAgain(error)) {
      await forgetGoogle(deps, memory)
      return
    }
    memory.errors.google =
      error instanceof Error ? error.message : 'Google Calendar could not be loaded.'
  }
}

export function cachedEvents(memory: CalendarMemory): CalendarEvent[] {
  return mergeEvents([memory.events.google, memory.events.microsoft])
}

export function freshEvents(
  memory: CalendarMemory,
  now: number
): {
  events: CalendarEvent[]
  snapshotAt: number | null
} {
  const groups: CalendarEvent[][] = []
  let snapshotAt: number | null = null
  for (const id of ['google', 'microsoft'] as const) {
    const fetchedAt = memory.fetchedAt[id]
    if (fetchedAt == null || now - fetchedAt > SNAPSHOT_MAX_AGE_MS) continue
    groups.push(memory.events[id])
    snapshotAt = snapshotAt == null ? fetchedAt : Math.min(snapshotAt, fetchedAt)
  }
  return { events: mergeEvents(groups), snapshotAt }
}

async function listOrRefresh(
  deps: CalendarDeps,
  tokens: CalendarTokenSet,
  clientId: string,
  secret: string | null,
  now: number
): Promise<CalendarEvent[]> {
  const from = new Date(now - FETCH_LOOKBEHIND_MS)
  const to = new Date(now + LOOKAHEAD_MS)
  try {
    return await listGoogleEvents(tokens.accessToken, from, to, deps.fetchImpl)
  } catch (error) {
    if (!(error instanceof CalendarHttpError) || error.status !== 401) throw error
    const refreshed = await refreshOrDisconnect(deps, tokens, clientId, secret, now)
    return listGoogleEvents(refreshed.accessToken, from, to, deps.fetchImpl)
  }
}

async function refreshOrDisconnect(
  deps: CalendarDeps,
  tokens: CalendarTokenSet,
  clientId: string,
  secret: string | null,
  now: number
): Promise<CalendarTokenSet> {
  try {
    const refreshed = await refreshGoogleTokens({
      tokens,
      clientId,
      clientSecret: secret,
      fetchImpl: deps.fetchImpl,
      now
    })
    await deps.secrets.update((bag) => {
      if (!bag.googleOAuth) return
      bag.googleOAuth = refreshed
    })
    return refreshed
  } catch {
    throw new Error('Connect again')
  }
}

async function forgetGoogle(deps: CalendarDeps, memory: CalendarMemory): Promise<void> {
  await deps.secrets.update((bag) => {
    bag.googleOAuth = null
  })
  memory.events.google = []
  memory.fetchedAt.google = null
  memory.errors.google = 'Connect again'
}

function isConnectAgain(error: unknown): boolean {
  return error instanceof Error && error.message === 'Connect again'
}

export async function fetchMicrosoftSnapshot(
  deps: CalendarDeps,
  memory: CalendarMemory
): Promise<void> {
  const now = deps.now()
  const bag = await deps.secrets.readBag()
  const tokens = bag.microsoftOAuth
  if (!tokens?.refreshToken) {
    memory.events.microsoft = []
    memory.fetchedAt.microsoft = null
    return
  }
  const clientId = effectiveMicrosoftClientId()
  if (!clientId) {
    memory.errors.microsoft = OAUTH_CLIENT_MISSING
    return
  }
  try {
    let current = tokens
    if (needsRefresh(current, now)) {
      current = await refreshMicrosoftOrDisconnect(deps, current, clientId, now)
    }
    const from = new Date(now - FETCH_LOOKBEHIND_MS)
    const to = new Date(now + LOOKAHEAD_MS)
    try {
      memory.events.microsoft = await listMicrosoftEvents(
        current.accessToken,
        from,
        to,
        deps.fetchImpl
      )
    } catch (error) {
      if (!(error instanceof CalendarHttpError) || error.status !== 401) throw error
      current = await refreshMicrosoftOrDisconnect(deps, current, clientId, now)
      memory.events.microsoft = await listMicrosoftEvents(
        current.accessToken,
        from,
        to,
        deps.fetchImpl
      )
    }
    memory.fetchedAt.microsoft = deps.now()
    memory.errors.microsoft = null
  } catch (error) {
    if (isConnectAgain(error)) {
      await deps.secrets.update((draft) => {
        draft.microsoftOAuth = null
      })
      memory.events.microsoft = []
      memory.fetchedAt.microsoft = null
      memory.errors.microsoft = 'Connect again'
      return
    }
    memory.errors.microsoft =
      error instanceof Error ? error.message : 'Microsoft Calendar could not be loaded.'
  }
}

async function refreshMicrosoftOrDisconnect(
  deps: CalendarDeps,
  tokens: CalendarTokenSet,
  clientId: string,
  now: number
): Promise<CalendarTokenSet> {
  try {
    const refreshed = await refreshMicrosoftTokens({
      tokens,
      clientId,
      fetchImpl: deps.fetchImpl,
      now
    })
    await deps.secrets.update((bag) => {
      if (!bag.microsoftOAuth) return
      bag.microsoftOAuth = refreshed
    })
    return refreshed
  } catch {
    throw new Error('Connect again')
  }
}
