import { spawn, type ChildProcess } from 'node:child_process'
import { constants } from 'node:fs'
import { access, stat } from 'node:fs/promises'
import type { AudioCapture, CaptureMode, CaptureStartOptions, CaptureStopResult } from './types'
import { durationMs } from './duration'
import {
  monitorNameForSink,
  parseDefaultSink,
  parseFfmpegPulseSources,
  type PulseDevices
} from './pulse-devices'

const SAMPLE_RATE = 48000

interface RunningCapture {
  child: ChildProcess
  outPath: string
  startedAtMs: number
  captureMode: CaptureMode
  note: string | null
}

export class LinuxCapture implements AudioCapture {
  private running: RunningCapture | null = null
  private readonly which: (bin: string) => Promise<boolean>
  private readonly runText: (cmd: string, args: string[]) => Promise<string>

  constructor(deps?: {
    which?: (bin: string) => Promise<boolean>
    runText?: (cmd: string, args: string[]) => Promise<string>
  }) {
    this.which = deps?.which ?? defaultWhich
    this.runText = deps?.runText ?? defaultRunText
  }

  async start(
    opts: CaptureStartOptions
  ): Promise<{ captureMode: CaptureMode; note: string | null }> {
    if (this.running) {
      throw new Error('A recording is already in progress.')
    }
    if (!(await this.which('ffmpeg'))) {
      throw new Error('ffmpeg is not installed. Install it to record audio on Linux.')
    }
    if (!(await this.which('pactl'))) {
      throw new Error('pactl is not installed. PipeWire or PulseAudio is required.')
    }

    const devices = await this.detectDevices()
    const plan = planCapture(devices)
    const sampleRate = opts.sampleRate ?? SAMPLE_RATE
    const args = ffmpegArgs(plan, opts.outPath, sampleRate)
    const child = spawn('ffmpeg', args, { stdio: ['ignore', 'ignore', 'pipe'] })

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

  private async detectDevices(): Promise<PulseDevices> {
    const [sourcesText, sinkText] = await Promise.all([
      this.runText('ffmpeg', ['-hide_banner', '-sources', 'pulse']),
      this.runText('pactl', ['get-default-sink'])
    ])
    const parsed = parseFfmpegPulseSources(sourcesText)
    return {
      defaultSource: parsed.defaultSource,
      defaultSink: parseDefaultSink(sinkText),
      sources: parsed.sources
    }
  }
}

export function planCapture(devices: PulseDevices): {
  mode: CaptureMode
  mic: string
  monitor: string | null
  note: string | null
} {
  if (!devices.defaultSource) {
    throw new Error('No default microphone found. Check PulseAudio / PipeWire sources.')
  }
  const sink = devices.defaultSink
  if (!sink) {
    return {
      mode: 'mic-only',
      mic: devices.defaultSource,
      monitor: null,
      note: 'System monitor was not found. Recording microphone only. TODO: mix default sink monitor when pactl reports a sink.'
    }
  }
  const monitor = monitorNameForSink(sink)
  const listed = devices.sources.some((source) => source.name === monitor)
  if (!listed) {
    return {
      mode: 'mix',
      mic: devices.defaultSource,
      monitor,
      note: `Monitor ${monitor} was not listed by ffmpeg; still requesting it from Pulse.`
    }
  }
  return {
    mode: 'mix',
    mic: devices.defaultSource,
    monitor,
    note: null
  }
}

export function ffmpegArgs(
  plan: { mode: CaptureMode; mic: string; monitor: string | null },
  outPath: string,
  sampleRate: number
): string[] {
  const rate = String(sampleRate)
  if (plan.mode === 'mix' && plan.monitor) {
    return [
      '-hide_banner',
      '-loglevel',
      'error',
      '-f',
      'pulse',
      '-ac',
      '1',
      '-ar',
      rate,
      '-i',
      plan.mic,
      '-f',
      'pulse',
      '-ac',
      '2',
      '-ar',
      rate,
      '-i',
      plan.monitor,
      '-filter_complex',
      `[0:a]aformat=sample_fmts=s16:sample_rates=${rate}:channel_layouts=mono[mic];` +
        `[1:a]aformat=sample_fmts=s16:sample_rates=${rate}:channel_layouts=stereo[sys];` +
        '[mic][sys]amix=inputs=2:duration=longest:dropout_transition=0,' +
        'aformat=sample_fmts=s16:channel_layouts=stereo',
      '-c:a',
      'pcm_s16le',
      outPath
    ]
  }

  return [
    '-hide_banner',
    '-loglevel',
    'error',
    '-f',
    'pulse',
    '-ac',
    '1',
    '-ar',
    rate,
    '-i',
    plan.mic,
    '-c:a',
    'pcm_s16le',
    outPath
  ]
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

function quitFfmpeg(child: ChildProcess): Promise<void> {
  return new Promise((resolve, reject) => {
    if (child.exitCode !== null || child.signalCode !== null) {
      resolve()
      return
    }
    const timer = setTimeout(() => {
      child.kill('SIGKILL')
    }, 4000)
    child.once('exit', () => {
      clearTimeout(timer)
      resolve()
    })
    child.once('error', (error) => {
      clearTimeout(timer)
      reject(error)
    })
    child.kill('SIGINT')
  })
}

async function fileSize(path: string): Promise<number> {
  await access(path, constants.R_OK)
  const info = await stat(path)
  return info.size
}

async function defaultWhich(bin: string): Promise<boolean> {
  return new Promise((resolve) => {
    const child = spawn('which', [bin], { stdio: 'ignore' })
    child.once('exit', (code) => resolve(code === 0))
    child.once('error', () => resolve(false))
  })
}

function defaultRunText(cmd: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] })
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
