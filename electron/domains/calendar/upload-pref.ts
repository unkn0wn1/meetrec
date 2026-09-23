import type { CalendarStatus } from '../../shared/calendar-contract'
import type { CalendarCore } from './deps'
import { writePreferences, type CalendarPreferences } from './preferences'

export async function saveUploadPreference(
  core: CalendarCore & { buildStatus(): Promise<CalendarStatus> },
  provider: 'google' | 'microsoft',
  enabled: boolean
): Promise<CalendarStatus> {
  if (enabled) {
    const status = await core.buildStatus()
    const granted =
      provider === 'google' ? status.google.uploadScopeGranted : status.microsoft.uploadScopeGranted
    if (!granted) {
      throw new Error(
        provider === 'google' ? 'Connect Google Drive first.' : 'Connect OneDrive first.'
      )
    }
  }
  const next: CalendarPreferences = {
    ...core.memory.prefs,
    uploadGoogle: provider === 'google' ? enabled : core.memory.prefs.uploadGoogle,
    uploadMicrosoft: provider === 'microsoft' ? enabled : core.memory.prefs.uploadMicrosoft
  }
  core.memory.prefs = next
  await writePreferences(core.deps.userDataDir(), next)
  await core.publish()
  return core.buildStatus()
}
