import { CALENDAR_END_GRACE_MS } from './constants'
import type { CalendarCore } from './deps'
import { removeGoogleConnection } from './google-fetch'
import { revokeGoogleRefresh } from './google-oauth'
import { removeMicrosoftConnection } from './microsoft-fetch'
import { parseOccurrenceKey } from './occurrence'
import { clearSkippedArm } from './record-opt'
import { armFromEvent, occurrenceSkipped } from './schedule'
import { cachedEvents } from './snapshot'
import type { CalendarEvent } from './source'
import { rememberKey, type CalendarArm } from './state-file'
import { requireEvent } from './validate'

export async function dismissOccurrence(core: CalendarCore, key: unknown): Promise<void> {
  const event = requireEvent(cachedEvents(core.memory), key)
  core.memory.runtime.dismissed = rememberKey(core.memory.runtime.dismissed, event.occurrenceKey)
  if (core.memory.runtime.arm?.occurrenceKey === event.occurrenceKey) {
    core.memory.runtime.arm = null
  }
  await core.saveRuntime()
  await core.publish()
}

export async function armOccurrence(core: CalendarCore, key: unknown): Promise<void> {
  const event = requireEvent(cachedEvents(core.memory), key)
  assertRecording(core, event)
  const arm = armFromEvent(event)
  if (Date.parse(arm.fireAt) <= core.deps.now()) {
    await startEvent(core, event)
    return
  }
  core.memory.runtime.arm = arm
  await core.saveRuntime()
  await core.publish()
}

export async function startOccurrence(core: CalendarCore, key: unknown): Promise<void> {
  const event = requireEvent(cachedEvents(core.memory), key)
  assertRecording(core, event)
  await startEvent(core, event)
}

export async function startEvent(core: CalendarCore, event: CalendarEvent): Promise<void> {
  if (core.deps.recording.status().phase === 'recording') {
    throw new Error('Already recording.')
  }
  await core.deps.recording.start({
    title: event.title,
    calendar: {
      provider: event.provider,
      occurrenceKey: event.occurrenceKey,
      title: event.title,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      attendees: event.attendees.map((attendee) => ({ name: attendee.name, email: attendee.email }))
    }
  })
  const recordingId = core.deps.recording.recordingId()
  if (core.memory.runtime.arm?.occurrenceKey === event.occurrenceKey) {
    core.memory.runtime.arm = null
  }
  core.memory.runtime.dismissed = rememberKey(core.memory.runtime.dismissed, event.occurrenceKey)
  const endsAt = event.endsAt ? Date.parse(event.endsAt) : Number.NaN
  core.memory.runtime.linkedStop =
    recordingId && !Number.isNaN(endsAt)
      ? {
          recordingId,
          stopAt: new Date(endsAt + CALENDAR_END_GRACE_MS).toISOString(),
          occurrenceKey: event.occurrenceKey
        }
      : null
  await core.saveRuntime()
  await core.publish()
}

export async function fireArm(core: CalendarCore, arm: CalendarArm): Promise<void> {
  if (clearSkippedArm(core)) {
    await core.saveRuntime()
    await core.publish()
    return
  }
  const live = cachedEvents(core.memory).find((event) => event.occurrenceKey === arm.occurrenceKey)
  if (live) {
    await startEvent(core, live)
    return
  }
  const parsed = parseOccurrenceKey(arm.occurrenceKey)
  if (!parsed) {
    core.memory.runtime.arm = null
    await core.saveRuntime()
    return
  }
  await startEvent(core, {
    provider: parsed.provider,
    eventId: parsed.eventId,
    occurrenceKey: arm.occurrenceKey,
    seriesId: arm.seriesId,
    title: arm.title,
    startsAt: parsed.startsAt,
    endsAt: arm.endsAt,
    attendees: []
  })
}

function assertRecording(core: CalendarCore, event: CalendarEvent): void {
  if (occurrenceSkipped(event.occurrenceKey, event.seriesId, core.memory.runtime)) {
    throw new Error('Recording is off for that event.')
  }
}

export async function disconnectMicrosoft(
  core: CalendarCore,
  connectionId?: string | null
): Promise<void> {
  const bag = await core.deps.secrets.readBag()
  const targets = connectionId
    ? bag.microsoftConnections.filter((item) => item.id === connectionId)
    : bag.microsoftConnections
  if (!connectionId) {
    for (const target of targets) {
      await removeMicrosoftConnection(core.deps, core.memory, target.id, null)
    }
  } else if (targets.length > 0) {
    await removeMicrosoftConnection(core.deps, core.memory, connectionId, null)
  }
  core.memory.errors.microsoft = null
  await core.saveRuntime()
  await core.publish()
}

export async function disconnectGoogle(
  core: CalendarCore,
  connectionId?: string | null
): Promise<void> {
  const bag = await core.deps.secrets.readBag()
  const targets = connectionId
    ? bag.googleConnections.filter((item) => item.id === connectionId)
    : bag.googleConnections
  for (const target of targets) {
    if (target.refreshToken) await revokeGoogleRefresh(target.refreshToken, core.deps.fetchImpl)
  }
  if (!connectionId) {
    for (const target of targets) {
      await removeGoogleConnection(core.deps, core.memory, target.id, null)
    }
  } else if (targets.length > 0) {
    await removeGoogleConnection(core.deps, core.memory, connectionId, null)
  }
  core.memory.errors.google = null
  await core.saveRuntime()
  await core.publish()
}

export async function clearLinkedStop(core: CalendarCore): Promise<void> {
  if (core.deps.recording.status().phase === 'recording') return
  if (!core.memory.runtime.linkedStop) return
  core.memory.runtime.linkedStop = null
  await core.saveRuntime()
  await core.publish()
}

export async function runGraceStop(core: CalendarCore): Promise<void> {
  const link = core.memory.runtime.linkedStop
  if (!link) return
  const recordingId = core.deps.recording.recordingId()
  core.memory.runtime.linkedStop = null
  await core.saveRuntime()
  if (!recordingId || recordingId !== link.recordingId) return
  try {
    await core.deps.recording.stop()
  } catch {
    // The link is already cleared, so the tick does not retry the stop.
  }
}
