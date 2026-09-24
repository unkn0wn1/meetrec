import { spawn } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { resolveFfmpegBinary } from '../../capture/ffmpeg-binary'

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
  }
): Promise<PreparedSttAudio> {
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
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpeg, args, {
      stdio: ['ignore', 'ignore', 'pipe'],
      windowsHide: true
    })
    const chunks: Buffer[] = []
    child.stderr?.on('data', (chunk: Buffer) => chunks.push(chunk))
    child.once('error', (error) => {
      reject(new Error(`ffmpeg failed to start: ${error.message}`))
    })
    child.once('exit', (code) => {
      if (code === 0) {
        resolve()
        return
      }
      const detail = Buffer.concat(chunks)
        .toString('utf8')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 200)
      reject(new Error(detail ? `${failure}: ${detail}` : failure))
    })
  })
}
