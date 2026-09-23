export type RecordingDestination = 'local' | 'google' | 'microsoft'

export function parseDestination(value: unknown): RecordingDestination {
  if (value === 'local' || value === 'google' || value === 'microsoft') return value
  return 'local'
}

/** Upload targets that are connected, consented, and have the upload scope. */
export function effectiveDestination(
  destination: RecordingDestination,
  available: { google: boolean; microsoft: boolean }
): RecordingDestination {
  if (destination === 'google' && available.google) return 'google'
  if (destination === 'microsoft' && available.microsoft) return 'microsoft'
  return 'local'
}
