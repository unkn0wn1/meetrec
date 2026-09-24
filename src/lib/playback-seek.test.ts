import { describe, expect, it } from 'vitest'
import { applySeekTime, type SeekTarget } from './playback-seek'

function target(currentTime = 4): SeekTarget {
  return { currentTime }
}

describe('applySeekTime', () => {
  it('seeks inside the recording and sets currentTime in seconds', () => {
    const audio = target(0)
    expect(applySeekTime(audio, 2500, 10_000)).toBe(2500)
    expect(audio.currentTime).toBe(2.5)
  })

  it('clamps a negative seek to the start', () => {
    const audio = target()
    expect(applySeekTime(audio, -500, 10_000)).toBe(0)
    expect(audio.currentTime).toBe(0)
  })

  it('clamps a seek past the end to the duration', () => {
    const audio = target()
    expect(applySeekTime(audio, 12_000, 10_000)).toBe(10_000)
    expect(audio.currentTime).toBe(10)
  })

  it('leaves currentTime alone when ms is not finite', () => {
    const audio = target()
    expect(applySeekTime(audio, Number.NaN, 10_000)).toBeNull()
    expect(applySeekTime(audio, Number.POSITIVE_INFINITY, 10_000)).toBeNull()
    expect(audio.currentTime).toBe(4)
  })

  it('leaves currentTime alone when duration is not a usable range', () => {
    const audio = target()
    expect(applySeekTime(audio, 1500, 0)).toBeNull()
    expect(applySeekTime(audio, 1500, -10)).toBeNull()
    expect(applySeekTime(audio, 1500, Number.NaN)).toBeNull()
    expect(audio.currentTime).toBe(4)
  })

  it('keeps an off-step millisecond value', () => {
    const audio = target(0)
    expect(applySeekTime(audio, 1500, 10_000)).toBe(1500)
    expect(audio.currentTime).toBe(1.5)
  })
})
