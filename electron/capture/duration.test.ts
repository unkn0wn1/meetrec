import { describe, expect, it } from 'vitest'
import { durationMs, formatDuration } from './duration'

describe('durationMs', () => {
  it('returns elapsed milliseconds', () => {
    expect(durationMs(1_000, 3_400)).toBe(2400)
  })

  it('never returns a negative duration', () => {
    expect(durationMs(5_000, 1_000)).toBe(0)
  })

  it('returns 0 for non-finite input', () => {
    expect(durationMs(Number.NaN, 10)).toBe(0)
  })
})

describe('formatDuration', () => {
  it('formats minutes and seconds', () => {
    expect(formatDuration(65_000)).toBe('01:05')
    expect(formatDuration(0)).toBe('00:00')
  })
})
