import { describe, expect, it } from 'vitest'
import { parseDshowAudioDevices } from './dshow-devices'
import { ffmpegArgs, planDshowCapture } from './windows'

const FFMPEG_DSHOW = `
[dshow @ 000] DirectShow video devices (some may be both video and audio devices)
[dshow @ 000]  "Integrated Camera"
[dshow @ 000]     Alternative name "@device_pnp_\\\\?\\usb#vid_camera"
[dshow @ 000] DirectShow audio devices
[dshow @ 000]  "Microphone (Realtek(R) Audio)" (audio)
[dshow @ 000]     Alternative name "@device_cm_{33D9A762-90C8-11D0-BD43-00A0C911CE86}\\wave_{mic}"
[dshow @ 000]  "What U Hear (Realtek(R) Audio)" (audio)
[dshow @ 000]     Alternative name "@device_cm_loop"
[dshow @ 000]  "Stereo Mix (Realtek(R) Audio)" (audio)
[dshow @ 000]     Alternative name "@device_cm_mix"
dummy: Immediate exit requested
`

const FFMPEG_DSHOW_PLAIN = `
[dshow @ 1] DirectShow video devices
[dshow @ 1]  "Integrated Camera"
[dshow @ 1] DirectShow audio devices
[dshow @ 1]  "Headset Microphone"
[dshow @ 1]  "What U Hear"
`

describe('parseDshowAudioDevices', () => {
  it('reads audio names and skips video plus alternative names', () => {
    expect(parseDshowAudioDevices(FFMPEG_DSHOW).map((device) => device.name)).toEqual([
      'Microphone (Realtek(R) Audio)',
      'What U Hear (Realtek(R) Audio)',
      'Stereo Mix (Realtek(R) Audio)'
    ])
  })

  it('accepts quoted names without an (audio) suffix', () => {
    expect(parseDshowAudioDevices(FFMPEG_DSHOW_PLAIN).map((device) => device.name)).toEqual([
      'Headset Microphone',
      'What U Hear'
    ])
  })
})

describe('planDshowCapture', () => {
  it('mixes the microphone with Stereo Mix ahead of other loopback names', () => {
    const plan = planDshowCapture(parseDshowAudioDevices(FFMPEG_DSHOW))
    expect(plan.mode).toBe('mix')
    expect(plan.backend).toBe('dshow')
    expect(plan.mic).toBe('Microphone (Realtek(R) Audio)')
    expect(plan.system).toBe('Stereo Mix (Realtek(R) Audio)')
    expect(plan.note).toBeNull()
  })

  it('treats What U Hear as loopback', () => {
    const plan = planDshowCapture(parseDshowAudioDevices(FFMPEG_DSHOW_PLAIN))
    expect(plan.mode).toBe('mix')
    expect(plan.mic).toBe('Headset Microphone')
    expect(plan.system).toBe('What U Hear')
  })

  it('falls back to mic-only when no loopback capture device is listed', () => {
    const plan = planDshowCapture([{ name: 'Microphone (Realtek(R) Audio)' }])
    expect(plan.mode).toBe('mic-only')
    expect(plan.system).toBeNull()
    expect(plan.note).toBe(
      'System audio is unavailable, so only the microphone is being recorded. Enable Stereo Mix under Sound → Recording (show disabled devices), or use a build with WASAPI loopback.'
    )
    expect(plan.note).not.toContain('TODO')
    const args = ffmpegArgs(plan, 'audio.wav', 48000)
    expect(args.filter((_, index) => args[index - 1] === '-i')).toEqual([
      'audio=Microphone (Realtek(R) Audio)'
    ])
    expect(args.some((arg) => arg.includes('amix'))).toBe(false)
    expect(args).not.toContain('-filter_complex')
  })

  it('throws when no microphone is listed', () => {
    expect(() => planDshowCapture([])).toThrow(/No microphone found/)
    expect(() => planDshowCapture([{ name: 'Stereo Mix (Realtek)' }])).toThrow(
      /No microphone found/
    )
  })
})

describe('ffmpegArgs dshow', () => {
  it('builds a stereo pcm mix without shell quotes', () => {
    const plan = planDshowCapture(parseDshowAudioDevices(FFMPEG_DSHOW))
    const args = ffmpegArgs(plan, 'C:\\rec\\audio.wav', 48000)
    expect(args.filter((_, index) => args[index - 1] === '-f')).toEqual(['dshow', 'dshow'])
    expect(args).toContain('audio=Microphone (Realtek(R) Audio)')
    expect(args).toContain('audio=Stereo Mix (Realtek(R) Audio)')
    expect(args.some((arg) => arg.includes('"'))).toBe(false)
    expect(args.some((arg) => arg.includes('amix=inputs=2'))).toBe(true)
    expect(args).toContain('pcm_s16le')
    expect(args.at(-1)).toBe('C:\\rec\\audio.wav')
  })

  it('records the microphone alone', () => {
    const plan = planDshowCapture([{ name: 'Microphone Array' }])
    const args = ffmpegArgs(plan, 'audio.wav', 48000)
    expect(args.filter((_, index) => args[index - 1] === '-i')).toEqual(['audio=Microphone Array'])
    expect(args).not.toContain('-loopback')
    expect(args).toContain('pcm_s16le')
  })
})
