import type { CalendarCore } from './deps'
import { armSkipped } from './schedule'
import { cachedEvents } from './snapshot'
import { rememberKey } from './state-file'
import { cleanEnabled, cleanRecordScope, requireEvent } from './validate'

export function clearSkippedArm(core: CalendarCore): boolean {
  const arm = core.memory.runtime.arm
  if (!arm) return false
  if (!armSkipped(arm, cachedEvents(core.memory), core.memory.runtime)) return false
  core.memory.runtime.arm = null
  return true
}

export async function setRecordOptOut(
  core: CalendarCore,
  input: { occurrenceKey: unknown; enabled: unknown; scope: unknown }
): Promise<void> {
  const event = requireEvent(cachedEvents(core.memory), input.occurrenceKey)
  const enabled = cleanEnabled(input.enabled)
  const scope = cleanRecordScope(input.scope)
  if (scope === 'series' && !event.seriesId) {
    throw new Error('That event is not part of a series.')
  }
  const runtime = core.memory.runtime
  if (scope === 'series' && event.seriesId) {
    if (enabled) {
      runtime.disabledSeries = runtime.disabledSeries.filter((id) => id !== event.seriesId)
      runtime.disabledOccurrences = runtime.disabledOccurrences.filter(
        (key) => key !== event.occurrenceKey
      )
    } else {
      runtime.disabledSeries = rememberKey(runtime.disabledSeries, event.seriesId)
    }
  } else if (enabled) {
    runtime.disabledOccurrences = runtime.disabledOccurrences.filter(
      (key) => key !== event.occurrenceKey
    )
  } else {
    runtime.disabledOccurrences = rememberKey(runtime.disabledOccurrences, event.occurrenceKey)
  }
  clearSkippedArm(core)
  await core.saveRuntime()
  await core.publish()
}
