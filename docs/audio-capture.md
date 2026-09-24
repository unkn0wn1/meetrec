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

`RecordingStatus.captureSupported` is false on darwin (and unknown platforms). The Record tab and calendar prompt disable Start / Auto-arm and show `unsupportedReason`.

## Backends

| OS      | Approach                                                                                                                                                                                        |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Windows | ffmpeg. WASAPI mic + playback loopback when `ffmpeg -devices` lists a `wasapi` demuxer. Otherwise DirectShow mic + Stereo Mix (or another loopback capture name).                               |
| macOS   | Not implemented. Start is disabled in the Record UI and calendar prompt. `MacosCapture` / `assertCaptureSupported` reject with a clear message. ScreenCaptureKit (or BlackHole) is future work. |
| Linux   | ffmpeg `pulse` input: default mic + `<default sink>.monitor`, mixed to one PCM WAV. Mic-only if no sink, with a TODO note.                                                                      |

## Mix

Produce **one** interleaved stereo `pcm_s16le` WAV (default 48000 Hz) the user can play back. Perfect per-speaker hardware separation is out of scope; diarization is software-side via STT.

## ffmpeg binary

Packaged Linux and Windows apps use the file at `resources/ffmpeg/ffmpeg` (`ffmpeg.exe` on Windows). `npm run dev` uses `ffmpeg` on `PATH`. If neither is available, start throws. The shipped build is the pinned BtbN LGPL-static binary in [packaging.md](packaging.md).

## Windows (ffmpeg)

Current ffmpeg builds have no WASAPI demuxer ([ticket 9408](https://trac.ffmpeg.org/ticket/9408)). Capture then uses DirectShow:

- List: `ffmpeg -list_devices true -f dshow -i dummy`
- Mix the microphone with a loopback capture device (Stereo Mix, Wave Out Mix, What U Hear, Mixed Output, or a name containing `loopback`).
- If none is listed, record the mic only and set a note that includes a TODO. Enable Stereo Mix under Sound → Recording → show disabled devices when the driver has it.

When `ffmpeg -devices` lists `wasapi` and `ffmpeg -h demuxer=wasapi` shows a loopback option, capture uses that demuxer instead: default capture endpoint plus default render loopback (`-loopback 1`, or `loopback_device=` / `loopback_system=true` when that is the option ffmpeg prints). An unrecognized WASAPI device list throws.

Stop writes `q` to ffmpeg's stdin so the WAV header is flushed.

## Stop helpers (recording domain, not capture)

- Manual Stop (shipped)
- Calendar end plus 2 minutes, only for a recording started from that event. Tray Stop or the Record Stop cancels it.
- Near-silence for N seconds (not built; never the only stop)

Capture backend only starts, stops, and reports capture mode plus a note. Policy lives in `recording`.
