import { mkdir, readdir, readFile, rename, stat, writeFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { idFromFlatWav, recordingLayout, startedAtFromRecordingId } from './layout'
import { emptyMeta, parseMeta, type RecordingMeta } from './meta'

export interface RecordingFlags {
  hasTranscript: boolean
  hasSummary: boolean
}

export interface StoredRecording {
  meta: RecordingMeta
  flags: RecordingFlags
}

export async function writeMeta(recordingsDir: string, meta: RecordingMeta): Promise<void> {
  const layout = recordingLayout(recordingsDir, meta.id)
  await mkdir(layout.dir, { recursive: true })
  await writeFile(layout.metaPath, `${JSON.stringify(meta, null, 2)}\n`, 'utf8')
}

export async function readMeta(recordingsDir: string, id: string): Promise<RecordingMeta | null> {
  const layout = recordingLayout(recordingsDir, id)
  try {
    const raw = await readFile(layout.metaPath, 'utf8')
    return parseMeta(raw)
  } catch {
    return null
  }
}

export async function scanRecordings(recordingsDir: string): Promise<StoredRecording[]> {
  await mkdir(recordingsDir, { recursive: true })
  await migrateFlatWavs(recordingsDir)
  const entries = await readdir(recordingsDir, { withFileTypes: true })
  const stored: StoredRecording[] = []
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const loaded = await loadFolder(recordingsDir, entry.name)
    if (loaded) stored.push(loaded)
  }
  stored.sort((a, b) => Date.parse(b.meta.startedAt) - Date.parse(a.meta.startedAt))
  return stored
}

export async function loadRecording(
  recordingsDir: string,
  id: string
): Promise<StoredRecording | null> {
  await migrateFlatWavs(recordingsDir)
  return loadFolder(recordingsDir, id)
}

async function loadFolder(recordingsDir: string, id: string): Promise<StoredRecording | null> {
  const layout = recordingLayout(recordingsDir, id)
  const meta = await readMeta(recordingsDir, id)
  if (!meta) return null
  const [hasTranscript, hasSummary] = await Promise.all([
    fileExists(layout.transcriptPath),
    fileExists(layout.summaryPath)
  ])
  return { meta, flags: { hasTranscript, hasSummary } }
}

export async function migrateFlatWavs(recordingsDir: string): Promise<string[]> {
  let names: string[]
  try {
    names = await readdir(recordingsDir)
  } catch {
    return []
  }
  const moved: string[] = []
  for (const name of names) {
    const id = idFromFlatWav(name)
    if (!id) continue
    const source = join(recordingsDir, name)
    const info = await stat(source).catch(() => null)
    if (!info?.isFile()) continue
    const layout = recordingLayout(recordingsDir, id)
    await mkdir(layout.dir, { recursive: true })
    const audioInfo = await stat(layout.audioPath).catch(() => null)
    if (audioInfo?.isFile()) {
      await rename(source, `${source}.migrated-duplicate`)
      moved.push(id)
      continue
    }
    await rename(source, layout.audioPath)
    const existing = await readMeta(recordingsDir, id)
    if (!existing) {
      const startedAt = startedAtFromRecordingId(id) ?? info.birthtime.toISOString()
      const durationMs = wavDurationMs(
        await readFile(layout.audioPath).catch(() => Buffer.alloc(0))
      )
      await writeMeta(
        recordingsDir,
        emptyMeta({
          id,
          startedAt,
          endedAt: info.mtime.toISOString(),
          durationMs,
          note: 'Migrated from a flat WAV file.'
        })
      )
    }
    moved.push(id)
  }
  return moved
}

export function wavDurationMs(buffer: Buffer): number {
  if (buffer.length < 44) return 0
  if (buffer.toString('ascii', 0, 4) !== 'RIFF') return 0
  if (buffer.toString('ascii', 8, 12) !== 'WAVE') return 0
  let offset = 12
  let sampleRate = 0
  let channels = 0
  let bits = 0
  let dataBytes = 0
  while (offset + 8 <= buffer.length) {
    const id = buffer.toString('ascii', offset, offset + 4)
    const size = buffer.readUInt32LE(offset + 4)
    const start = offset + 8
    if (id === 'fmt ' && start + 16 <= buffer.length) {
      channels = buffer.readUInt16LE(start + 2)
      sampleRate = buffer.readUInt32LE(start + 4)
      bits = buffer.readUInt16LE(start + 14)
    }
    if (id === 'data') {
      dataBytes = size
      break
    }
    offset = start + size + (size % 2)
  }
  if (!sampleRate || !channels || !bits || !dataBytes) return 0
  const bytesPerSecond = sampleRate * channels * (bits / 8)
  if (!bytesPerSecond) return 0
  return Math.round((dataBytes / bytesPerSecond) * 1000)
}

async function fileExists(path: string): Promise<boolean> {
  const info = await stat(path).catch(() => null)
  return Boolean(info?.isFile())
}

export function folderIdFromPath(audioPath: string): string {
  return basename(join(audioPath, '..'))
}
