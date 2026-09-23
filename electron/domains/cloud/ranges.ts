export const DRIVE_CHUNK_BYTES = 8 * 1024 * 1024
export const ONEDRIVE_QUANTUM_BYTES = 320 * 1024
export const ONEDRIVE_CHUNK_BYTES = ONEDRIVE_QUANTUM_BYTES * 8

export interface ByteRange {
  start: number
  end: number
}

export function byteRanges(size: number, chunk: number): ByteRange[] {
  if (size <= 0 || chunk <= 0) return []
  const ranges: ByteRange[] = []
  for (let start = 0; start < size; start += chunk) {
    ranges.push({ start, end: Math.min(start + chunk, size) - 1 })
  }
  return ranges
}
