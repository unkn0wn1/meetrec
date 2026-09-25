import { type MeetingSearchPrefs } from '../../shared/search-contract'

export type { MeetingSearchPrefs }

export function defaultMeetingSearchPrefs(): MeetingSearchPrefs {
  return {
    enabled: false,
    indexAfterTranscript: true,
    indexAfterSummary: true,
    idleCatchUp: false
  }
}

/**
 * A missing object keeps defaults and is not legacy.
 * A non-object, or a non-boolean field, is legacy and falls back to defaults for that field.
 * Absent booleans inside a present object use the defaults (`indexAfterTranscript` stays true).
 */
export function parseMeetingSearchPrefs(value: unknown): {
  prefs: MeetingSearchPrefs
  legacy: boolean
} {
  if (value === undefined) {
    return { prefs: defaultMeetingSearchPrefs(), legacy: false }
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { prefs: defaultMeetingSearchPrefs(), legacy: true }
  }
  const record = value as Record<string, unknown>
  const enabled = booleanField(record.enabled, false)
  const indexAfterTranscript = booleanField(record.indexAfterTranscript, true)
  const indexAfterSummary = booleanField(record.indexAfterSummary, true)
  const idleCatchUp = booleanField(record.idleCatchUp, false)
  return {
    prefs: {
      enabled: enabled.value,
      indexAfterTranscript: indexAfterTranscript.value,
      indexAfterSummary: indexAfterSummary.value,
      idleCatchUp: idleCatchUp.value
    },
    legacy:
      enabled.legacy ||
      indexAfterTranscript.legacy ||
      indexAfterSummary.legacy ||
      idleCatchUp.legacy
  }
}

function booleanField(value: unknown, fallback: boolean): { value: boolean; legacy: boolean } {
  if (value === undefined) return { value: fallback, legacy: false }
  if (typeof value !== 'boolean') return { value: fallback, legacy: true }
  return { value, legacy: false }
}
