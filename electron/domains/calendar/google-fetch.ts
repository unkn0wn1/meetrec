import type { GoogleConnection } from '../settings/secret-codec'
import { FETCH_LOOKBEHIND_MS, LOOKAHEAD_MS } from './constants'
import type { CalendarDeps, CalendarMemory } from './deps'
import { OAUTH_CLIENT_MISSING, effectiveGoogleClientId, effectiveGoogleSecret } from './env'
import { listGoogleCalendars } from './google-calendar-list'
import {
  isProvisionalGoogleId,
  rekeyGoogleConnection,
  replaceGoogleConnection
} from './google-connections'
import { CalendarHttpError, listGoogleEvents, type GoogleEventContext } from './google-events'
import { fetchGoogleProfile, refreshGoogleTokens } from './google-oauth'
import {
  dropGoogleCalendarSelection,
  googleCalendarSelection,
  moveGoogleCalendarSelection,
  writePreferences
} from './preferences'
import { defaultListedCalendar, type ListedCalendar } from './selection'
import type { CalendarEvent } from './source'
import { dropGoogleConnectionKeys, dropProviderKeys, writeState } from './state-file'
import { needsRefresh } from './tokens'

export async function fetchGoogleSnapshot(
  deps: CalendarDeps,
  memory: CalendarMemory
): Promise<void> {
  const bag = await deps.secrets.readBag()
  if (bag.googleConnections.length === 0) {
    memory.events.googleByConnection = {}
    memory.fetchedAt.googleByConnection = {}
    memory.lists.google = {}
    memory.accountErrors = {}
    return
  }
  const clientId = effectiveGoogleClientId()
  if (!clientId) {
    memory.errors.google = OAUTH_CLIENT_MISSING
    return
  }
  const secret = effectiveGoogleSecret()
  const now = deps.now()
  const live = new Set<string>()
  for (const connection of bag.googleConnections) {
    const id = await fetchConnection(deps, memory, connection, clientId, secret, now)
    if (id) live.add(id)
  }
  pruneGoogleMemory(memory, live)
}

export async function removeGoogleConnection(
  deps: CalendarDeps,
  memory: CalendarMemory,
  id: string,
  sectionError: string | null
): Promise<void> {
  await deps.secrets.update((draft) => {
    draft.googleConnections = draft.googleConnections.filter((item) => item.id !== id)
  })
  delete memory.events.googleByConnection[id]
  delete memory.fetchedAt.googleByConnection[id]
  delete memory.lists.google[id]
  delete memory.accountErrors[id]
  const remaining = (await deps.secrets.readBag()).googleConnections
  if (remaining.length === 0) {
    memory.events.googleByConnection = {}
    memory.fetchedAt.googleByConnection = {}
    memory.lists.google = {}
    memory.accountErrors = {}
    memory.errors.google = sectionError
    memory.prefs = { ...memory.prefs, googleCalendars: {} }
    memory.runtime = dropProviderKeys(memory.runtime, 'google')
  } else {
    memory.prefs = dropGoogleCalendarSelection(memory.prefs, id)
    memory.runtime = dropGoogleConnectionKeys(memory.runtime, id)
  }
  await writePreferences(deps.userDataDir(), memory.prefs)
  await writeState(deps.userDataDir(), memory.runtime, deps.now())
}

async function fetchConnection(
  deps: CalendarDeps,
  memory: CalendarMemory,
  connection: GoogleConnection,
  clientId: string,
  secret: string | null,
  now: number
): Promise<string | null> {
  let activeId = connection.id
  try {
    const prepared = await prepareConnection(deps, memory, connection)
    if (!prepared) return null
    activeId = prepared.id
    let tokens = prepared
    if (needsRefresh(tokens, now)) {
      tokens = await refreshConnection(deps, memory, tokens, clientId, secret, now)
    }
    const listed = await loadCalendarList(deps, memory, tokens, clientId, secret, now)
    tokens = listed.tokens
    const ids = await selectedIds(deps, memory, tokens.id, listed.list)
    const outcome = await fetchSelected(
      deps,
      memory,
      tokens,
      ids,
      listed.list,
      clientId,
      secret,
      now
    )
    memory.events.googleByConnection[outcome.id] = outcome.events
    if (outcome.fresh) memory.fetchedAt.googleByConnection[outcome.id] = deps.now()
    memory.accountErrors[outcome.id] = outcome.error
    return outcome.id
  } catch (error) {
    if (isConnectAgain(error)) return null
    memory.accountErrors[activeId] =
      error instanceof Error ? error.message : 'Google Calendar could not be loaded.'
    return activeId
  }
}

async function prepareConnection(
  deps: CalendarDeps,
  memory: CalendarMemory,
  connection: GoogleConnection
): Promise<GoogleConnection | null> {
  if (!isProvisionalGoogleId(connection.id)) return connection
  let profile: { id: string | null; email: string | null }
  try {
    profile = await fetchGoogleProfile(connection.accessToken, deps.fetchImpl)
  } catch {
    return connection
  }
  if (!profile.id || profile.id === connection.id) {
    if (!profile.email || profile.email === connection.accountEmail) return connection
    const next = { ...connection, accountEmail: profile.email }
    await deps.secrets.update((draft) => {
      draft.googleConnections = replaceGoogleConnection(draft.googleConnections, next)
    })
    return next
  }
  const fromId = connection.id
  const toId = profile.id
  let dropped = false
  await deps.secrets.update((draft) => {
    dropped = draft.googleConnections.some((item) => item.id === toId)
    draft.googleConnections = rekeyGoogleConnection(draft.googleConnections, fromId, toId).map(
      (item) =>
        item.id === toId ? { ...item, accountEmail: profile.email ?? item.accountEmail } : item
    )
  })
  memory.prefs = moveGoogleCalendarSelection(memory.prefs, fromId, toId)
  await writePreferences(deps.userDataDir(), memory.prefs)
  moveBucket(memory, fromId, toId)
  if (dropped) return null
  const bag = await deps.secrets.readBag()
  return bag.googleConnections.find((item) => item.id === toId) ?? null
}

async function loadCalendarList(
  deps: CalendarDeps,
  memory: CalendarMemory,
  tokens: GoogleConnection,
  clientId: string,
  secret: string | null,
  now: number
): Promise<{ tokens: GoogleConnection; list: ListedCalendar[] }> {
  try {
    const list = await listGoogleCalendars(tokens.accessToken, deps.fetchImpl)
    memory.lists.google[tokens.id] = list
    return { tokens, list }
  } catch (error) {
    if (!(error instanceof CalendarHttpError) || error.status !== 401) {
      return { tokens, list: memory.lists.google[tokens.id] ?? [] }
    }
    const refreshed = await refreshConnection(deps, memory, tokens, clientId, secret, now)
    try {
      const list = await listGoogleCalendars(refreshed.accessToken, deps.fetchImpl)
      memory.lists.google[refreshed.id] = list
      return { tokens: refreshed, list }
    } catch (retry) {
      if (retry instanceof CalendarHttpError && retry.status === 401) {
        await removeGoogleConnection(deps, memory, refreshed.id, 'Connect again')
        throw new Error('Connect again')
      }
      return { tokens: refreshed, list: memory.lists.google[refreshed.id] ?? [] }
    }
  }
}

async function selectedIds(
  deps: CalendarDeps,
  memory: CalendarMemory,
  connectionId: string,
  list: ListedCalendar[]
): Promise<string[]> {
  const stored = googleCalendarSelection(memory.prefs, connectionId)
  if (stored) return stored
  if (list.length === 0) return ['primary']
  const fallback = defaultListedCalendar(list)
  const ids = [fallback?.id ?? 'primary']
  memory.prefs = {
    ...memory.prefs,
    googleCalendars: { ...memory.prefs.googleCalendars, [connectionId]: ids }
  }
  await writePreferences(deps.userDataDir(), memory.prefs)
  return ids
}

async function fetchSelected(
  deps: CalendarDeps,
  memory: CalendarMemory,
  tokens: GoogleConnection,
  ids: string[],
  list: ListedCalendar[],
  clientId: string,
  secret: string | null,
  now: number
): Promise<{ id: string; events: CalendarEvent[]; error: string | null; fresh: boolean }> {
  if (ids.length === 0) return { id: tokens.id, events: [], error: null, fresh: true }
  const from = new Date(now - FETCH_LOOKBEHIND_MS)
  const to = new Date(now + LOOKAHEAD_MS)
  const events: CalendarEvent[] = []
  let error: string | null = null
  let failures = 0
  let current = tokens
  for (const calendarId of ids) {
    const listed = list.find((item) => item.id === calendarId) ?? null
    try {
      const batch = await listOrRefresh(
        deps,
        memory,
        current,
        calendarId,
        contextFor(current, calendarId, listed),
        from,
        to,
        clientId,
        secret,
        now
      )
      current = batch.tokens
      events.push(...batch.events)
    } catch (caught) {
      if (isConnectAgain(caught)) throw caught
      failures += 1
      if (!error) {
        error = caught instanceof Error ? caught.message : 'Google Calendar could not be loaded.'
      }
    }
  }
  const fresh = failures < ids.length
  const previous = memory.events.googleByConnection[current.id] ?? []
  return { id: current.id, events: fresh ? events : previous, error, fresh }
}

async function listOrRefresh(
  deps: CalendarDeps,
  memory: CalendarMemory,
  tokens: GoogleConnection,
  calendarId: string,
  context: GoogleEventContext,
  from: Date,
  to: Date,
  clientId: string,
  secret: string | null,
  now: number
): Promise<{ tokens: GoogleConnection; events: CalendarEvent[] }> {
  try {
    const events = await listGoogleEvents(tokens.accessToken, from, to, deps.fetchImpl, {
      ...context,
      calendarId
    })
    return { tokens, events }
  } catch (error) {
    if (!(error instanceof CalendarHttpError) || error.status !== 401) throw error
    const refreshed = await refreshConnection(deps, memory, tokens, clientId, secret, now)
    try {
      const events = await listGoogleEvents(refreshed.accessToken, from, to, deps.fetchImpl, {
        ...context,
        connectionId: refreshed.id,
        accountEmail: refreshed.accountEmail,
        calendarId
      })
      return { tokens: refreshed, events }
    } catch (retry) {
      if (retry instanceof CalendarHttpError && retry.status === 401) {
        await removeGoogleConnection(deps, memory, refreshed.id, 'Connect again')
        throw new Error('Connect again')
      }
      throw retry
    }
  }
}

async function refreshConnection(
  deps: CalendarDeps,
  memory: CalendarMemory,
  tokens: GoogleConnection,
  clientId: string,
  secret: string | null,
  now: number
): Promise<GoogleConnection> {
  try {
    const refreshed = await refreshGoogleTokens({
      tokens,
      clientId,
      clientSecret: secret,
      fetchImpl: deps.fetchImpl,
      now
    })
    const next: GoogleConnection = {
      ...refreshed,
      id: tokens.id,
      accountEmail: refreshed.accountEmail ?? tokens.accountEmail
    }
    await deps.secrets.update((draft) => {
      draft.googleConnections = replaceGoogleConnection(draft.googleConnections, next)
    })
    return next
  } catch (error) {
    if (isConnectAgain(error)) throw error
    await removeGoogleConnection(deps, memory, tokens.id, 'Connect again')
    throw new Error('Connect again')
  }
}

function contextFor(
  tokens: GoogleConnection,
  calendarId: string,
  listed: ListedCalendar | null
): GoogleEventContext {
  return {
    connectionId: tokens.id,
    calendarId,
    accountEmail: tokens.accountEmail,
    calendarLabel: listed?.summary ?? null,
    calendarPrimary: listed ? listed.primary : calendarId === 'primary'
  }
}

function moveBucket(memory: CalendarMemory, fromId: string, toId: string): void {
  if (fromId === toId) return
  const events = memory.events.googleByConnection[fromId]
  if (events && !memory.events.googleByConnection[toId]) {
    memory.events.googleByConnection[toId] = events
  }
  delete memory.events.googleByConnection[fromId]
  const fetched = memory.fetchedAt.googleByConnection[fromId]
  if (fetched != null && memory.fetchedAt.googleByConnection[toId] == null) {
    memory.fetchedAt.googleByConnection[toId] = fetched
  }
  delete memory.fetchedAt.googleByConnection[fromId]
  const list = memory.lists.google[fromId]
  if (list && !memory.lists.google[toId]) memory.lists.google[toId] = list
  delete memory.lists.google[fromId]
  if (Object.hasOwn(memory.accountErrors, fromId) && !Object.hasOwn(memory.accountErrors, toId)) {
    memory.accountErrors[toId] = memory.accountErrors[fromId] ?? null
  }
  delete memory.accountErrors[fromId]
}

function pruneGoogleMemory(memory: CalendarMemory, live: Set<string>): void {
  for (const id of Object.keys(memory.events.googleByConnection)) {
    if (!live.has(id)) delete memory.events.googleByConnection[id]
  }
  for (const id of Object.keys(memory.fetchedAt.googleByConnection)) {
    if (!live.has(id)) delete memory.fetchedAt.googleByConnection[id]
  }
  for (const id of Object.keys(memory.lists.google)) {
    if (!live.has(id)) delete memory.lists.google[id]
  }
  for (const id of Object.keys(memory.accountErrors)) {
    if (!live.has(id)) delete memory.accountErrors[id]
  }
}

function isConnectAgain(error: unknown): boolean {
  return error instanceof Error && error.message === 'Connect again'
}
