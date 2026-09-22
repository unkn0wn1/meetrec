# Audio capture

## Interface (main)

```ts
export interface AudioCapture {
  start(opts: { outPath: string; sampleRate?: number }): Promise<void>
  stop(): Promise<{ outPath: string; durationMs: number }>
  onLevel?(cb: (level: number) => void): void
}
```

Pick implementation once at startup from `process.platform`.

## Backends

| OS      | Approach (v1 intent)                                                                                                       |
| ------- | -------------------------------------------------------------------------------------------------------------------------- |
| Windows | WASAPI loopback + mic mix                                                                                                  |
| macOS   | ScreenCaptureKit system audio where available; else document virtual device (e.g. BlackHole)                               |
| Linux   | ffmpeg `pulse` input: default mic + `<default sink>.monitor`, mixed to one PCM WAV. Mic-only if no sink, with a TODO note. |

## Mix

Produce **one** interleaved file the user can play back. Perfect per-speaker hardware separation is out of scope; diarization is software-side via STT.

## Stop helpers (recording domain, not capture)

- Manual Stop (required)
- Calendar end + grace period
- Near-silence for N seconds (configurable; never the only stop)

Capture backend only starts/stops and reports levels. Policy lives in `recording`.
