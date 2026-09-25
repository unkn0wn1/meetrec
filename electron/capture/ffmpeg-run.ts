import { spawn } from 'node:child_process'

/** Spawn ffmpeg. Non-zero exits and start failures reject with `failure` plus a short stderr tail. */
export function runFfmpeg(ffmpeg: string, args: string[], failure: string): Promise<void> {
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
