import { readFile, stat } from 'node:fs/promises'
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { resolveFfmpegBinary } from '../../capture/ffmpeg-binary'
import type { TranscriptDocument } from '../transcript/parse'
import { STT_BITRATE, runSttFfmpeg } from './stt-prepare'
import { stitchSttPieces, type SttPiece, type SttPieceAt } from './stt-stitch'

/** Split when the prepared MP3 is larger than this. Decimal bytes, under a 25_000_000 reading of "25 MB". */
export const STT_UPLOAD_MAX_BYTES = 24_000_000

/** Planned media size of each piece. Lower than the max so a frame snap cannot cross the max. */
export const STT_CHUNK_TARGET_BYTES = 22_000_000

const SPLIT_FAILURE = 'Could not split the recording for speech-to-text.'
const PIECE_TOO_LARGE = 'A split piece is still over the 24 MB upload limit.'

export interface SttChunkFile {
  path: string
  fileName: string
  offsetSec: number
}

export interface SttSegmentSpan {
  path: string
  fileName: string
  start: number
  end: number
}

export interface SttSplitResult {
  chunks: SttChunkFile[]
  timelineEndSec: number
}

export function needsSttSplit(size: number): boolean {
  return size > STT_UPLOAD_MAX_BYTES
}

export function sttBytesPerSecond(bitrate: string): number {
  const match = /^(\d+)k$/i.exec(bitrate)
  const kilo = match?.[1]
  if (!kilo) {
    throw new Error(`Unsupported speech bitrate: ${bitrate}`)
  }
  return (Number(kilo) * 1_000) / 8
}

export function sttSegmentSeconds(
  targetBytes = STT_CHUNK_TARGET_BYTES,
  bitrate = STT_BITRATE
): number {
  return Math.floor(targetBytes / sttBytesPerSecond(bitrate))
}

export function sttSegmentArgs(
  inputPath: string,
  listPath: string,
  outputPattern: string,
  segmentSec: number
): string[] {
  return [
    '-hide_banner',
    '-y',
    '-i',
    inputPath,
    '-map',
    '0:a:0',
    '-f',
    'segment',
    '-segment_time',
    String(segmentSec),
    '-reset_timestamps',
    '1',
    '-segment_list',
    listPath,
    '-segment_list_type',
    'csv',
    '-c',
    'copy',
    outputPattern
  ]
}

export function parseSegmentList(csv: string, dir: string): SttSegmentSpan[] {
  const root = resolve(dir)
  const rows: SttSegmentSpan[] = []
  for (const line of csv.split(/\r?\n/)) {
    if (line.trim() === '') continue
    const fields = line.split(',')
    if (fields.length !== 3) throw new Error(SPLIT_FAILURE)
    const name = fields[0] ?? ''
    const start = Number(fields[1])
    const end = Number(fields[2])
    if (!name || !Number.isFinite(start) || !Number.isFinite(end) || !(end > start)) {
      throw new Error(SPLIT_FAILURE)
    }
    const path = segmentFilePath(root, name)
    rows.push({ path, fileName: basename(path), start, end })
  }
  if (rows.length === 0) throw new Error(SPLIT_FAILURE)
  rows.sort((left, right) => left.start - right.start)
  return rows
}

export async function splitPreparedMp3(
  preparedPath: string,
  options?: {
    resolveFfmpeg?: () => Promise<string>
    runFfmpeg?: (ffmpeg: string, args: string[]) => Promise<void>
    stat?: (path: string) => Promise<{ size: number }>
  }
): Promise<SttSplitResult> {
  const resolveFfmpeg = options?.resolveFfmpeg ?? (() => resolveFfmpegBinary())
  const runFfmpeg =
    options?.runFfmpeg ??
    ((ffmpeg: string, args: string[]) => runSttFfmpeg(ffmpeg, args, SPLIT_FAILURE))
  const statFile = options?.stat ?? stat
  const dir = dirname(preparedPath)
  const listPath = join(dir, 'chunks.csv')
  const outputPattern = join(dir, 'chunk-%03d.mp3')
  const ffmpeg = await resolveFfmpeg()
  await runFfmpeg(
    ffmpeg,
    sttSegmentArgs(preparedPath, listPath, outputPattern, sttSegmentSeconds())
  )
  const rows = parseSegmentList(await readFile(listPath, 'utf8'), dir)
  for (const row of rows) {
    const info = await statFile(row.path)
    if (info.size > STT_UPLOAD_MAX_BYTES) throw new Error(PIECE_TOO_LARGE)
  }
  const last = rows[rows.length - 1]
  if (!last) throw new Error(SPLIT_FAILURE)
  return {
    chunks: rows.map((row) => ({
      path: row.path,
      fileName: row.fileName,
      offsetSec: row.start
    })),
    timelineEndSec: last.end
  }
}

export async function transcribeChunks(input: {
  chunks: SttChunkFile[]
  model: string
  createdAt: string
  timelineEndSec: number
  post: (chunk: { path: string; fileName: string }, onWaiting: () => void) => Promise<unknown>
  toPiece: (payload: unknown) => SttPiece
  onProgress?: (event: { index: number; count: number; phase: 'uploading' | 'waiting' }) => void
}): Promise<TranscriptDocument> {
  const pieces: SttPieceAt[] = []
  const count = input.chunks.length
  for (let index = 0; index < count; index += 1) {
    const chunk = input.chunks[index]
    if (!chunk) continue
    input.onProgress?.({ index, count, phase: 'uploading' })
    const payload = await input.post({ path: chunk.path, fileName: chunk.fileName }, () => {
      input.onProgress?.({ index, count, phase: 'waiting' })
    })
    pieces.push({ ...input.toPiece(payload), offsetSec: chunk.offsetSec })
  }
  return stitchSttPieces(pieces, {
    model: input.model,
    createdAt: input.createdAt,
    timelineEndSec: input.timelineEndSec
  })
}

function segmentFilePath(root: string, name: string): string {
  const candidate = isAbsolute(name) ? resolve(name) : resolve(root, name)
  const rel = relative(root, candidate)
  if (rel === '' || rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) {
    throw new Error(SPLIT_FAILURE)
  }
  return candidate
}
