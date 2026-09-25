# Mac system audio plan

Status: proposal, 2026-09-24. Nothing in this document is shipped. Platform order stays Linux first ([open-decisions.md](open-decisions.md)). `captureSupported` stays false on darwin until a later change meets the Phase 3 exit below.

## Goal

Ship mic + system audio on macOS as one interleaved stereo `pcm_s16le` WAV at 48000 Hz, through the existing `AudioCapture` contract, with honest permission UX. The user records what they already hear and say. MeetRec does not join the call.

The packaged app is a direct download (DMG and zip), signed with Developer ID and notarized. Apple Silicon first.

## Non-goals

- Treating a mic-only Mac build as done. The product loop is mic + system audio ([product.md](product.md)).
- Requiring BlackHole, Loopback, or any other virtual audio device.
- Mac App Store distribution or sandbox polish. That non-goal is already locked.
- An Electron major bump (35 → 39 or later) inside this epic.
- Intel or universal binaries in the first Mac release.
- Changing the Linux or Windows capture pipelines.
- Auto-update.

## Where the repo is

`main` at `4ed1bfb` (PR #23 merged).

| Fact          | Detail                                                                                                                                                                                                                                          |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| macOS capture | `electron/capture/macos.ts` is a hard stub. `start` calls `assertCaptureSupported` and throws.                                                                                                                                                  |
| UX            | `electron/capture/support.ts` sets `captureSupported=false` on darwin. Record and the calendar prompt disable Start / Auto-arm and show `unsupportedReason`.                                                                                    |
| Copy          | "macOS capture is not available in this build. MeetRec records mic + system audio on Linux and Windows (experimental). Full Mac system audio needs ScreenCaptureKit work that is not shipped yet."                                              |
| Linux         | ffmpeg `pulse`: default mic + `<default sink>.monitor` → `amix` → the WAV contract. Mic-only if there is no sink, with a note.                                                                                                                  |
| Windows       | ffmpeg WASAPI loopback when that demuxer exists, otherwise DirectShow mic + Stereo Mix (or another loopback name). Same WAV contract.                                                                                                           |
| Contract      | `AudioCapture.start({ outPath, sampleRate? })` → `{ captureMode, note }`. `stop()` → `{ outPath, durationMs, captureMode, note }`. `captureMode` is `mix` or `mic-only`. `durationMs` is wall clock via `durationMs(startedAtMs, stoppedAtMs)`. |
| Packaging     | `electron-builder.yml` builds a Linux AppImage and Windows NSIS + portable (x64). There is no `mac` target. `appId` is `io.techglint.meetrec`.                                                                                                  |
| ffmpeg fetch  | `scripts/fetch-ffmpeg.mjs` pins BtbN LGPL-static linux64 and win64 only. A bare run on darwin throws `Pass --platform linux, win, or all.`                                                                                                      |
| Stack         | Electron `^35.7.5`, electron-builder `^26.15.3`.                                                                                                                                                                                                |
| Releases      | `.github/workflows/release.yml` is ubuntu + windows. Windows tag builds use Azure Trusted Signing. Linux stays unsigned.                                                                                                                        |
| Guards        | Capture code must not import Vue or Pinia. Source files under `electron/`, `src/`, and `scripts/` stay at or under 400 lines (`.ts`, `.vue`, `.mjs`, `.js`).                                                                                    |

## Architecture options

ffmpeg has no ScreenCaptureKit demuxer. A Mac ffmpeg binary cannot capture system audio unless the user installs a virtual device. That is why options 4 and 5 do not finish the product.

|     | Approach                                                                                                                                                                                                                       | Fits the WAV contract                                                                                                | Main cost                                                                                                                                                                |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Signed Swift helper CLI. `MacosCapture` spawns it the way Linux and Windows spawn ffmpeg. ScreenCaptureKit writes system audio. AVFoundation or AudioQueue writes the mic. The helper mixes and writes `outPath`.              | Yes. One process, one file, stop flushes the WAV.                                                                    | Codesign and notarize the helper. TCC must stick to a stable identity.                                                                                                   |
| 2   | Node native addon (N-API + Swift/ObjC) inside the Electron process.                                                                                                                                                            | Yes, if the addon writes the WAV itself.                                                                             | Electron ABI rebuilds on every Electron bump. A capture crash takes down the app. Harder to test without booting Electron.                                               |
| 3   | `desktopCapturer` / `getDisplayMedia` loopback. On Electron 35 that is Chromium's `MacLoopbackAudioForScreenShare` and `MacSckSystemAudioLoopbackOverride` flags. Electron 39+ uses Core Audio taps by default on macOS 14.2+. | No. The API yields a WebRTC `MediaStream`. Something still has to encode PCM WAV and keep the mic on the same clock. | Couples Mac capture to Electron majors. Permission failures can be silent (an `ended` audio track, no JS error). Timeline sync with a separate mic stream is extra work. |
| 4   | BlackHole or another virtual driver, then ffmpeg `avfoundation`.                                                                                                                                                               | Only after the user installs and configures a driver.                                                                | Rejected as the end state. Optional power-user note in docs only, never a required install step.                                                                         |
| 5   | ffmpeg `avfoundation` mic-only.                                                                                                                                                                                                | Mic-only.                                                                                                            | Not "Mac capture done." Useful only as an internal spike behind a dev flag.                                                                                              |

### Recommendation

Use option 1.

It matches the process model we already run: main spawns a tool, the tool writes the WAV, `q` on stdin stops it, the app stays up if the tool dies. The Swift program can stay small (stream, mix, WAV header) and does not import Electron. `MacosCapture` stays a thin spawn wrapper under the 400-line guard.

Option 2 is the fallback if Phase 2 shows that a child process cannot hold Screen Recording permission for this app bundle. Do not start there.

Option 3 stays a separate decision: revisit only if we bump Electron for other reasons. This epic stays on Electron 35.

### ScreenCaptureKit facts this recommendation uses

Sources: [ScreenCaptureKit](https://developer.apple.com/documentation/screencapturekit), [`capturesAudio`](https://developer.apple.com/documentation/screencapturekit/scstreamconfiguration/capturesaudio), WWDC22 session 10156, and the macOS 15 microphone output.

- macOS 13+: `SCStreamConfiguration.capturesAudio`, `sampleRate`, `channelCount`, `excludesCurrentProcessAudio`. Set 48000 Hz and 2 channels. Exclude this process so MeetRec's own sounds do not land in the take.
- Apple does not document an audio-only stream. The practical pattern is an `SCContentFilter` for the main display, `capturesAudio = true`, and an `SCStreamOutput` of type `.audio`. If start fails without a video output, add a screen output, keep the frame size and rate small, and discard those buffers. Never write video into the recording folder.
- macOS 15+: `captureMicrophone` and `SCStreamOutputType.microphone` can take the mic inside the same stream (WWDC24). The first ship uses AVFoundation or AudioQueue on macOS 13+ so the floor stays 13. A later cleanup can switch the mic to ScreenCaptureKit on 15+ if that removes a clock.
- TCC for this path is Screen Recording (System Settings → Privacy & Security → Screen & System Audio Recording). Apple's overview asks for `NSScreenCaptureUsageDescription` in Info.plist. There is no public third-party entitlement that grants screen capture. The user toggles the app on.
- The microphone is a second prompt (`NSMicrophoneUsageDescription`) when the mic path is AVFoundation.
- Core Audio process taps (macOS 14.2+) are a different API. They need `NSAudioCaptureUsageDescription` and the "System Audio Recording" permission. Electron 39+ `desktopCapturer` uses taps by default and does not fall back to ScreenCaptureKit. That is option 3, not this plan. See the [Electron desktopCapturer docs](https://www.electronjs.org/docs/latest/api/desktop-capturer).

### ffmpeg on a Mac

BtbN auto-builds are win64, winarm64, linux64, and linuxarm64 only ([FFmpeg-Builds README](https://github.com/BtbN/FFmpeg-Builds/blob/master/README.md)). There is no darwin archive to pin next to the current n9.0.2 linux/win pin.

Phase 1 does not add a fake BtbN mac URL. `npm run dev` on a Mac uses `ffmpeg` on `PATH` (Homebrew is fine) for an internal mic-only spike. The packaged mix does not shell out to ffmpeg. Add a shipped Mac ffmpeg later only if a real step needs it (transcode, probe), and decide the license then. Several public macOS static builds are GPL. Do not drop a GPL binary beside the LGPL linux/win pin without that decision.

## Disagreements and watch-outs

1. **No BtbN darwin pin.** A "darwin ffmpeg pin" in the same script would invent an artifact BtbN does not publish. Dev mic spikes use PATH ffmpeg. The helper writes the WAV.
2. **Ad-hoc signatures do not satisfy Screen Recording smoke.** TCC binds Screen Recording to the code-signing identity. Ad-hoc (`codesign -`) changes every rebuild, so the grant does not stick. On current macOS, ad-hoc apps often cannot complete a ScreenCaptureKit start at all. Unsigned or ad-hoc DMGs are fine for "the app opens" packaging smoke. Phase 2 exit needs a stable Apple Development or Developer ID signature. Apple DTS has described this identity rule in the developer forums (thread 819406).
3. **The helper's designated requirement is the permission target.** System Settings may show the helper rather than the Electron host if the helper is a loose binary. Embed it at `MeetRec.app/Contents/MacOS/meetrec-capture`, same Team ID, hardened runtime, and confirm the toggle name on macOS 14 and 15 before writing UI copy. Switch to option 2 only if that embedding still cannot hold the grant.
4. **Do not test ScreenCaptureKit from a terminal-launched `npm run dev` and treat a failure as an API failure.** For Core Audio taps, Electron's docs say macOS attributes the permission to the responsible parent (terminal or IDE) when the app is unpackaged. Exercise the signed `.app` via Finder or `open`.
5. **Electron 39 is not a shortcut.** It still produces a `MediaStream`, it raises the OS floor for the default path to 14.2, and a missing tap permission yields an ended track with no error. Stay on Electron 35 for this epic.
6. **Fail closed when Screen Recording is off.** Linux may record mic-only when no monitor source exists, and it shows a note. On Mac, a missing Screen Recording grant is a user choice. Do not start a surprise mic-only take. Keep Start disabled, or throw before any file is the copy of record, and say which toggle is missing.

No disagreement with the helper recommendation, the macOS 13 floor, direct DMG/zip, arm64 first, or running this beside Linux work.

## Phases

Each phase lands on its own. Later phases do not start by flipping `captureSupported` early.

### Phase 0 — Honest UX (done)

PR #23. Darwin Start / Auto-arm stay disabled. The message names Linux and Windows and says ScreenCaptureKit is not shipped.

Exit: `support.test.ts` and `session.test.ts` still expect `captureSupported === false` and the macOS message. No Mac installer. This document does not change that code.

### Phase 1 — Packaging scaffold, capture still off

- Add a `mac` block to `electron-builder.yml` (arm64 DMG + zip, `minimumSystemVersion` 13.0, hardened runtime, `build/icon.png` as the icon source). `npm run dist` on Linux still builds the AppImage. `npm run dist` on Windows still builds NSIS and portable.
- Add `dist:mac` that runs `npm run build` and `electron-builder --mac --publish never`. It does not run `fetch:ffmpeg`.
- CI: a `macos-latest` job on the ad-hoc package workflow (`workflow_dispatch`) with `CSC_IDENTITY_AUTO_DISCOVERY=false`. Artifact is an unsigned or ad-hoc app. It is not a GitHub Release and not a merge gate.
- Make the darwin `fetch:ffmpeg` error name the missing BtbN target in one sentence. Do not download a mac ffmpeg.
- Optional internal spike: ffmpeg `avfoundation` mic-only behind an explicit dev flag, default off, packaged builds ignore it, `captureSupported` stays false. Any user-visible "experimental mic-only" string waits for Spencer's approval. Preferred default: keep Start disabled until Phase 3.

Exit: a Mac GitHub Actions job produces a `.app` or DMG that opens to the existing disabled Record screen. The message is still the Phase 0 copy. Unit tests on ubuntu still pass. No claim that recording works on Mac.

### Phase 2 — System audio WAV

- New Swift package at `native/mac-capture/` (outside the TS file-size roots). One small executable, `meetrec-capture`.
- Display content filter, `capturesAudio`, 48000 Hz, stereo, `excludesCurrentProcessAudio`. Audio-output-only first; discarded video frames only if the stream will not start without them.
- Writes a valid `pcm_s16le` stereo WAV to `--out`. `q` on stdin (and SIGTERM) flushes the header and exits. Wall-clock duration stays in `MacosCapture` via the existing helper.
- Embed the binary in `Contents/MacOS`. Sign it with the same identity as the app for the smoke build (Apple Development locally, or Developer ID if the cert already exists).
- UI stays disabled in default builds. A dev flag may run the helper so an engineer can confirm the file plays system audio.

Exit: on an Apple Silicon Mac, a signed build records system audio (browser or Music playback) to a playable WAV with no mic. Screen Recording is granted to the identity System Settings actually lists. The file has no video sibling. Default UI is still disabled.

### Phase 3 — Mic + system mix, permission UX, support flag

- Mic capture in the helper (AVFoundation or AudioQueue), converted to 48000 Hz stereo `s16` and mixed onto the system track on one timeline. Pad silence if one source starts late so the WAV length matches wall-clock `durationMs`.
- `captureMode` is `mix` when both tracks are live. A dead system stream after a granted permission is an error with a note, not a quiet mic-only file.
- `captureSupported` becomes true on darwin only when the helper is present and Screen Recording and Microphone are both authorized. Otherwise it stays false and `unsupportedReason` names the missing piece and the Settings path.
- Info.plist via electron-builder `extendInfo`: `NSScreenCaptureUsageDescription` and `NSMicrophoneUsageDescription`. Purpose strings say MeetRec records the meeting the user is already in (system audio and microphone). They do not mention screen pixels, because we discard video.
- Update [audio-capture.md](audio-capture.md) and the manual gate in [quality-gates.md](quality-gates.md) in the same change that flips the flag. Linux and Windows rows stay as they are.
- Tests: extend `support.ts` cases for the four darwin states (no helper, missing screen, missing mic, ready). No ScreenCaptureKit call in CI.

Exit: Spencer (or another person on Apple Silicon) records a call, speaks, plays remote audio, stops, and plays `audio.mp3` with both. Record and calendar Start follow `captureSupported`. A fresh install with permissions denied cannot start, and the reason is visible without reading the console.

### Phase 4 — Notarized release

- Tag workflow gains `macos-latest`. It builds arm64 DMG and zip, signs with Developer ID, notarizes, staples, and attaches the artifacts to the GitHub Release. Prerelease tags behave like the existing Linux/Windows jobs.
- Secrets listed under CI and signing below. The ad-hoc package workflow stays unsigned.
- Smoke the stapled DMG on a machine that has never built the app: download, open, grant both permissions, record once. Gatekeeper must not block the app after notarization.

Exit: a `v*` tag publishes a notarized arm64 DMG and zip next to the AppImage and the Windows exes. `spctl` / Gatekeeper assessment accepts the app. Linux and Windows release jobs are unchanged.

## Permission UX

Two system prompts, in this order, on first recording attempt once Phase 3 enables Start:

1. **Screen & System Audio Recording** — triggered by the helper's first `SCShareableContent` / stream start. Copy in our UI, before the prompt: "MeetRec needs Screen & System Audio Recording to capture the meeting audio. macOS may ask you to quit and reopen the app after you allow it."
2. **Microphone** — standard AVFoundation prompt. Copy: "MeetRec needs the microphone so your voice is in the same recording."

When a grant is missing, Start stays disabled. `unsupportedReason` names the pane:

- Screen Recording off: `System Settings → Privacy & Security → Screen & System Audio Recording → enable meetrec, then reopen the app.`
- Microphone off: `System Settings → Privacy & Security → Microphone → enable meetrec.`

Deep links (`x-apple.systempreferences:…`) have broken across macOS releases. The string is the contract. A button that runs `open` can come later if the string is not enough.

The user may have to relaunch after Screen Recording flips. Say that in the reason. Do not loop the prompt.

Dev and CI builds launched from a terminal are the wrong place to judge this UX. Use the signed `.app`.

## Helper shape

Sketch for the implementation PR. Not code in this change.

| Piece  | Choice                                                                                                                                                       |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Path   | `native/mac-capture/` Swift package. Executable name `meetrec-capture`.                                                                                      |
| Spawn  | `MacosCapture` only. No Vue, Pinia, or renderer import.                                                                                                      |
| Args   | `--out <path> --sample-rate 48000`. Sample rate defaults to 48000 when `start` omits it.                                                                     |
| Stop   | Write `q\n` to stdin, as ffmpeg backends do. SIGTERM flushes too.                                                                                            |
| Stdout | One JSON line after the stream is up (`captureMode`, `note`), one line on exit if the mode changed. Parse failure is a thrown error, not a silent empty WAV. |
| Mix    | Helper-internal. Main does not see raw sample buffers.                                                                                                       |
| Logs   | stderr only. No screen frames on disk.                                                                                                                       |

Keep the Swift files split (stream, mic, mix, wav, main) the same way TS files stay small, even though `.swift` is outside the line guard.

## CI and signing

Phase 1 job (no Apple secrets):

- Runner: `macos-latest` (Apple Silicon hosted runner).
- Steps: `npm ci`, `npm run build`, `npx electron-builder --mac --publish never` with `CSC_IDENTITY_AUTO_DISCOVERY=false`.
- Upload the DMG/zip as a workflow artifact. Do not attach a GitHub Release.
- ubuntu CI stays the merge gate (typecheck, lint, format, file-size, unit tests).

Phase 4 job (tag `v*` only), same runner, secrets from GitHub Actions:

| Secret             | Role                                                                                                                        |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| `CSC_LINK`         | Developer ID Application `.p12` (path or base64, electron-builder's existing variable).                                     |
| `CSC_KEY_PASSWORD` | Password for that certificate.                                                                                              |
| `APPLE_API_KEY`    | App Store Connect API key (`.p8` contents). The workflow writes it to a temp file and points electron-builder at that path. |
| `APPLE_API_KEY_ID` | Key id.                                                                                                                     |
| `APPLE_API_ISSUER` | Issuer UUID.                                                                                                                |

Preferred notarization is the API key. The fallback triplet is `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, and `APPLE_TEAM_ID`. Do not commit any of these.

electron-builder settings to plan on: `hardenedRuntime: true`, `gatekeeperAssess: false` during the build (assess after notarize), inherit entitlements for the helper. Entitlements are the usual Electron hardened-runtime set (`allow-jit`, `allow-unsigned-executable-memory`). App sandbox stays off. Do not add a screen-capture entitlement.

Local SCK smoke uses an Apple Development cert so the Team ID is stable across rebuilds. Release uses Developer ID Application plus notarization.

## Dependencies

- Apple Developer Program membership for the team that owns `io.techglint.meetrec` (assumed TechGlint; unconfirmed).
- A Developer ID Application certificate that someone can export to `CSC_LINK`.
- An App Store Connect API key with notarization access, or an Apple ID with an app-specific password.
- One Apple Silicon Mac for Phase 2–3 smoke. Intel hardware only if we later reject the arm64-only release.
- Xcode or the Command Line Tools on the engineer's Mac and on `macos-latest`.
- No new npm native module.

## Effort

One engineer who already knows this repo. Confidence is medium: TCC, signing identity, and notarization dominate the spread. A missing Apple account blocks Phase 4 completely and makes Phase 2 slow.

| Phase | Engineer-weeks | Confidence                               | Notes                                                                        |
| ----- | -------------- | ---------------------------------------- | ---------------------------------------------------------------------------- |
| 0     | 0              | Done                                     | PR #23.                                                                      |
| 1     | 0.5–1          | Higher                                   | YAML, CI, icon reuse. No SCK.                                                |
| 2     | 1–1.5          | Medium                                   | First signed SCK stream and the audio-only quirk.                            |
| 3     | 1–1.5          | Medium                                   | Mic clock, permission copy, flag flip.                                       |
| 4     | 1–1.5          | Medium until the cert works, then higher | First notarized Electron app for this team.                                  |
| Total | 4–6            | Medium                                   | Add about 1–2 weeks if the helper identity fight or the Apple account slips. |

## Sequencing

As of 2026-09-24 the GitHub repo has no open issues. Library delete and other Linux daily-driver fixes are still the P0/P1 work Spencer has called out, whether or not they have tickets.

Mac work does not pause that Linux work. Phase 0 is already merged. Phase 1 (docs and packaging scaffold) can land in parallel on CI and does not need a Mac on the desk. Phase 2–4 need Mac hardware and the Apple account; they run as a side track and do not take the only engineering time away from Linux capture, library, or calendar bugs.

Start Phase 2 when both a Mac and a stable signing identity exist. Until then, leave the Record button disabled.

## Open questions for Spencer

1. Is the Apple Developer team TechGlint, and who can export the Developer ID Application cert and create the API key?
2. Confirm the OS floor: macOS 13+ with the mic via AVFoundation. macOS 15 ScreenCaptureKit mic and macOS 14.2 Core Audio taps stay out of the first ship.
3. Confirm direct DMG and zip. The Mac App Store stays out.
4. Confirm this epic does not pause Library delete or other Linux P0/P1 work.
5. Confirm we stay on Electron 35 and treat an Electron 39 bump as its own change.
6. Unsigned ad-hoc Mac artifacts are enough for Phase 1 packaging smoke. Phase 2 needs a development-signed or Developer ID build. Is a development cert available before the release cert?
7. Confirm the first release is arm64 only. Universal / Intel is a follow-up and needs a build strategy, because hosted GitHub macOS runners are Apple Silicon.
8. Who runs the Apple Silicon smoke for Phase 2 and Phase 3?

## What this document does not change

- `electron/capture/macos.ts`, `support.ts`, and the disabled Record UI.
- The platform-order lock.
- `electron-builder.yml`, fetch-ffmpeg, and the release workflows.
- Any claim that Mac recording works.
