import { rename, rm, stat } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { resolveFfmpegBinary } from '../../capture/ffmpeg-binary'
import { runFfmpeg } from '../../capture/ffmpeg-run'
import {
  CAPTURE_AUDIO_FILE,
  LIBRARY_AUDIO_FILE,
  LIBRARY_MP3_PARTIAL,
  libraryAudioContentType
} from './layout'

export const LIBRARY_MP3_BITRATE = '96k'

export const LIBRARY_MP3_FAILURE =
  'Could not save the recording as MP3. The original WAV is still in the library.'

export interface ResolvedLibraryAudio {
  path: string
  fileName: typeof LIBRARY_AUDIO_FILE | typeof CAPTURE_AUDIO_FILE
  mime: 'audio/mpeg' | 'audio/wav'
}

type RunFfmpeg = (ffmpeg: string, args: string[]) => Promise<void>

export function libraryMp3Args(inputPath: string, outputPath: string): string[] {
  return [
    '-hide_banner',
    '-y',
    '-i',
    inputPath,
    '-c:a',
    'libmp3lame',
    '-b:a',
    LIBRARY_MP3_BITRATE,
    outputPath
  ]
}

export function libraryMp3ProbeArgs(partialPath: string): string[] {
  return ['-hide_banner', '-v', 'error', '-i', partialPath, '-t', '0.05', '-f', 'null', '-']
}

export async function encodeWavToLibraryMp3(
  wavPath: string,
  mp3Path: string,
  options?: {
    resolveFfmpeg?: () => Promise<string>
    runFfmpeg?: RunFfmpeg
  }
): Promise<void> {
  const resolveFfmpeg = options?.resolveFfmpeg ?? (() => resolveFfmpegBinary())
  const run = options?.runFfmpeg ?? ((ffmpeg, args) => runFfmpeg(ffmpeg, args, LIBRARY_MP3_FAILURE))
  const wav = await stat(wavPath).catch(() => null)
  if (!wav?.isFile() || wav.size === 0) throw new Error(LIBRARY_MP3_FAILURE)

  const partial = join(dirname(mp3Path), LIBRARY_MP3_PARTIAL)
  await rm(partial, { force: true }).catch(() => undefined)
  let ffmpeg: string
  try {
    ffmpeg = await resolveFfmpeg()
  } catch (error) {
    throw error instanceof Error ? error : new Error(LIBRARY_MP3_FAILURE)
  }
  try {
    await run(ffmpeg, libraryMp3Args(wavPath, partial))
    const encoded = await stat(partial).catch(() => null)
    if (!encoded?.isFile() || encoded.size === 0) throw new Error(LIBRARY_MP3_FAILURE)
    await run(ffmpeg, libraryMp3ProbeArgs(partial))
    const existing = await stat(mp3Path).catch(() => null)
    if (existing) throw new Error(LIBRARY_MP3_FAILURE)
    await rename(partial, mp3Path)
  } catch (error) {
    await rm(partial, { force: true }).catch(() => undefined)
    throw error instanceof Error ? error : new Error(LIBRARY_MP3_FAILURE)
  }
  await rm(wavPath, { force: true }).catch(() => undefined)
}

/** Prefer a non-empty MP3, then a non-empty WAV. The partial name is never chosen. */
export async function resolveLibraryAudio(dir: string): Promise<ResolvedLibraryAudio | null> {
  const mp3 = await playable(join(dir, LIBRARY_AUDIO_FILE), LIBRARY_AUDIO_FILE)
  if (mp3) return mp3
  return playable(join(dir, CAPTURE_AUDIO_FILE), CAPTURE_AUDIO_FILE)
}

async function playable(
  path: string,
  fileName: ResolvedLibraryAudio['fileName']
): Promise<ResolvedLibraryAudio | null> {
  const info = await stat(path).catch(() => null)
  if (!info?.isFile() || info.size <= 0) return null
  const mime = libraryAudioContentType(fileName)
  if (!mime) return null
  return { path, fileName, mime }
}
