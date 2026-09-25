import { copyFile, mkdtemp, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, extname, join } from 'node:path'
import { resolveFfmpegBinary } from '../../capture/ffmpeg-binary'
import { runFfmpeg as runCapturedFfmpeg } from '../../capture/ffmpeg-run'
import { LIBRARY_MP3_BITRATE } from '../recording/encode-mp3'

/** Speech models prefer 16 kHz mono; MP3 keeps uploads under Cloudflare/OpenAI body caps. */
export const STT_SAMPLE_RATE = 16_000
export const STT_BITRATE = '48k'
export const STT_MIME = 'audio/mpeg'
export const STT_EXT = 'mp3'

export interface PreparedSttAudio {
  path: string
  mimeType: string
  fileName: string
  cleanup: () => Promise<void>
  /** Set when `path` is already the library MP3 (or a temp copy of it). Split uses this. */
  bitrate?: string
}

export function sttPrepareArgs(inputPath: string, outputPath: string): string[] {
  return [
    '-hide_banner',
    '-y',
    '-i',
    inputPath,
    '-ac',
    '1',
    '-ar',
    String(STT_SAMPLE_RATE),
    '-c:a',
    'libmp3lame',
    '-b:a',
    STT_BITRATE,
    outputPath
  ]
}

export async function prepareSttUpload(
  audioPath: string,
  options?: {
    resolveFfmpeg?: () => Promise<string>
    runFfmpeg?: (ffmpeg: string, args: string[]) => Promise<void>
    stat?: (path: string) => Promise<{ size: number; isFile?: () => boolean }>
    copyFile?: (from: string, to: string) => Promise<void>
  }
): Promise<PreparedSttAudio> {
  if (extname(audioPath).toLowerCase() === '.mp3') return adoptLibraryMp3(audioPath, options)
  const resolveFfmpeg = options?.resolveFfmpeg ?? (() => resolveFfmpegBinary())
  const runFfmpeg = options?.runFfmpeg ?? spawnFfmpeg
  const dir = await mkdtemp(join(tmpdir(), 'meetrec-stt-'))
  const fileName = `${basename(audioPath, '.wav') || 'audio'}.${STT_EXT}`
  const path = join(dir, fileName)
  const cleanup = async (): Promise<void> => {
    await rm(dir, { recursive: true, force: true })
  }
  try {
    const ffmpeg = await resolveFfmpeg()
    await runFfmpeg(ffmpeg, sttPrepareArgs(audioPath, path))
  } catch (error) {
    await cleanup()
    throw error instanceof Error
      ? error
      : new Error('Could not compress the recording for speech-to-text.')
  }
  return { path, mimeType: STT_MIME, fileName, cleanup }
}

const COMPRESS_FAILURE = 'Could not compress the recording for speech-to-text.'

function spawnFfmpeg(ffmpeg: string, args: string[]): Promise<void> {
  return runSttFfmpeg(ffmpeg, args, COMPRESS_FAILURE)
}

export function runSttFfmpeg(ffmpeg: string, args: string[], failure: string): Promise<void> {
  return runCapturedFfmpeg(ffmpeg, args, failure)
}

async function adoptLibraryMp3(
  audioPath: string,
  options?: {
    stat?: (path: string) => Promise<{ size: number; isFile?: () => boolean }>
    copyFile?: (from: string, to: string) => Promise<void>
  }
): Promise<PreparedSttAudio> {
  const statFile = options?.stat ?? stat
  const copy = options?.copyFile ?? copyFile
  const info = await statFile(audioPath)
  const isFile = typeof info.isFile === 'function' ? info.isFile() : info.size > 0
  if (!isFile || info.size <= 0) throw new Error(COMPRESS_FAILURE)
  const fileName = basename(audioPath)
  const prepared = {
    mimeType: STT_MIME,
    fileName,
    bitrate: LIBRARY_MP3_BITRATE
  }
  // stt-chunk imports this module. Load the cap once both modules have finished initializing.
  const { needsSttSplit } = await import('./stt-chunk')
  if (!needsSttSplit(info.size)) {
    return { ...prepared, path: audioPath, cleanup: async () => {} }
  }
  const dir = await mkdtemp(join(tmpdir(), 'meetrec-stt-'))
  const path = join(dir, fileName)
  const cleanup = async (): Promise<void> => {
    await rm(dir, { recursive: true, force: true })
  }
  try {
    await copy(audioPath, path)
  } catch (error) {
    await cleanup()
    throw error instanceof Error ? error : new Error(COMPRESS_FAILURE)
  }
  return { ...prepared, path, cleanup }
}
