/** Playback offset from a recording route query. Non-finite values are ignored. */
export function seekMsFromQuery(value: unknown): number | null {
  const raw = Array.isArray(value) ? value[0] : value
  if (typeof raw !== 'string') return null
  const trimmed = raw.trim()
  if (!trimmed) return null
  const ms = Number(trimmed)
  if (!Number.isFinite(ms)) return null
  return ms
}
