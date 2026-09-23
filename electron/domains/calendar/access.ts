import type { CalendarTokenSet } from '../settings/secret-codec'
import type { CalendarDeps, CalendarMemory } from './deps'
import { effectiveGoogleClientId, effectiveGoogleSecret, effectiveMicrosoftClientId } from './env'
import { refreshGoogleTokens } from './google-oauth'
import { refreshMicrosoftTokens } from './microsoft-oauth'
import { needsRefresh } from './tokens'

export async function loadAccess(
  deps: CalendarDeps,
  memory: CalendarMemory,
  provider: 'google' | 'microsoft',
  force: boolean
): Promise<string> {
  const bag = await deps.secrets.readBag()
  const current = provider === 'google' ? bag.googleOAuth : bag.microsoftOAuth
  if (!current?.refreshToken) throw new Error('Connect again')
  const clientId =
    provider === 'google'
      ? effectiveGoogleClientId(memory.prefs)
      : effectiveMicrosoftClientId(memory.prefs)
  if (!clientId) {
    throw new Error(
      provider === 'google' ? 'Add a Google client id first.' : 'Add a Microsoft client id first.'
    )
  }
  if (!force && !needsRefresh(current, deps.now())) return current.accessToken
  try {
    const refreshed = await refresh(deps, provider, current, clientId, bag.googleClientSecret)
    await deps.secrets.update((draft) => {
      if (provider === 'google') {
        if (draft.googleOAuth) draft.googleOAuth = refreshed
      } else if (draft.microsoftOAuth) draft.microsoftOAuth = refreshed
    })
    return refreshed.accessToken
  } catch {
    await deps.secrets.update((draft) => {
      if (provider === 'google') draft.googleOAuth = null
      else draft.microsoftOAuth = null
    })
    if (provider === 'google') {
      memory.events.google = []
      memory.fetchedAt.google = null
      memory.errors.google = 'Connect again'
    } else {
      memory.events.microsoft = []
      memory.fetchedAt.microsoft = null
      memory.errors.microsoft = 'Connect again'
    }
    throw new Error('Connect again')
  }
}

async function refresh(
  deps: CalendarDeps,
  provider: 'google' | 'microsoft',
  tokens: CalendarTokenSet,
  clientId: string,
  googleSecret: string | null
): Promise<CalendarTokenSet> {
  if (provider === 'google') {
    return refreshGoogleTokens({
      tokens,
      clientId,
      clientSecret: effectiveGoogleSecret(googleSecret),
      fetchImpl: deps.fetchImpl,
      now: deps.now()
    })
  }
  return refreshMicrosoftTokens({
    tokens,
    clientId,
    fetchImpl: deps.fetchImpl,
    now: deps.now()
  })
}
