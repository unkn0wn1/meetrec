import { mkdir, readdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { isSafeRecordingId } from '../../capture/paths'
import { encodeWavToLibraryMp3 } from './encode-mp3'
import {
  idFromFlatWav,
  LIBRARY_AUDIO_FILE,
  LIBRARY_MP3_PARTIAL,
  recordingLayout,
  startedAtFromRecordingId
} from './layout'
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

export type LibraryMp3Encode = (wavPath: string, mp3Path: string) => Promise<void>

export interface LibraryEncodeOptions {
  encode?: LibraryMp3Encode
}

export async function scanRecordings(
  recordingsDir: string,
  options?: LibraryEncodeOptions
): Promise<StoredRecording[]> {
  await mkdir(recordingsDir, { recursive: true })
  await migrateFlatWavs(recordingsDir)
  await migrateLibraryWavs(recordingsDir, options?.encode ?? encodeWavToLibraryMp3)
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
  id: string,
  options?: LibraryEncodeOptions
): Promise<StoredRecording | null> {
  await migrateFlatWavs(recordingsDir)
  await migrateLibraryWavs(recordingsDir, options?.encode ?? encodeWavToLibraryMp3)
  return loadFolder(recordingsDir, id)
}

/** Permanently removes the recording folder the app owns under recordingsDir. */
export async function deleteRecording(recordingsDir: string, id: string): Promise<void> {
  if (!isSafeRecordingId(id)) {
    throw new Error('Unknown recording.')
  }
  const layout = recordingLayout(recordingsDir, id)
  const info = await stat(layout.dir).catch(() => null)
  if (!info?.isDirectory()) {
    throw new Error('Recording not found.')
  }
  await rm(layout.dir, { recursive: true, force: false })
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
    const mp3Info = await stat(layout.audioPath).catch(() => null)
    const wavInfo = await stat(layout.captureAudioPath).catch(() => null)
    const occupied =
      (mp3Info?.isFile() && mp3Info.size > 0) || (wavInfo?.isFile() && wavInfo.size > 0)
    if (occupied) {
      await rename(source, `${source}.migrated-duplicate`)
      moved.push(id)
      continue
    }
    await rename(source, layout.captureAudioPath)
    const existing = await readMeta(recordingsDir, id)
    if (!existing) {
      const startedAt = startedAtFromRecordingId(id) ?? info.birthtime.toISOString()
      const durationMs = wavDurationMs(
        await readFile(layout.captureAudioPath).catch(() => Buffer.alloc(0))
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

async function migrateLibraryWavs(recordingsDir: string, encode: LibraryMp3Encode): Promise<void> {
  let names: string[]
  try {
    names = await readdir(recordingsDir)
  } catch {
    return
  }
  for (const name of names) {
    const layout = recordingLayout(recordingsDir, name)
    const info = await stat(layout.dir).catch(() => null)
    if (!info?.isDirectory()) continue
    await migrateLibraryFolder(recordingsDir, name, encode)
  }
}

/** Encode one folder that still has a WAV and no MP3. A failed encode leaves the WAV. */
export async function migrateLibraryFolder(
  recordingsDir: string,
  id: string,
  encode: LibraryMp3Encode = encodeWavToLibraryMp3
): Promise<void> {
  const meta = await readMeta(recordingsDir, id)
  if (!meta) return
  const layout = recordingLayout(recordingsDir, id)
  const partial = join(layout.dir, LIBRARY_MP3_PARTIAL)
  const mp3Size = await byteSize(layout.audioPath)
  const wavSize = await byteSize(layout.captureAudioPath)
  if (mp3Size !== null && mp3Size > 0) {
    await rm(layout.captureAudioPath, { force: true }).catch(() => undefined)
    await rm(partial, { force: true }).catch(() => undefined)
    await rememberMp3(recordingsDir, meta)
    return
  }
  if (mp3Size === 0) await rm(layout.audioPath, { force: true }).catch(() => undefined)
  if (wavSize !== null && wavSize > 0) {
    try {
      await encode(layout.captureAudioPath, layout.audioPath)
    } catch {
      return
    }
    const fresh = await readMeta(recordingsDir, id)
    if (fresh) await rememberMp3(recordingsDir, fresh)
    return
  }
  await rm(partial, { force: true }).catch(() => undefined)
}

async function rememberMp3(recordingsDir: string, meta: RecordingMeta): Promise<void> {
  if (meta.paths.audio === LIBRARY_AUDIO_FILE) return
  await writeMeta(recordingsDir, {
    ...meta,
    paths: { ...meta.paths, audio: LIBRARY_AUDIO_FILE }
  })
}

async function byteSize(path: string): Promise<number | null> {
  const info = await stat(path).catch(() => null)
  if (!info?.isFile()) return null
  return info.size
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
