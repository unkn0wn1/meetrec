import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  PCM_WINDOW_BYTES,
  SILENCE_RMS_FLOOR,
  advanceSilence,
  createSilenceWatch,
  pcmDataOffset,
  readLastPcmWindow,
  rmsInt16,
  silenceGraceMs,
  tailSamples
} from './silence-watch'

describe('silence RMS', () => {
  it('scores a silent buffer under the floor and a loud buffer over it', () => {
    expect(rmsInt16(new Int16Array(8))).toBe(0)
    expect(rmsInt16(Int16Array.from([SILENCE_RMS_FLOOR, SILENCE_RMS_FLOOR]))).toBe(
      SILENCE_RMS_FLOOR
    )
    expect(rmsInt16(Int16Array.from([8000, -8000, 8000, -8000]))).toBeGreaterThan(SILENCE_RMS_FLOOR)
  })

  it('uses the last second, including a WAV whose data size is not final', () => {
    const loud = pcmTone(48_000, 8000)
    const quiet = pcmTone(48_000, 0)
    const file = wav(Buffer.concat([loud, quiet]), 0xffffffff)
    expect(pcmDataOffset(file)).toBeGreaterThan(12)
    const tail = tailSamples(file)
    expect(tail).not.toBeNull()
    expect(tail?.length).toBe(PCM_WINDOW_BYTES / 2)
    expect(rmsInt16(tail ?? new Int16Array())).toBe(0)

    const reversed = tailSamples(wav(Buffer.concat([quiet, loud])))
    expect(rmsInt16(reversed ?? new Int16Array())).toBe(8000)
  })

  it('reads the tail of a growing file and ignores a header that is still short', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'meetrec-silence-'))
    try {
      const path = join(dir, 'audio.wav')
      await writeFile(path, Buffer.from('RIFF'))
      expect(await readLastPcmWindow(path)).toBeNull()

      const loud = pcmTone(48_000, 8000)
      const quiet = pcmTone(48_000, 0)
      await writeFile(path, wav(Buffer.concat([loud, quiet]), 0xffffffff))
      const tail = await readLastPcmWindow(path)
      expect(tail).not.toBeNull()
      expect(rmsInt16(tail ?? new Int16Array())).toBe(0)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})

describe('silence accumulation', () => {
  const tick = {
    elapsedMs: 20_000,
    tickMs: 1000,
    graceMs: 15_000,
    thresholdMs: 3000,
    silentMs: 0,
    rms: 0
  }

  it('ignores the opening grace, then trips once the streak reaches the threshold', () => {
    expect(silenceGraceMs(120)).toBe(15_000)
    expect(silenceGraceMs(30)).toBe(15_000)
    expect(silenceGraceMs(4)).toBe(2_000)
    expect(advanceSilence({ ...tick, elapsedMs: 14_000, silentMs: 2000 })).toEqual({
      silentMs: 0,
      trip: false
    })
    expect(advanceSilence(tick)).toEqual({ silentMs: 1000, trip: false })
    expect(advanceSilence({ ...tick, silentMs: 2000 })).toEqual({ silentMs: 3000, trip: true })
  })

  it('resets on a loud sample and holds the streak when a sample is missing', () => {
    expect(advanceSilence({ ...tick, silentMs: 2000, rms: SILENCE_RMS_FLOOR })).toEqual({
      silentMs: 0,
      trip: false
    })
    expect(advanceSilence({ ...tick, silentMs: 2000, rms: SILENCE_RMS_FLOOR - 1 })).toEqual({
      silentMs: 3000,
      trip: true
    })
    expect(advanceSilence({ ...tick, silentMs: 2000, rms: null })).toEqual({
      silentMs: 2000,
      trip: false
    })
  })
})

describe('silence watch loop', () => {
  it('trips once after sustained silence and stops when cleared', async () => {
    const clock = fakeClock()
    let samples: Int16Array | null = new Int16Array(8)
    let trips = 0
    const watch = createSilenceWatch({
      outPath: 'audio.wav',
      startedAtMs: 0,
      thresholdSeconds: 2,
      now: clock.now,
      readSamples: async () => samples,
      schedule: clock.schedule,
      onTrip: () => {
        trips += 1
      }
    })

    await clock.advance(1000)
    expect(trips).toBe(0)
    await clock.advance(1000)
    expect(trips).toBe(1)
    await clock.advance(5000)
    expect(trips).toBe(1)

    samples = Int16Array.from([8000, 8000, 8000, 8000])
    const again = createSilenceWatch({
      outPath: 'audio.wav',
      startedAtMs: clock.now(),
      thresholdSeconds: 2,
      now: clock.now,
      readSamples: async () => samples,
      schedule: clock.schedule,
      onTrip: () => {
        trips += 1
      }
    })
    await clock.advance(3000)
    expect(trips).toBe(1)
    samples = new Int16Array(8)
    await clock.advance(1000)
    expect(trips).toBe(1)
    await clock.advance(1000)
    expect(trips).toBe(2)
    again.clear()
    await clock.advance(5000)
    expect(trips).toBe(2)
    watch.clear()
  })

  it('does not trip when clear wins a read that is still in flight', async () => {
    let now = 0
    let run = (): void => undefined
    let release: (samples: Int16Array | null) => void = () => undefined
    let trips = 0
    const watch = createSilenceWatch({
      outPath: 'audio.wav',
      startedAtMs: 0,
      thresholdSeconds: 0,
      now: () => now,
      readSamples: () =>
        new Promise((resolve) => {
          release = resolve
        }),
      schedule: (fn) => {
        run = fn
        return () => {
          run = () => undefined
        }
      },
      onTrip: () => {
        trips += 1
      }
    })
    now = 1000
    run()
    watch.clear()
    release(new Int16Array(8))
    await flush()
    expect(trips).toBe(0)
  })
})

function pcmTone(frames: number, amplitude: number): Buffer {
  const buf = Buffer.alloc(frames * 4)
  for (let i = 0; i < frames * 2; i += 1) buf.writeInt16LE(amplitude, i * 2)
  return buf
}

function wav(pcm: Buffer, dataSize = pcm.length): Buffer {
  const fmt = Buffer.alloc(16)
  fmt.writeUInt16LE(1, 0)
  fmt.writeUInt16LE(2, 2)
  fmt.writeUInt32LE(48_000, 4)
  fmt.writeUInt32LE(48_000 * 4, 8)
  fmt.writeUInt16LE(4, 12)
  fmt.writeUInt16LE(16, 14)
  const junk = Buffer.alloc(4)
  const body = Buffer.concat([
    chunk('JUNK', junk),
    chunk('fmt ', fmt),
    chunk('data', pcm, dataSize)
  ])
  const head = Buffer.alloc(12)
  head.write('RIFF', 0)
  head.writeUInt32LE(4 + body.length, 4)
  head.write('WAVE', 8)
  return Buffer.concat([head, body])
}

function chunk(id: string, payload: Buffer, declared = payload.length): Buffer {
  const head = Buffer.alloc(8)
  head.write(id, 0)
  head.writeUInt32LE(declared, 4)
  return Buffer.concat([head, payload])
}

function fakeClock(): {
  now: () => number
  schedule: (fn: () => void, ms: number) => () => void
  advance: (ms: number) => Promise<void>
} {
  let now = 0
  const timers: { fn: () => void; every: number; next: number; dead: boolean }[] = []
  return {
    now: () => now,
    schedule(fn, ms) {
      const timer = { fn, every: ms, next: now + ms, dead: false }
      timers.push(timer)
      return () => {
        timer.dead = true
      }
    },
    async advance(ms) {
      const target = now + ms
      for (;;) {
        const due = timers
          .filter((timer) => !timer.dead && timer.next <= target)
          .sort((a, b) => a.next - b.next)[0]
        if (!due) break
        now = due.next
        due.next += due.every
        due.fn()
        await flush()
      }
      now = target
    }
  }
}

function flush(): Promise<void> {
  return Promise.resolve().then(() => Promise.resolve())
}
