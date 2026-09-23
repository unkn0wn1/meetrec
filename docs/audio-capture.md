# Audio capture

## Interface (main)

```ts
export interface AudioCapture {
  start(opts: { outPath: string; sampleRate?: number }): Promise<{
    captureMode: 'mix' | 'mic-only'
    note: string | null
  }>
  stop(): Promise<{
    outPath: string
    durationMs: number
    captureMode: 'mix' | 'mic-only'
    note: string | null
  }>
}
```

Pick implementation once at startup from `process.platform`.

## Backends

| OS      | Approach                                                                                                                                                          |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Windows | ffmpeg. WASAPI mic + playback loopback when `ffmpeg -devices` lists a `wasapi` demuxer. Otherwise DirectShow mic + Stereo Mix (or another loopback capture name). |
| macOS   | ScreenCaptureKit system audio where available; else document virtual device (e.g. BlackHole). Stub throws.                                                        |
| Linux   | ffmpeg `pulse` input: default mic + `<default sink>.monitor`, mixed to one PCM WAV. Mic-only if no sink, with a TODO note.                                        |

## Mix

Produce **one** interleaved stereo `pcm_s16le` WAV (default 48000 Hz) the user can play back. Perfect per-speaker hardware separation is out of scope; diarization is software-side via STT.

## Windows (ffmpeg)

`ffmpeg` must be on PATH. Installable builds do not bundle the binary either; see [packaging.md](packaging.md).

Current ffmpeg builds have no WASAPI demuxer ([ticket 9408](https://trac.ffmpeg.org/ticket/9408)). Capture then uses DirectShow:

- List: `ffmpeg -list_devices true -f dshow -i dummy`
- Mix the microphone with a loopback capture device (Stereo Mix, Wave Out Mix, What U Hear, Mixed Output, or a name containing `loopback`).
- If none is listed, record the mic only and set a note that includes a TODO. Enable Stereo Mix under Sound → Recording → show disabled devices when the driver has it.

When `ffmpeg -devices` lists `wasapi` and `ffmpeg -h demuxer=wasapi` shows a loopback option, capture uses that demuxer instead: default capture endpoint plus default render loopback (`-loopback 1`, or `loopback_device=` / `loopback_system=true` when that is the option ffmpeg prints). An unrecognized WASAPI device list throws.

Stop writes `q` to ffmpeg's stdin so the WAV header is flushed.

## Stop helpers (recording domain, not capture)

- Manual Stop (shipped)
- Calendar end plus a grace period (not built)
- Near-silence for N seconds (not built; never the only stop)

Capture backend only starts, stops, and reports capture mode plus a note. Policy lives in `recording`.
