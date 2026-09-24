import type {
  CalendarChoice,
  CalendarStatus,
  GoogleConnectionStatus,
  MicrosoftConnectionStatus
} from '../../shared/calendar-contract'
import { readAutoRecordFlag } from '../settings/settings-file'
import { GOOGLE_DRIVE_SCOPE, MICROSOFT_APPFOLDER_SCOPE } from './constants'
import type { CalendarCore } from './deps'
import { upcomingEvents } from './event-view'
import { driveConnection } from './google-connections'
import { oneDriveConnection } from './microsoft-connections'
import { armSkipped, decideSchedule } from './schedule'
import type { ListedCalendar } from './selection'
import { cachedEvents, freshEvents } from './snapshot'
import type { CalendarArm } from './state-file'
import { scopeIncludes } from './tokens'

export function visibleArm(core: CalendarCore): CalendarArm | null {
  const arm = core.memory.runtime.arm
  if (!arm || armSkipped(arm, cachedEvents(core.memory), core.memory.runtime)) return null
  return arm
}

export async function buildCalendarStatus(core: CalendarCore): Promise<CalendarStatus> {
  const bag = await core.deps.secrets.readBag()
  const now = core.deps.now()
  const fresh = freshEvents(core.memory, now)
  const decision = decideSchedule({
    now,
    events: fresh.events,
    state: core.memory.runtime,
    recording: core.deps.recording.status().phase === 'recording',
    snapshotAt: fresh.snapshotAt,
    autoRecord: readAutoRecordFlag(core.deps.userDataDir())
  })
  const connections = bag.googleConnections
  const drive = driveConnection(connections)
  const first = connections[0] ?? null
  const microsoftConnections = bag.microsoftConnections
  const oneDrive = oneDriveConnection(microsoftConnections)
  const firstMicrosoft = microsoftConnections[0] ?? null
  const arm = visibleArm(core)
  const googleAccounts: GoogleConnectionStatus[] = connections.map((connection) => ({
    id: connection.id,
    accountEmail: connection.accountEmail,
    error: core.memory.accountErrors[connection.id] ?? null,
    uploadScopeGranted: scopeIncludes(connection.scope, GOOGLE_DRIVE_SCOPE),
    calendars: choices(
      core.memory.lists.google[connection.id] ?? [],
      core.memory.prefs.googleCalendars[connection.id]
    )
  }))
  const microsoftAccounts: MicrosoftConnectionStatus[] = microsoftConnections.map((connection) => ({
    id: connection.id,
    accountEmail: connection.accountEmail,
    error: core.memory.microsoftAccountErrors[connection.id] ?? null,
    uploadScopeGranted: scopeIncludes(connection.scope, MICROSOFT_APPFOLDER_SCOPE),
    calendars: choices(
      core.memory.lists.microsoft[connection.id] ?? [],
      core.memory.prefs.microsoftCalendars[connection.id]
    )
  }))
  return {
    connectPending: core.memory.connectPending,
    connectTargetId: core.memory.connectTargetId,
    connected:
      connections.some((item) => Boolean(item.refreshToken)) ||
      microsoftConnections.some((item) => Boolean(item.refreshToken)),
    google: {
      connected: connections.some((item) => Boolean(item.refreshToken)),
      accountEmail: drive?.accountEmail ?? first?.accountEmail ?? null,
      uploadEnabled: core.memory.prefs.uploadGoogle,
      uploadScopeGranted: Boolean(drive),
      error: core.memory.errors.google
    },
    googleAccounts,
    microsoft: {
      connected: microsoftConnections.some((item) => Boolean(item.refreshToken)),
      accountEmail: oneDrive?.accountEmail ?? firstMicrosoft?.accountEmail ?? null,
      uploadEnabled: core.memory.prefs.uploadMicrosoft,
      uploadScopeGranted: Boolean(oneDrive),
      error: core.memory.errors.microsoft
    },
    microsoftAccounts,
    upcoming: upcomingEvents(cachedEvents(core.memory), core.memory.runtime, now),
    prompt: decision.prompt,
    arm: arm ? { occurrenceKey: arm.occurrenceKey, title: arm.title, fireAt: arm.fireAt } : null
  }
}

function choices(list: ListedCalendar[], selected: string[] | undefined): CalendarChoice[] {
  const picked = new Set(selected ?? [])
  return list.map((item) => ({
    id: item.id,
    summary: item.summary,
    primary: item.primary,
    selected: picked.has(item.id)
  }))
}
