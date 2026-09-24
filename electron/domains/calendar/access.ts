import type { CalendarTokenSet } from '../settings/secret-codec'
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
import { oneDriveConnection, replaceMicrosoftConnection } from './microsoft-connections'
import { removeMicrosoftConnection } from './microsoft-fetch'
import { refreshMicrosoftTokens } from './microsoft-oauth'
import { needsRefresh } from './tokens'

/** Drive and OneDrive each use the first connection that granted that upload scope. */
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
  const current = oneDriveConnection(bag.microsoftConnections)
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
    const next = withIdentity(current, refreshed)
    await deps.secrets.update((draft) => {
      draft.microsoftConnections = replaceMicrosoftConnection(draft.microsoftConnections, next)
    })
    return next.accessToken
  } catch {
    await removeMicrosoftConnection(deps, memory, current.id, 'Connect again')
    throw new Error('Connect again')
  }
}

function withIdentity<T extends { id: string; accountEmail: string | null }>(
  current: T,
  refreshed: CalendarTokenSet
): T {
  return {
    ...current,
    ...refreshed,
    id: current.id,
    accountEmail: refreshed.accountEmail ?? current.accountEmail
  }
}
