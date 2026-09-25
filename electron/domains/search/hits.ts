import { isSafeRecordingId } from '../../capture/paths'
import type { SearchHit } from '../../shared/search-contract'

const HIT_CAP = 20

export function parseSearchHits(
  stdout: string,
  readLine: (recordingId: string, line: number) => string | null = () => null
): SearchHit[] {
  const payload = JSON.parse(stdout.trim()) as unknown
  const rows = hitRows(payload)
  const hits: SearchHit[] = []
  for (const row of rows) {
    const hit = toHit(row, readLine)
    if (hit) hits.push(hit)
    if (hits.length === HIT_CAP) break
  }
  return hits
}

function hitRows(payload: unknown): Record<string, unknown>[] {
  const list = Array.isArray(payload)
    ? payload
    : payload &&
        typeof payload === 'object' &&
        Array.isArray((payload as { results?: unknown }).results)
      ? (payload as { results: unknown[] }).results
      : null
  if (!list) throw new Error('qmd query did not return JSON.')
  return list.filter((row): row is Record<string, unknown> => !!row && typeof row === 'object')
}

function toHit(
  row: Record<string, unknown>,
  readLine: (recordingId: string, line: number) => string | null
): SearchHit | null {
  const file = typeof row.file === 'string' ? row.file : ''
  const recordingId = recordingIdFromFile(file)
  if (!recordingId) return null
  const snippet = typeof row.snippet === 'string' ? row.snippet : ''
  const line = typeof row.line === 'number' && Number.isFinite(row.line) ? row.line : null
  return {
    recordingId,
    title: typeof row.title === 'string' ? row.title : recordingId,
    snippet,
    startMs: startMsFrom(snippet, recordingId, line, readLine),
    score: typeof row.score === 'number' && Number.isFinite(row.score) ? row.score : 0
  }
}

export function recordingIdFromFile(file: string): string | null {
  const clean = file.split('?')[0] ?? ''
  const base = clean.split('/').pop() ?? ''
  if (!base.endsWith('.md')) return null
  const id = base.slice(0, -'.md'.length)
  return isSafeRecordingId(id) ? id : null
}

export function startMsFromTimestamp(text: string): number | null {
  const match = /\[t=([+-]?\d+(?:\.\d+)?)\]/.exec(text)
  if (!match?.[1]) return null
  const seconds = Number(match[1])
  if (!Number.isFinite(seconds)) return null
  return Math.max(0, Math.round(seconds * 1000))
}

function startMsFrom(
  snippet: string,
  recordingId: string,
  line: number | null,
  readLine: (recordingId: string, line: number) => string | null
): number | null {
  const fromSnippet = startMsFromTimestamp(snippet)
  if (fromSnippet !== null) return fromSnippet
  if (line === null || line < 1) return null
  const text = readLine(recordingId, line)
  if (!text) return null
  return startMsFromTimestamp(text)
}
