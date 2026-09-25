import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { readdir, unlink } from 'node:fs/promises'
import { join, parse } from 'node:path'
import { isSafeRecordingId } from '../../capture/paths'
import { recordingLayout } from '../recording/layout'
import { displayTitle, parseMeta, type RecordingMeta } from '../recording/meta'
import { scanRecordings } from '../recording/store'
import { parseAppSettings, settingsFilePath } from '../settings/settings-file'
import {
  defaultMeetingSearchPrefs,
  type MeetingSearchPrefs
} from '../settings/meeting-search-prefs'
import { parseTranscript, type TranscriptDocument } from '../transcript/parse'
import type { SearchRecordView } from '../../shared/search-contract'
import { buildMeetingExport, sourceToken, speakersForExport } from './export-md'
import { partialModelNames, type ModelFileStat } from './models'
import { qmdCatchUpPath, qmdExportPath, qmdModelDir } from './paths'
import { readSearchStatus, searchStatusPath } from './status-file'

export interface PreparedExport {
  id: string
  token: string
  markdown: string
}

export function loadMeetingPrefs(userDataDir: string): MeetingSearchPrefs {
  try {
    return parseAppSettings(readFileSync(settingsFilePath(userDataDir), 'utf8')).settings
      .meetingSearch
  } catch {
    return defaultMeetingSearchPrefs()
  }
}

export function prepareExport(recordingsDir: string, id: string): PreparedExport | null {
  if (!isSafeRecordingId(id)) return null
  const layout = recordingLayout(recordingsDir, id)
  const meta = readMetaFile(layout.metaPath)
  const transcript = readTranscript(layout.transcriptPath)
  if (!meta || !transcript) return null
  const summary = readOptional(layout.summaryPath)
  const built = buildMeetingExport({
    id,
    title: displayTitle(meta),
    startedAt: meta.startedAt,
    attendees: meta.calendar ? meta.calendar.attendees : null,
    speakers: speakersForExport(meta.speakers),
    transcript,
    summary
  })
  if (built.kind === 'skip') return null
  const transcriptStat = statSync(layout.transcriptPath)
  const summaryStat = existsSync(layout.summaryPath) ? statSync(layout.summaryPath) : null
  return {
    id,
    markdown: built.markdown,
    token: sourceToken({
      transcriptMtimeMs: transcriptStat.mtimeMs,
      transcriptSize: transcriptStat.size,
      summaryMtimeMs: summaryStat?.mtimeMs ?? null,
      summarySize: summaryStat?.size ?? null,
      speakerNames: meta.speakers.map((speaker) => speaker.name)
    })
  }
}

export async function staleMeetingIds(recordingsDir: string): Promise<string[]> {
  const stored = await scanRecordings(recordingsDir)
  const ids: string[] = []
  for (const item of stored) {
    const prepared = prepareExport(recordingsDir, item.meta.id)
    if (!prepared) continue
    const status = await readSearchStatus(searchStatusPath(recordingsDir, item.meta.id))
    if (status.state === 'indexed' && status.sourceToken === prepared.token) continue
    ids.push(item.meta.id)
  }
  return ids
}

export async function loadSearchRecords(
  recordingsDir: string
): Promise<Record<string, SearchRecordView>> {
  let names: string[] = []
  try {
    names = await readdir(recordingsDir)
  } catch {
    return {}
  }
  const records: Record<string, SearchRecordView> = {}
  for (const id of names) {
    if (!isSafeRecordingId(id)) continue
    const status = await readSearchStatus(searchStatusPath(recordingsDir, id))
    if (status.state === 'none') continue
    records[id] = { state: status.state, error: status.error }
  }
  return records
}

export async function removeSearchSidecars(recordingsDir: string): Promise<void> {
  let names: string[] = []
  try {
    names = await readdir(recordingsDir)
  } catch {
    return
  }
  for (const id of names) {
    if (!isSafeRecordingId(id)) continue
    await unlink(searchStatusPath(recordingsDir, id)).catch(() => undefined)
  }
}

export function listModelFiles(userDataDir: string): ModelFileStat[] {
  const dir = qmdModelDir(userDataDir)
  let names: string[] = []
  try {
    names = readdirSync(dir)
  } catch {
    return []
  }
  const files: ModelFileStat[] = []
  for (const name of names) {
    try {
      const info = statSync(join(dir, name))
      if (!info.isFile()) continue
      files.push({ name, size: info.size, mtimeMs: info.mtimeMs })
    } catch {
      // The download can remove a file between readdir and stat.
    }
  }
  return files
}

export async function deletePartialModels(userDataDir: string): Promise<void> {
  const dir = qmdModelDir(userDataDir)
  for (const name of partialModelNames(listModelFiles(userDataDir))) {
    await unlink(join(dir, name)).catch(() => undefined)
  }
}

export function readCatchUpAt(userDataDir: string): number | null {
  try {
    const parsed = JSON.parse(readFileSync(qmdCatchUpPath(userDataDir), 'utf8')) as {
      lastCatchUpAt?: unknown
    }
    if (typeof parsed.lastCatchUpAt !== 'string') return null
    const ms = Date.parse(parsed.lastCatchUpAt)
    return Number.isNaN(ms) ? null : ms
  } catch {
    return null
  }
}

export function writeCatchUpAt(userDataDir: string, iso: string): void {
  mkdirSync(parse(qmdCatchUpPath(userDataDir)).dir, { recursive: true })
  writeFileSync(qmdCatchUpPath(userDataDir), `${JSON.stringify({ lastCatchUpAt: iso }, null, 2)}\n`)
}

export function exportLine(userDataDir: string, id: string, line: number): string | null {
  try {
    const rows = readFileSync(qmdExportPath(userDataDir, id), 'utf8').split(/\r?\n/)
    return rows[line - 1] ?? null
  } catch {
    return null
  }
}

export function stderrTail(text: string): string {
  return text.replace(/\s+/g, ' ').trim().slice(0, 200)
}

function readMetaFile(file: string): RecordingMeta | null {
  try {
    return parseMeta(readFileSync(file, 'utf8'))
  } catch {
    return null
  }
}

function readTranscript(file: string): TranscriptDocument | null {
  try {
    return parseTranscript(readFileSync(file, 'utf8'))
  } catch {
    return null
  }
}

function readOptional(file: string): string | null {
  try {
    return readFileSync(file, 'utf8')
  } catch {
    return null
  }
}
