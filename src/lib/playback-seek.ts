/** Media element surface this helper is allowed to touch. No play/pause. */
export interface SeekTarget {
  currentTime: number
}

/**
 * Clamp `ms` into `[0, durationMs]` and assign `target.currentTime` in seconds.
 * Returns the clamped milliseconds, or null when duration or `ms` is not a usable finite range.
 * Null means the caller must not write `currentTime` (queue the seek until metadata exists).
 */
export function applySeekTime(target: SeekTarget, ms: number, durationMs: number): number | null {
  if (!Number.isFinite(durationMs) || durationMs <= 0) return null
  if (!Number.isFinite(ms)) return null
  const clamped = Math.min(durationMs, Math.max(0, ms))
  target.currentTime = clamped / 1000
  return clamped
}
