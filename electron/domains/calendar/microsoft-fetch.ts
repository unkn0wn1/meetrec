import type { MicrosoftConnection } from '../settings/secret-codec'
import { FETCH_LOOKBEHIND_MS, LOOKAHEAD_MS } from './constants'
import type { CalendarDeps, CalendarMemory } from './deps'
import { OAUTH_CLIENT_MISSING, effectiveMicrosoftClientId } from './env'
import { CalendarHttpError } from './google-events'
import { listMicrosoftCalendars } from './microsoft-calendars'
import {
  isProvisionalMicrosoftId,
  rekeyMicrosoftConnection,
  replaceMicrosoftConnection
} from './microsoft-connections'
import { listMicrosoftEvents, type MicrosoftEventContext } from './microsoft-events'
import { fetchMicrosoftProfile, refreshMicrosoftTokens } from './microsoft-oauth'
import {
  adoptFlatMicrosoftCalendars,
  dropMicrosoftCalendarSelection,
  microsoftCalendarSelection,
  moveMicrosoftCalendarSelection,
  writePreferences
} from './preferences'
import { defaultListedCalendar, type ListedCalendar } from './selection'
import type { CalendarEvent } from './source'
import { dropConnectionKeys, dropProviderKeys, writeState } from './state-file'
import { needsRefresh } from './tokens'

export async function fetchMicrosoftSnapshot(
  deps: CalendarDeps,
  memory: CalendarMemory
): Promise<void> {
  const bag = await deps.secrets.readBag()
  if (bag.microsoftConnections.length === 0) {
    memory.events.microsoftByConnection = {}
    memory.fetchedAt.microsoftByConnection = {}
    memory.lists.microsoft = {}
    memory.microsoftAccountErrors = {}
    return
  }
  const clientId = effectiveMicrosoftClientId()
  if (!clientId) {
    memory.errors.microsoft = OAUTH_CLIENT_MISSING
    return
  }
  await adoptCalendars(deps, memory, bag.microsoftConnections[0]?.id ?? null)
  const now = deps.now()
  const live = new Set<string>()
  for (const connection of bag.microsoftConnections) {
    const id = await fetchConnection(deps, memory, connection, clientId, now)
    if (id) live.add(id)
  }
  pruneMicrosoftMemory(memory, live)
}

export async function removeMicrosoftConnection(
  deps: CalendarDeps,
  memory: CalendarMemory,
  id: string,
  sectionError: string | null
): Promise<void> {
  await deps.secrets.update((draft) => {
    draft.microsoftConnections = draft.microsoftConnections.filter((item) => item.id !== id)
  })
  delete memory.events.microsoftByConnection[id]
  delete memory.fetchedAt.microsoftByConnection[id]
  delete memory.lists.microsoft[id]
  delete memory.microsoftAccountErrors[id]
  const remaining = (await deps.secrets.readBag()).microsoftConnections
  if (remaining.length === 0) {
    memory.events.microsoftByConnection = {}
    memory.fetchedAt.microsoftByConnection = {}
    memory.lists.microsoft = {}
    memory.microsoftAccountErrors = {}
    memory.errors.microsoft = sectionError
    memory.prefs = { ...memory.prefs, microsoftCalendars: {}, microsoftCalendarIds: null }
    memory.runtime = dropProviderKeys(memory.runtime, 'microsoft')
  } else {
    memory.prefs = dropMicrosoftCalendarSelection(memory.prefs, id)
    memory.runtime = dropConnectionKeys(memory.runtime, 'microsoft', id)
  }
  await writePreferences(deps.userDataDir(), memory.prefs)
  await writeState(deps.userDataDir(), memory.runtime, deps.now())
}

export function moveMicrosoftBucket(memory: CalendarMemory, fromId: string, toId: string): void {
  if (fromId === toId) return
  const events = memory.events.microsoftByConnection[fromId]
  if (events && !memory.events.microsoftByConnection[toId]) {
    memory.events.microsoftByConnection[toId] = events
  }
  delete memory.events.microsoftByConnection[fromId]
  const fetched = memory.fetchedAt.microsoftByConnection[fromId]
  if (fetched != null && memory.fetchedAt.microsoftByConnection[toId] == null) {
    memory.fetchedAt.microsoftByConnection[toId] = fetched
  }
  delete memory.fetchedAt.microsoftByConnection[fromId]
  const list = memory.lists.microsoft[fromId]
  if (list && !memory.lists.microsoft[toId]) memory.lists.microsoft[toId] = list
  delete memory.lists.microsoft[fromId]
  if (
    Object.hasOwn(memory.microsoftAccountErrors, fromId) &&
    !Object.hasOwn(memory.microsoftAccountErrors, toId)
  ) {
    memory.microsoftAccountErrors[toId] = memory.microsoftAccountErrors[fromId] ?? null
  }
  delete memory.microsoftAccountErrors[fromId]
}

async function adoptCalendars(
  deps: CalendarDeps,
  memory: CalendarMemory,
  connectionId: string | null
): Promise<void> {
  if (!connectionId) return
  const next = adoptFlatMicrosoftCalendars(memory.prefs, connectionId)
  if (next === memory.prefs) return
  memory.prefs = next
  await writePreferences(deps.userDataDir(), memory.prefs)
}

async function fetchConnection(
  deps: CalendarDeps,
  memory: CalendarMemory,
  connection: MicrosoftConnection,
  clientId: string,
  now: number
): Promise<string | null> {
  let activeId = connection.id
  try {
    const prepared = await prepareConnection(deps, memory, connection)
    if (!prepared) return null
    activeId = prepared.id
    let tokens = prepared
    if (needsRefresh(tokens, now)) {
      tokens = await refreshConnection(deps, memory, tokens, clientId, now)
    }
    const listed = await loadCalendarList(deps, memory, tokens, clientId, now)
    tokens = listed.tokens
    const ids = await selectedIds(deps, memory, tokens.id, listed.list)
    const outcome = await fetchSelected(deps, memory, tokens, ids, listed.list, clientId, now)
    memory.events.microsoftByConnection[outcome.id] = outcome.events
    if (outcome.fresh) memory.fetchedAt.microsoftByConnection[outcome.id] = deps.now()
    memory.microsoftAccountErrors[outcome.id] = outcome.error
    return outcome.id
  } catch (error) {
    if (isConnectAgain(error)) return null
    memory.microsoftAccountErrors[activeId] =
      error instanceof Error ? error.message : 'Microsoft Calendar could not be loaded.'
    return activeId
  }
}

async function prepareConnection(
  deps: CalendarDeps,
  memory: CalendarMemory,
  connection: MicrosoftConnection
): Promise<MicrosoftConnection | null> {
  if (!isProvisionalMicrosoftId(connection.id)) return connection
  let profile: { id: string | null; email: string | null }
  try {
    profile = await fetchMicrosoftProfile(connection.accessToken, deps.fetchImpl)
  } catch {
    return connection
  }
  if (!profile.id || profile.id === connection.id) {
    if (!profile.email || profile.email === connection.accountEmail) return connection
    const next = { ...connection, accountEmail: profile.email }
    await deps.secrets.update((draft) => {
      draft.microsoftConnections = replaceMicrosoftConnection(draft.microsoftConnections, next)
    })
    return next
  }
  const fromId = connection.id
  const toId = profile.id
  let dropped = false
  await deps.secrets.update((draft) => {
    dropped = draft.microsoftConnections.some((item) => item.id === toId)
    draft.microsoftConnections = rekeyMicrosoftConnection(
      draft.microsoftConnections,
      fromId,
      toId
    ).map((item) =>
      item.id === toId ? { ...item, accountEmail: profile.email ?? item.accountEmail } : item
    )
  })
  memory.prefs = moveMicrosoftCalendarSelection(memory.prefs, fromId, toId)
  await writePreferences(deps.userDataDir(), memory.prefs)
  moveMicrosoftBucket(memory, fromId, toId)
  if (dropped) return null
  const bag = await deps.secrets.readBag()
  return bag.microsoftConnections.find((item) => item.id === toId) ?? null
}

async function loadCalendarList(
  deps: CalendarDeps,
  memory: CalendarMemory,
  tokens: MicrosoftConnection,
  clientId: string,
  now: number
): Promise<{ tokens: MicrosoftConnection; list: ListedCalendar[] }> {
  try {
    const list = await listMicrosoftCalendars(tokens.accessToken, deps.fetchImpl)
    memory.lists.microsoft[tokens.id] = list
    return { tokens, list }
  } catch (error) {
    if (!(error instanceof CalendarHttpError) || error.status !== 401) {
      return { tokens, list: memory.lists.microsoft[tokens.id] ?? [] }
    }
    const refreshed = await refreshConnection(deps, memory, tokens, clientId, now)
    try {
      const list = await listMicrosoftCalendars(refreshed.accessToken, deps.fetchImpl)
      memory.lists.microsoft[refreshed.id] = list
      return { tokens: refreshed, list }
    } catch (retry) {
      if (retry instanceof CalendarHttpError && retry.status === 401) {
        await removeMicrosoftConnection(deps, memory, refreshed.id, 'Connect again')
        throw new Error('Connect again')
      }
      return { tokens: refreshed, list: memory.lists.microsoft[refreshed.id] ?? [] }
    }
  }
}

async function selectedIds(
  deps: CalendarDeps,
  memory: CalendarMemory,
  connectionId: string,
  list: ListedCalendar[]
): Promise<string[]> {
  const stored = microsoftCalendarSelection(memory.prefs, connectionId)
  if (stored) return stored
  if (list.length === 0) return []
  const fallback = defaultListedCalendar(list)
  if (!fallback) return []
  memory.prefs = {
    ...memory.prefs,
    microsoftCalendars: { ...memory.prefs.microsoftCalendars, [connectionId]: [fallback.id] }
  }
  await writePreferences(deps.userDataDir(), memory.prefs)
  return [fallback.id]
}

async function fetchSelected(
  deps: CalendarDeps,
  memory: CalendarMemory,
  tokens: MicrosoftConnection,
  ids: string[],
  list: ListedCalendar[],
  clientId: string,
  now: number
): Promise<{ id: string; events: CalendarEvent[]; error: string | null; fresh: boolean }> {
  const from = new Date(now - FETCH_LOOKBEHIND_MS)
  const to = new Date(now + LOOKAHEAD_MS)
  const chosen = microsoftCalendarSelection(memory.prefs, tokens.id)
  if (ids.length === 0 && chosen === undefined) {
    const batch = await listOrRefresh(deps, memory, tokens, from, to, clientId, now)
    return { id: batch.tokens.id, events: batch.events, error: null, fresh: true }
  }
  if (ids.length === 0) return { id: tokens.id, events: [], error: null, fresh: true }
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
        from,
        to,
        clientId,
        now,
        contextFor(current, calendarId, listed)
      )
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
  const fresh = failures < ids.length
  const previous = memory.events.microsoftByConnection[current.id] ?? []
  return { id: current.id, events: fresh ? events : previous, error, fresh }
}

async function listOrRefresh(
  deps: CalendarDeps,
  memory: CalendarMemory,
  tokens: MicrosoftConnection,
  from: Date,
  to: Date,
  clientId: string,
  now: number,
  context?: MicrosoftEventContext
): Promise<{ tokens: MicrosoftConnection; events: CalendarEvent[] }> {
  try {
    const events = await listMicrosoftEvents(tokens.accessToken, from, to, deps.fetchImpl, context)
    return { tokens, events }
  } catch (error) {
    if (!(error instanceof CalendarHttpError) || error.status !== 401) throw error
    const refreshed = await refreshConnection(deps, memory, tokens, clientId, now)
    try {
      const events = await listMicrosoftEvents(
        refreshed.accessToken,
        from,
        to,
        deps.fetchImpl,
        context
          ? { ...context, connectionId: refreshed.id, accountEmail: refreshed.accountEmail }
          : undefined
      )
      return { tokens: refreshed, events }
    } catch (retry) {
      if (retry instanceof CalendarHttpError && retry.status === 401) {
        await removeMicrosoftConnection(deps, memory, refreshed.id, 'Connect again')
        throw new Error('Connect again')
      }
      throw retry
    }
  }
}

async function refreshConnection(
  deps: CalendarDeps,
  memory: CalendarMemory,
  tokens: MicrosoftConnection,
  clientId: string,
  now: number
): Promise<MicrosoftConnection> {
  try {
    const refreshed = await refreshMicrosoftTokens({
      tokens,
      clientId,
      fetchImpl: deps.fetchImpl,
      now
    })
    const next: MicrosoftConnection = {
      ...refreshed,
      id: tokens.id,
      accountEmail: refreshed.accountEmail ?? tokens.accountEmail
    }
    await deps.secrets.update((draft) => {
      draft.microsoftConnections = replaceMicrosoftConnection(draft.microsoftConnections, next)
    })
    return next
  } catch (error) {
    if (isConnectAgain(error)) throw error
    await removeMicrosoftConnection(deps, memory, tokens.id, 'Connect again')
    throw new Error('Connect again')
  }
}

function contextFor(
  tokens: MicrosoftConnection,
  calendarId: string,
  listed: ListedCalendar | null
): MicrosoftEventContext {
  return {
    connectionId: tokens.id,
    calendarId,
    accountEmail: tokens.accountEmail,
    calendarLabel: listed?.summary ?? null,
    calendarPrimary: listed ? listed.primary : false
  }
}

function pruneMicrosoftMemory(memory: CalendarMemory, live: Set<string>): void {
  for (const id of Object.keys(memory.events.microsoftByConnection)) {
    if (!live.has(id)) delete memory.events.microsoftByConnection[id]
  }
  for (const id of Object.keys(memory.fetchedAt.microsoftByConnection)) {
    if (!live.has(id)) delete memory.fetchedAt.microsoftByConnection[id]
  }
  for (const id of Object.keys(memory.lists.microsoft)) {
    if (!live.has(id)) delete memory.lists.microsoft[id]
  }
  for (const id of Object.keys(memory.microsoftAccountErrors)) {
    if (!live.has(id)) delete memory.microsoftAccountErrors[id]
  }
}

function isConnectAgain(error: unknown): boolean {
  return error instanceof Error && error.message === 'Connect again'
}
