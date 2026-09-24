import { describe, expect, it } from 'vitest'
import { BUBBLE_TONE_COUNT, segmentStartMs, speakerLanes } from './transcript-bubbles'

describe('segmentStartMs', () => {
  it('rounds seconds to milliseconds the same way as the segment clock', () => {
    expect(segmentStartMs(0)).toBe(0)
    expect(segmentStartMs(0.1)).toBe(100)
    expect(segmentStartMs(0.9)).toBe(900)
    expect(segmentStartMs(1.2)).toBe(1200)
    expect(segmentStartMs(1.25)).toBe(1250)
  })

  it('clamps a negative start to the beginning', () => {
    expect(segmentStartMs(-0.4)).toBe(0)
  })

  it('rejects a non-finite start', () => {
    expect(segmentStartMs(Number.NaN)).toBeNull()
    expect(segmentStartMs(Number.POSITIVE_INFINITY)).toBeNull()
  })
})

describe('speakerLanes', () => {
  it('keeps the first-seen side and tone when a speaker returns', () => {
    const lanes = speakerLanes(['speaker-1', 'speaker-2', 'speaker-1', 'speaker-3'])
    expect(lanes.get('speaker-1')).toEqual({ index: 0, side: 'start', tone: 0 })
    expect(lanes.get('speaker-2')).toEqual({ index: 1, side: 'end', tone: 1 })
    expect(lanes.get('speaker-3')).toEqual({ index: 2, side: 'start', tone: 2 })
    expect(lanes.size).toBe(3)
  })

  it('wraps the fifth new speaker back to the first tone and the left side', () => {
    const lanes = speakerLanes(['a', 'b', 'c', 'd', 'e'])
    expect(lanes.get('d')).toEqual({ index: 3, side: 'end', tone: 3 })
    expect(lanes.get('e')).toEqual({ index: 4, side: 'start', tone: 0 })
    expect(BUBBLE_TONE_COUNT).toBe(4)
  })
})
