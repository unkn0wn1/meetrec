import { open, stat, type FileHandle } from 'node:fs/promises'

/**
 * Int16 RMS below this counts as near-silence.
 * 500 is about -36 dBFS against full scale 32768.
 */
export const SILENCE_RMS_FLOOR = 500

/** One second of stereo pcm_s16le at 48 kHz. A mono file spans about two seconds in this window. */
export const PCM_WINDOW_BYTES = 48_000 * 2 * 2

const PCM_FRAME_BYTES = 4
const HEADER_BYTES = 4096
export const SILENCE_TICK_MS = 1000

export function rmsInt16(samples: Int16Array): number {
  if (samples.length === 0) return 0
  let sum = 0
  for (let i = 0; i < samples.length; i += 1) {
    const sample = samples[i] ?? 0
    sum += sample * sample
  }
  return Math.sqrt(sum / samples.length)
}

/** Opening stretch ignored so connect noise does not count. */
export function silenceGraceMs(thresholdSeconds: number): number {
  return Math.min(15_000, (thresholdSeconds / 2) * 1000)
}

export function advanceSilence(input: {
  silentMs: number
  elapsedMs: number
  tickMs: number
  graceMs: number
  thresholdMs: number
  /** null when this tick has no readable samples. */
  rms: number | null
}): { silentMs: number; trip: boolean } {
  if (input.elapsedMs < input.graceMs) return { silentMs: 0, trip: false }
  if (input.rms === null) return { silentMs: input.silentMs, trip: false }
  if (input.rms >= SILENCE_RMS_FLOOR) return { silentMs: 0, trip: false }
  const silentMs = input.silentMs + input.tickMs
  return { silentMs, trip: silentMs >= input.thresholdMs }
}

export function pcmDataOffset(file: Buffer): number | null {
  if (file.length < 12) return null
  if (file.toString('ascii', 0, 4) !== 'RIFF') return null
  if (file.toString('ascii', 8, 12) !== 'WAVE') return null
  let offset = 12
  while (offset + 8 <= file.length) {
    const id = file.toString('ascii', offset, offset + 4)
    if (id === 'data') return offset + 8
    const size = file.readUInt32LE(offset + 4)
    // ffmpeg leaves 0xFFFFFFFF in the header until stop. Do not skip that far.
    if (size === 0xffffffff) return null
    const step = 8 + size + (size % 2)
    if (step < 8) return null
    offset += step
  }
  return null
}

export function pcmWindowRange(
  size: number,
  pcmStart: number,
  windowBytes = PCM_WINDOW_BYTES
): { position: number; length: number } | null {
  if (!Number.isInteger(pcmStart) || pcmStart < 0 || pcmStart >= size) return null
  const available = size - pcmStart
  const aligned = available - (available % PCM_FRAME_BYTES)
  if (aligned < PCM_FRAME_BYTES) return null
  const length = Math.min(windowBytes, aligned)
  const frame = length - (length % PCM_FRAME_BYTES)
  if (frame < PCM_FRAME_BYTES) return null
  return { position: pcmStart + aligned - frame, length: frame }
}

export function tailSamples(file: Buffer): Int16Array | null {
  const pcmStart = pcmDataOffset(file)
  if (pcmStart === null) return null
  const range = pcmWindowRange(file.length, pcmStart)
  if (!range) return null
  return int16From(file.subarray(range.position, range.position + range.length))
}

export async function readLastPcmWindow(path: string): Promise<Int16Array | null> {
  let size = 0
  try {
    size = (await stat(path)).size
  } catch {
    return null
  }
  if (size < 12) return null
  let handle: FileHandle
  try {
    handle = await open(path, 'r')
  } catch {
    return null
  }
  try {
    const headerLen = Math.min(size, HEADER_BYTES)
    const header = Buffer.alloc(headerLen)
    const head = await handle.read(header, 0, headerLen, 0)
    if (head.bytesRead < 12) return null
    const pcmStart = pcmDataOffset(header.subarray(0, head.bytesRead))
    if (pcmStart === null) return null
    const range = pcmWindowRange(size, pcmStart)
    if (!range) return null
    const buf = Buffer.alloc(range.length)
    const body = await handle.read(buf, 0, range.length, range.position)
    const got = body.bytesRead - (body.bytesRead % PCM_FRAME_BYTES)
    if (got < PCM_FRAME_BYTES) return null
    return int16From(buf.subarray(0, got))
  } catch {
    // A flush in progress is not a silence sample and not a loud sample.
    return null
  } finally {
    await handle.close()
  }
}

function int16From(pcm: Buffer): Int16Array {
  const samples = new Int16Array(pcm.length / 2)
  for (let i = 0; i < samples.length; i += 1) {
    samples[i] = pcm.readInt16LE(i * 2)
  }
  return samples
}

export interface SilenceWatch {
  clear(): void
}

export function createSilenceWatch(input: {
  outPath: string
  startedAtMs: number
  thresholdSeconds: number
  onTrip: () => void
  now?: () => number
  readSamples?: (path: string) => Promise<Int16Array | null>
  schedule?: (fn: () => void, ms: number) => () => void
  intervalMs?: number
}): SilenceWatch {
  const now = input.now ?? ((): number => Date.now())
  const readSamples = input.readSamples ?? readLastPcmWindow
  const schedule = input.schedule ?? defaultSchedule
  const intervalMs = input.intervalMs ?? SILENCE_TICK_MS
  const graceMs = silenceGraceMs(input.thresholdSeconds)
  const thresholdMs = input.thresholdSeconds * 1000
  let silentMs = 0
  let stopped = false
  let pending = false
  let cancel = (): void => undefined

  const watch: SilenceWatch = {
    clear(): void {
      stopped = true
      const stopTimer = cancel
      cancel = () => undefined
      stopTimer()
    }
  }

  async function tick(): Promise<void> {
    if (stopped || pending) return
    pending = true
    try {
      const elapsedMs = now() - input.startedAtMs
      if (elapsedMs < graceMs) {
        silentMs = 0
        return
      }
      let samples: Int16Array | null = null
      try {
        samples = await readSamples(input.outPath)
      } catch {
        samples = null
      }
      if (stopped) return
      const rms = samples && samples.length > 0 ? rmsInt16(samples) : null
      // Each quiet tick adds one interval. A late callback does not bank the gap.
      const next = advanceSilence({
        silentMs,
        elapsedMs,
        tickMs: intervalMs,
        graceMs,
        thresholdMs,
        rms
      })
      silentMs = next.silentMs
      if (!next.trip) return
      watch.clear()
      input.onTrip()
    } finally {
      pending = false
    }
  }

  cancel = schedule(() => {
    void tick()
  }, intervalMs)
  return watch
}

function defaultSchedule(fn: () => void, ms: number): () => void {
  const timer = setInterval(fn, ms)
  return () => {
    clearInterval(timer)
  }
}
