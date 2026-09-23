import { spawn, type ChildProcess } from 'node:child_process'
import { constants } from 'node:fs'
import { access, stat } from 'node:fs/promises'
import type { AudioCapture, CaptureMode, CaptureStartOptions, CaptureStopResult } from './types'
import { durationMs } from './duration'
import { resolveFfmpegBinary } from './ffmpeg-binary'
import { parseDshowAudioDevices, selectDshowInputs } from './dshow-devices'
import {
  ffmpegListsDemuxer,
  parseWasapiDevices,
  parseWasapiHelp,
  pickWasapiEndpoint,
  type WasapiDevices,
  type WasapiLoopbackForm
} from './wasapi-devices'

const SAMPLE_RATE = 48000

const DSHOW_MIC_ONLY =
  'This ffmpeg has no WASAPI demuxer and no Stereo Mix or loopback capture device was listed. Recording microphone only. TODO: mix default playback loopback when WASAPI is available or Stereo Mix is enabled.'

const WASAPI_NO_LOOPBACK =
  'This ffmpeg WASAPI demuxer has no loopback option. Recording microphone only. TODO: mix default playback loopback.'

const WASAPI_NO_RENDER =
  'No WASAPI render device was listed. Recording microphone only. TODO: mix default playback loopback.'

export interface CapturePlan {
  mode: CaptureMode
  backend: 'dshow' | 'wasapi'
  mic: string
  system: string | null
  loopbackForm: WasapiLoopbackForm
  note: string | null
}

interface RunningCapture {
  child: ChildProcess
  outPath: string
  startedAtMs: number
  captureMode: CaptureMode
  note: string | null
}

export class WindowsCapture implements AudioCapture {
  private running: RunningCapture | null = null
  private readonly runText: (cmd: string, args: string[]) => Promise<string>

  constructor(deps?: { runText?: (cmd: string, args: string[]) => Promise<string> }) {
    this.runText = deps?.runText ?? defaultRunText
  }

  async start(
    opts: CaptureStartOptions
  ): Promise<{ captureMode: CaptureMode; note: string | null }> {
    if (this.running) {
      throw new Error('A recording is already in progress.')
    }
    const ffmpeg = await resolveFfmpegBinary()

    const plan = await this.detectPlan(ffmpeg)
    const sampleRate = opts.sampleRate ?? SAMPLE_RATE
    const args = ffmpegArgs(plan, opts.outPath, sampleRate)
    const child = spawn(ffmpeg, args, {
      stdio: ['pipe', 'ignore', 'pipe'],
      windowsHide: true
    })

    const stderrChunks: Buffer[] = []
    child.stderr?.on('data', (chunk: Buffer) => {
      stderrChunks.push(chunk)
      if (stderrChunks.length > 40) stderrChunks.shift()
    })

    const failedEarly = await waitForStart(child)
    if (failedEarly) {
      const detail = Buffer.concat(stderrChunks).toString('utf8').trim()
      throw new Error(detail ? `ffmpeg failed to start: ${detail}` : 'ffmpeg failed to start.')
    }

    this.running = {
      child,
      outPath: opts.outPath,
      startedAtMs: Date.now(),
      captureMode: plan.mode,
      note: plan.note
    }
    return { captureMode: plan.mode, note: plan.note }
  }

  async stop(): Promise<CaptureStopResult> {
    const running = this.running
    if (!running) {
      throw new Error('No recording is in progress.')
    }
    this.running = null

    await quitFfmpeg(running.child)
    const stoppedAtMs = Date.now()
    const bytes = await fileSize(running.outPath)
    if (bytes < 44) {
      throw new Error(`Recording file is empty: ${running.outPath}`)
    }

    return {
      outPath: running.outPath,
      durationMs: durationMs(running.startedAtMs, stoppedAtMs),
      captureMode: running.captureMode,
      note: running.note
    }
  }

  private async detectPlan(ffmpeg: string): Promise<CapturePlan> {
    const listed = await this.runText(ffmpeg, ['-hide_banner', '-devices'])
    if (!ffmpegListsDemuxer(listed, 'wasapi')) {
      const list = await this.runText(ffmpeg, [
        '-hide_banner',
        '-list_devices',
        'true',
        '-f',
        'dshow',
        '-i',
        'dummy'
      ])
      return planDshowCapture(parseDshowAudioDevices(list))
    }

    const [help, list] = await Promise.all([
      this.runText(ffmpeg, ['-hide_banner', '-h', 'demuxer=wasapi']),
      this.runText(ffmpeg, ['-hide_banner', '-f', 'wasapi', '-list_devices', 'true', '-i', 'dummy'])
    ])
    return planWasapiCapture({
      ...parseWasapiDevices(list),
      loopbackForm: parseWasapiHelp(help)
    })
  }
}

export function planDshowCapture(devices: { name: string }[]): CapturePlan {
  const selected = selectDshowInputs(devices)
  if (!selected.mic) {
    throw new Error('No microphone found. Check Windows recording devices.')
  }
  if (!selected.loopback) {
    return {
      mode: 'mic-only',
      backend: 'dshow',
      mic: selected.mic,
      system: null,
      loopbackForm: null,
      note: DSHOW_MIC_ONLY
    }
  }
  return {
    mode: 'mix',
    backend: 'dshow',
    mic: selected.mic,
    system: selected.loopback,
    loopbackForm: null,
    note: null
  }
}

export function planWasapiCapture(
  input: WasapiDevices & { loopbackForm: WasapiLoopbackForm }
): CapturePlan {
  const mic = pickWasapiEndpoint(input.captures)
  if (!mic) {
    throw new Error('No microphone found. Check Windows recording devices.')
  }
  const render = pickWasapiEndpoint(input.renders)
  if (!render || !input.loopbackForm) {
    return {
      mode: 'mic-only',
      backend: 'wasapi',
      mic,
      system: null,
      loopbackForm: null,
      note: input.loopbackForm ? WASAPI_NO_RENDER : WASAPI_NO_LOOPBACK
    }
  }
  return {
    mode: 'mix',
    backend: 'wasapi',
    mic,
    system: render,
    loopbackForm: input.loopbackForm,
    note: null
  }
}

export function ffmpegArgs(plan: CapturePlan, outPath: string, sampleRate: number): string[] {
  const rate = String(sampleRate)
  const mic = inputArgs(plan.backend, plan.mic, 1, rate, null)
  if (plan.mode === 'mix' && plan.system) {
    return [
      ...banner(),
      ...mic,
      ...inputArgs(plan.backend, plan.system, 2, rate, plan.loopbackForm),
      '-filter_complex',
      mixFilter(rate),
      ...pcm(outPath)
    ]
  }
  return [...banner(), ...mic, ...pcm(outPath)]
}

function banner(): string[] {
  return ['-hide_banner', '-loglevel', 'error']
}

function pcm(outPath: string): string[] {
  return ['-c:a', 'pcm_s16le', outPath]
}

function inputArgs(
  backend: CapturePlan['backend'],
  device: string,
  channels: number,
  rate: string,
  loopbackForm: WasapiLoopbackForm
): string[] {
  if (backend === 'dshow') {
    return [
      '-f',
      'dshow',
      '-sample_rate',
      rate,
      '-channels',
      String(channels),
      '-i',
      `audio=${device}`
    ]
  }
  if (loopbackForm === 'loopback') {
    return [
      '-f',
      'wasapi',
      '-loopback',
      '1',
      '-sample_rate',
      rate,
      '-channels',
      String(channels),
      '-i',
      device
    ]
  }
  if (loopbackForm === 'loopback_device') {
    return ['-f', 'wasapi', '-i', `loopback_device=${device}`]
  }
  if (loopbackForm === 'loopback_system') {
    return ['-f', 'wasapi', '-i', 'loopback_system=true']
  }
  return ['-f', 'wasapi', '-sample_rate', rate, '-channels', String(channels), '-i', device]
}

function mixFilter(rate: string): string {
  return (
    `[0:a]aformat=sample_fmts=s16:sample_rates=${rate}:channel_layouts=mono[mic];` +
    `[1:a]aformat=sample_fmts=s16:sample_rates=${rate}:channel_layouts=stereo[sys];` +
    '[mic][sys]amix=inputs=2:duration=longest:dropout_transition=0,' +
    'aformat=sample_fmts=s16:channel_layouts=stereo'
  )
}

function waitForStart(child: ChildProcess): Promise<boolean> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(false), 400)
    child.once('exit', () => {
      clearTimeout(timer)
      resolve(true)
    })
    child.once('error', () => {
      clearTimeout(timer)
      resolve(true)
    })
  })
}

/** stdin `q` so ffmpeg flushes the WAV header. kill() on Windows is TerminateProcess. */
function quitFfmpeg(child: ChildProcess): Promise<void> {
  return new Promise((resolve, reject) => {
    if (child.exitCode !== null || child.signalCode !== null) {
      resolve()
      return
    }
    const timer = setTimeout(() => {
      child.kill()
    }, 4000)
    child.once('exit', () => {
      clearTimeout(timer)
      resolve()
    })
    child.once('error', (error) => {
      clearTimeout(timer)
      reject(error)
    })
    const stdin = child.stdin
    if (!stdin || stdin.destroyed) {
      child.kill()
      return
    }
    stdin.once('error', () => {
      if (child.exitCode === null && child.signalCode === null) child.kill()
    })
    stdin.write('q')
    stdin.end()
  })
}

async function fileSize(path: string): Promise<number> {
  await access(path, constants.R_OK)
  const info = await stat(path)
  return info.size
}

function defaultRunText(cmd: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true })
    const chunks: Buffer[] = []
    child.stdout?.on('data', (chunk: Buffer) => chunks.push(chunk))
    child.stderr?.on('data', (chunk: Buffer) => chunks.push(chunk))
    child.once('error', reject)
    child.once('exit', (code) => {
      const text = Buffer.concat(chunks).toString('utf8')
      if (code !== 0 && !text.trim()) {
        reject(new Error(`${cmd} exited ${code ?? 'unknown'}`))
        return
      }
      resolve(text)
    })
  })
}
