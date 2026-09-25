import { describe, expect, it } from 'vitest'
import { defaultMeetingSearchPrefs, parseMeetingSearchPrefs } from './meeting-search-prefs'

describe('meeting search prefs', () => {
  it('uses defaults when the object is missing', () => {
    const parsed = parseMeetingSearchPrefs(undefined)
    expect(parsed.legacy).toBe(false)
    expect(parsed.prefs).toEqual(defaultMeetingSearchPrefs())
    expect(parsed.prefs.enabled).toBe(false)
    expect(parsed.prefs.idleCatchUp).toBe(false)
  })

  it('keeps an explicit enabled flag', () => {
    const parsed = parseMeetingSearchPrefs({
      enabled: true,
      indexAfterTranscript: true,
      indexAfterSummary: false,
      idleCatchUp: true
    })
    expect(parsed.legacy).toBe(false)
    expect(parsed.prefs.enabled).toBe(true)
    expect(parsed.prefs.indexAfterSummary).toBe(false)
    expect(parsed.prefs.idleCatchUp).toBe(true)
  })

  it('treats a non-object as legacy and off', () => {
    const parsed = parseMeetingSearchPrefs('yes')
    expect(parsed.legacy).toBe(true)
    expect(parsed.prefs).toEqual(defaultMeetingSearchPrefs())
  })

  it('defaults indexAfterTranscript when that key is absent', () => {
    const parsed = parseMeetingSearchPrefs({ enabled: false })
    expect(parsed.legacy).toBe(false)
    expect(parsed.prefs.indexAfterTranscript).toBe(true)
    expect(parsed.prefs.indexAfterSummary).toBe(true)
    expect(parsed.prefs.idleCatchUp).toBe(false)
  })

  it('marks a non-boolean field legacy and uses the default for that field', () => {
    const parsed = parseMeetingSearchPrefs({ enabled: 'true', indexAfterTranscript: false })
    expect(parsed.legacy).toBe(true)
    expect(parsed.prefs.enabled).toBe(false)
    expect(parsed.prefs.indexAfterTranscript).toBe(false)
  })
})
