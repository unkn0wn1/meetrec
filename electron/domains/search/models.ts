/**
 * Filename stems `qmd doctor` prints for the 2.8.3 defaults:
 * embeddinggemma-300M-Q8_0.gguf, qwen3-reranker-0.6b-q8_0.gguf,
 * qmd-query-expansion-1.7B-q4_k_m.gguf.
 */
export const QMD_MODEL_MARKERS = [
  'embeddinggemma',
  'qwen3-reranker',
  'qmd-query-expansion'
] as const

const PARTIAL_SUFFIXES = ['.part', '.download', '.incomplete']

export interface ModelFileStat {
  name: string
  size: number
  mtimeMs: number
}

export function modelsReadyOnDisk(files: readonly { name: string; size: number }[]): boolean {
  return QMD_MODEL_MARKERS.every((marker) =>
    files.some((file) => file.size > 0 && file.name.includes(marker))
  )
}

export function pollModelGrowth(
  previous: ReadonlyMap<string, number>,
  files: readonly ModelFileStat[]
): { label: string; bytes: number } {
  let label = ''
  let newest = -1
  let bytes = 0
  for (const file of files) {
    bytes += Math.max(0, file.size)
    const before = previous.get(file.name) ?? 0
    if (file.size > before && file.mtimeMs >= newest) {
      newest = file.mtimeMs
      label = file.name
    }
  }
  return { label, bytes }
}

export function partialModelNames(files: readonly { name: string; size: number }[]): string[] {
  return files
    .filter(
      (file) => file.size === 0 || PARTIAL_SUFFIXES.some((suffix) => file.name.endsWith(suffix))
    )
    .map((file) => file.name)
}

/** Percent only when stdout has a parseable current/total. No invented total. */
export function parseDownloadPercent(stdout: string): number | null {
  const matches = [...stdout.matchAll(/(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)/g)]
  const last = matches[matches.length - 1]
  if (!last) return null
  const current = Number(last[1])
  const total = Number(last[2])
  if (!Number.isFinite(current) || !Number.isFinite(total) || total <= 0) return null
  return Math.max(0, Math.min(100, Math.round((current / total) * 100)))
}
