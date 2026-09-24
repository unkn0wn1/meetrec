export interface SpeakerLane {
  index: number
  side: 'start' | 'end'
  tone: number
}

export const BUBBLE_TONE_COUNT = 4

/** Segment `start` is seconds. Playback `seekMs` is milliseconds. */
export function segmentStartMs(startSeconds: number): number | null {
  if (!Number.isFinite(startSeconds)) return null
  return Math.max(0, Math.round(startSeconds * 1000))
}

/** First appearance wins. The same speaker keeps one side and one tone. */
export function speakerLanes(speakerIdsInOrder: readonly string[]): Map<string, SpeakerLane> {
  const lanes = new Map<string, SpeakerLane>()
  for (const id of speakerIdsInOrder) {
    if (lanes.has(id)) continue
    const index = lanes.size
    lanes.set(id, {
      index,
      side: index % 2 === 0 ? 'start' : 'end',
      tone: index % BUBBLE_TONE_COUNT
    })
  }
  return lanes
}
