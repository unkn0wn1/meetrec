import type { CalendarTokenSet, GoogleConnection } from '../settings/secret-codec'
import type { CalendarDeps, CalendarMemory } from './deps'
import {
  OAUTH_CLIENT_MISSING,
  effectiveGoogleClientId,
  effectiveGoogleSecret,
  effectiveMicrosoftClientId
} from './env'
import { driveConnection, replaceGoogleConnection } from './google-connections'
import { removeGoogleConnection } from './google-fetch'
import { refreshGoogleTokens } from './google-oauth'
import { refreshMicrosoftTokens } from './microsoft-oauth'
import { needsRefresh } from './tokens'

/** Google returns the first connection that granted Drive. Microsoft stays the single slot. */
export async function loadAccess(
  deps: CalendarDeps,
  memory: CalendarMemory,
  provider: 'google' | 'microsoft',
  force: boolean
): Promise<string> {
  if (provider === 'microsoft') return loadMicrosoft(deps, memory, force)
  return loadGoogleDrive(deps, memory, force)
}

async function loadGoogleDrive(
  deps: CalendarDeps,
  memory: CalendarMemory,
  force: boolean
): Promise<string> {
  const bag = await deps.secrets.readBag()
  const current = driveConnection(bag.googleConnections)
  if (!current?.refreshToken) throw new Error('Connect again')
  const clientId = effectiveGoogleClientId()
  if (!clientId) throw new Error(OAUTH_CLIENT_MISSING)
  if (!force && !needsRefresh(current, deps.now())) return current.accessToken
  try {
    const refreshed = await refreshGoogleTokens({
      tokens: current,
      clientId,
      clientSecret: effectiveGoogleSecret(),
      fetchImpl: deps.fetchImpl,
      now: deps.now()
    })
    const next = withIdentity(current, refreshed)
    await deps.secrets.update((draft) => {
      draft.googleConnections = replaceGoogleConnection(draft.googleConnections, next)
    })
    return next.accessToken
  } catch {
    await removeGoogleConnection(deps, memory, current.id, 'Connect again')
    throw new Error('Connect again')
  }
}

async function loadMicrosoft(
  deps: CalendarDeps,
  memory: CalendarMemory,
  force: boolean
): Promise<string> {
  const bag = await deps.secrets.readBag()
  const current = bag.microsoftOAuth
  if (!current?.refreshToken) throw new Error('Connect again')
  const clientId = effectiveMicrosoftClientId()
  if (!clientId) throw new Error(OAUTH_CLIENT_MISSING)
  if (!force && !needsRefresh(current, deps.now())) return current.accessToken
  try {
    const refreshed = await refreshMicrosoftTokens({
      tokens: current,
      clientId,
      fetchImpl: deps.fetchImpl,
      now: deps.now()
    })
    const next = { ...refreshed, accountEmail: refreshed.accountEmail ?? current.accountEmail }
    await deps.secrets.update((draft) => {
      if (draft.microsoftOAuth) draft.microsoftOAuth = next
    })
    return next.accessToken
  } catch {
    await deps.secrets.update((draft) => {
      draft.microsoftOAuth = null
    })
    memory.events.microsoft = []
    memory.fetchedAt.microsoft = null
    memory.lists.microsoft = []
    memory.errors.microsoft = 'Connect again'
    throw new Error('Connect again')
  }
}

function withIdentity(current: GoogleConnection, refreshed: CalendarTokenSet): GoogleConnection {
  return {
    ...refreshed,
    id: current.id,
    accountEmail: refreshed.accountEmail ?? current.accountEmail
  }
}
