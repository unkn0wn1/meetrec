import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

export type SearchIndexState = 'none' | 'pending' | 'indexed' | 'error'

export interface SearchStatusFile {
  state: SearchIndexState
  error: string | null
  updatedAt: string | null
  sourceToken: string | null
}

const NONE: SearchStatusFile = {
  state: 'none',
  error: null,
  updatedAt: null,
  sourceToken: null
}

export function searchStatusPath(recordingsDir: string, id: string): string {
  return join(recordingsDir, id, 'search.json')
}

export function parseSearchStatus(raw: string): SearchStatusFile {
  let value: unknown
  try {
    value = JSON.parse(raw)
  } catch {
    return NONE
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return NONE
  const record = value as Record<string, unknown>
  const state = record.state
  if (state !== 'pending' && state !== 'indexed' && state !== 'error') return NONE
  return {
    state,
    error: typeof record.error === 'string' ? record.error : null,
    updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : null,
    sourceToken: typeof record.sourceToken === 'string' ? record.sourceToken : null
  }
}

export async function readSearchStatus(file: string): Promise<SearchStatusFile> {
  try {
    return parseSearchStatus(await readFile(file, 'utf8'))
  } catch {
    return NONE
  }
}

export async function writeSearchStatus(
  file: string,
  status: {
    state: 'pending' | 'indexed' | 'error'
    error: string | null
    updatedAt: string
    sourceToken: string | null
  }
): Promise<void> {
  const body = {
    state: status.state,
    error: status.error,
    updatedAt: status.updatedAt,
    sourceToken: status.sourceToken
  }
  await writeFile(file, `${JSON.stringify(body, null, 2)}\n`, 'utf8')
}
