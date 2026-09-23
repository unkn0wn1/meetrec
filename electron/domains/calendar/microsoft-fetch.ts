import type { CalendarTokenSet } from '../settings/secret-codec'
import { FETCH_LOOKBEHIND_MS, LOOKAHEAD_MS } from './constants'
import type { CalendarDeps, CalendarMemory } from './deps'
import { OAUTH_CLIENT_MISSING, effectiveMicrosoftClientId } from './env'
import { CalendarHttpError } from './google-events'
import { listMicrosoftCalendars } from './microsoft-calendars'
import { listMicrosoftEvents, type MicrosoftEventContext } from './microsoft-events'
import { refreshMicrosoftTokens } from './microsoft-oauth'
import { writePreferences } from './preferences'
import { defaultListedCalendar, type ListedCalendar } from './selection'
import type { CalendarEvent } from './source'
import { needsRefresh } from './tokens'

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
    memory.lists.microsoft = []
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
      current = await refreshOrDisconnect(deps, memory, current, clientId, now)
    }
    const list = await loadList(deps, memory, current, clientId, now)
    current = list.tokens
    const ids = await selectedIds(deps, memory, list.list)
    const outcome = await fetchSelected(deps, memory, current, ids, list.list, clientId, now)
    if (outcome.fresh) {
      memory.events.microsoft = outcome.events
      memory.fetchedAt.microsoft = deps.now()
    }
    memory.errors.microsoft = outcome.error
  } catch (error) {
    if (isConnectAgain(error)) return
    memory.errors.microsoft =
      error instanceof Error ? error.message : 'Microsoft Calendar could not be loaded.'
  }
}

async function loadList(
  deps: CalendarDeps,
  memory: CalendarMemory,
  tokens: CalendarTokenSet,
  clientId: string,
  now: number
): Promise<{ tokens: CalendarTokenSet; list: ListedCalendar[] }> {
  try {
    const list = await listMicrosoftCalendars(tokens.accessToken, deps.fetchImpl)
    memory.lists.microsoft = list
    return { tokens, list }
  } catch (error) {
    if (!(error instanceof CalendarHttpError) || error.status !== 401) {
      return { tokens, list: memory.lists.microsoft }
    }
    const refreshed = await refreshOrDisconnect(deps, memory, tokens, clientId, now)
    try {
      const list = await listMicrosoftCalendars(refreshed.accessToken, deps.fetchImpl)
      memory.lists.microsoft = list
      return { tokens: refreshed, list }
    } catch (retry) {
      if (retry instanceof CalendarHttpError && retry.status === 401) {
        await forgetMicrosoft(deps, memory)
        throw new Error('Connect again')
      }
      return { tokens: refreshed, list: memory.lists.microsoft }
    }
  }
}

async function selectedIds(
  deps: CalendarDeps,
  memory: CalendarMemory,
  list: ListedCalendar[]
): Promise<string[]> {
  const stored = memory.prefs.microsoftCalendarIds
  if (stored) return stored
  if (list.length === 0) return []
  const fallback = defaultListedCalendar(list)
  if (!fallback) return []
  memory.prefs = { ...memory.prefs, microsoftCalendarIds: [fallback.id] }
  await writePreferences(deps.userDataDir(), memory.prefs)
  return [fallback.id]
}

async function fetchSelected(
  deps: CalendarDeps,
  memory: CalendarMemory,
  tokens: CalendarTokenSet,
  ids: string[],
  list: ListedCalendar[],
  clientId: string,
  now: number
): Promise<{ events: CalendarEvent[]; error: string | null; fresh: boolean }> {
  const from = new Date(now - FETCH_LOOKBEHIND_MS)
  const to = new Date(now + LOOKAHEAD_MS)
  if (ids.length === 0 && memory.prefs.microsoftCalendarIds == null) {
    const batch = await listOrRefresh(deps, memory, tokens, from, to, clientId, now)
    return { events: batch.events, error: null, fresh: true }
  }
  const events: CalendarEvent[] = []
  let error: string | null = null
  let failures = 0
  let current = tokens
  for (const calendarId of ids) {
    const listed = list.find((item) => item.id === calendarId) ?? null
    const context: MicrosoftEventContext = {
      calendarId,
      accountEmail: current.accountEmail,
      calendarLabel: listed?.summary ?? null,
      calendarPrimary: listed ? listed.primary : false
    }
    try {
      const batch = await listOrRefresh(deps, memory, current, from, to, clientId, now, context)
      current = batch.tokens
      events.push(...batch.events)
    } catch (caught) {
      if (isConnectAgain(caught)) throw caught
      failures += 1
      if (!error) {
        error = caught instanceof Error ? caught.message : 'Microsoft Calendar could not be loaded.'
      }
    }
  }
  const fresh = ids.length === 0 || failures < ids.length
  return { events: fresh ? events : memory.events.microsoft, error, fresh }
}

async function listOrRefresh(
  deps: CalendarDeps,
  memory: CalendarMemory,
  tokens: CalendarTokenSet,
  from: Date,
  to: Date,
  clientId: string,
  now: number,
  context?: MicrosoftEventContext
): Promise<{ tokens: CalendarTokenSet; events: CalendarEvent[] }> {
  try {
    const events = await listMicrosoftEvents(tokens.accessToken, from, to, deps.fetchImpl, context)
    return { tokens, events }
  } catch (error) {
    if (!(error instanceof CalendarHttpError) || error.status !== 401) throw error
    const refreshed = await refreshOrDisconnect(deps, memory, tokens, clientId, now)
    try {
      const events = await listMicrosoftEvents(
        refreshed.accessToken,
        from,
        to,
        deps.fetchImpl,
        context ? { ...context, accountEmail: refreshed.accountEmail } : undefined
      )
      return { tokens: refreshed, events }
    } catch (retry) {
      if (retry instanceof CalendarHttpError && retry.status === 401) {
        await forgetMicrosoft(deps, memory)
        throw new Error('Connect again')
      }
      throw retry
    }
  }
}

async function refreshOrDisconnect(
  deps: CalendarDeps,
  memory: CalendarMemory,
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
    await deps.secrets.update((draft) => {
      if (!draft.microsoftOAuth) return
      draft.microsoftOAuth = {
        ...refreshed,
        accountEmail: refreshed.accountEmail ?? tokens.accountEmail
      }
    })
    return { ...refreshed, accountEmail: refreshed.accountEmail ?? tokens.accountEmail }
  } catch (error) {
    if (isConnectAgain(error)) throw error
    await forgetMicrosoft(deps, memory)
    throw new Error('Connect again')
  }
}

async function forgetMicrosoft(deps: CalendarDeps, memory: CalendarMemory): Promise<void> {
  await deps.secrets.update((draft) => {
    draft.microsoftOAuth = null
  })
  memory.events.microsoft = []
  memory.fetchedAt.microsoft = null
  memory.lists.microsoft = []
  memory.errors.microsoft = 'Connect again'
  memory.prefs = { ...memory.prefs, microsoftCalendarIds: null }
  await writePreferences(deps.userDataDir(), memory.prefs)
}

function isConnectAgain(error: unknown): boolean {
  return error instanceof Error && error.message === 'Connect again'
}
