import { describe, expect, it } from 'vitest'
import { ffmpegListsDemuxer, parseWasapiDevices, parseWasapiHelp } from './wasapi-devices'
import { ffmpegArgs, planWasapiCapture } from './windows'

const DEVICES_WITH_WASAPI = `
Devices:
 D. = Demuxing supported
 .E = Muxing supported
 --
 D  dshow           DirectShow capture
 D  wasapi          Windows Audio Session API
  E sdl,sdl2        SDL2 output device
`

const DEVICES_DSHOW_ONLY = `
Devices:
 D. = Demuxing supported
 .E = Muxing supported
 --
 D  dshow           DirectShow capture
  E sdl,sdl2        SDL2 output device
`

const WASAPI_LIST = `
[wasapi @ 000] Capture devices:
[wasapi @ 000]  "Webcam Mic" (capture)
[wasapi @ 000]  "Headset Mic" (capture) (default)
[wasapi @ 000] Render devices:
[wasapi @ 000]  "Headphones" (render)
[wasapi @ 000]  "Speakers (Realtek(R) Audio)" (render) (default)
`

const HELP_LOOPBACK = `
Demuxer wasapi [Windows Audio Session API]:
    -loopback          <boolean>    ED......... capture a render endpoint (default false)
`

const HELP_LOOPBACK_DEVICE = `
    -loopback_device   <string>     ED......... render device to loop back
`

const HELP_LOOPBACK_SYSTEM = `
Capture the system mix with loopback_system=true.
`

const HELP_NO_LOOPBACK = `
Demuxer wasapi [Windows Audio Session API]:
    -device            <string>     ED......... capture device name
`

describe('ffmpegListsDemuxer', () => {
  it('detects a wasapi demuxer and ignores the legend', () => {
    expect(ffmpegListsDemuxer(DEVICES_WITH_WASAPI, 'wasapi')).toBe(true)
    expect(ffmpegListsDemuxer(DEVICES_DSHOW_ONLY, 'wasapi')).toBe(false)
    expect(ffmpegListsDemuxer(DEVICES_DSHOW_ONLY, 'dshow')).toBe(true)
  })
})

describe('parseWasapiHelp', () => {
  it('prefers a boolean loopback option over the other names', () => {
    expect(parseWasapiHelp(`${HELP_LOOPBACK}\n${HELP_LOOPBACK_DEVICE}`)).toBe('loopback')
    expect(parseWasapiHelp(HELP_LOOPBACK_DEVICE)).toBe('loopback_device')
    expect(parseWasapiHelp(HELP_LOOPBACK_SYSTEM)).toBe('loopback_system')
    expect(parseWasapiHelp(HELP_NO_LOOPBACK)).toBeNull()
  })
})

describe('parseWasapiDevices', () => {
  it('splits capture and render and marks defaults', () => {
    const parsed = parseWasapiDevices(WASAPI_LIST)
    expect(parsed.captures.map((device) => device.name)).toEqual(['Webcam Mic', 'Headset Mic'])
    expect(parsed.captures.find((device) => device.isDefault)?.name).toBe('Headset Mic')
    expect(parsed.renders.find((device) => device.isDefault)?.name).toBe(
      'Speakers (Realtek(R) Audio)'
    )
  })

  it('throws when the list is not recognized', () => {
    expect(() => parseWasapiDevices('not a device list')).toThrow(
      /not recognized: not a device list/
    )
    expect(() => parseWasapiDevices('   ')).toThrow(/not recognized/)
  })
})

describe('planWasapiCapture', () => {
  const devices = () => parseWasapiDevices(WASAPI_LIST)

  it('mixes the default capture and render endpoints with -loopback 1', () => {
    const plan = planWasapiCapture({ ...devices(), loopbackForm: 'loopback' })
    expect(plan.mode).toBe('mix')
    expect(plan.mic).toBe('Headset Mic')
    expect(plan.system).toBe('Speakers (Realtek(R) Audio)')
    expect(plan.note).toBeNull()

    const args = ffmpegArgs(plan, 'audio.wav', 48000)
    expect(args.filter((_, index) => args[index - 1] === '-f')).toEqual(['wasapi', 'wasapi'])
    const loopbackAt = args.indexOf('-loopback')
    expect(args[loopbackAt + 1]).toBe('1')
    expect(args.indexOf('Headset Mic')).toBeLessThan(loopbackAt)
    expect(args.indexOf('Speakers (Realtek(R) Audio)')).toBeGreaterThan(loopbackAt)
    expect(args.some((arg) => arg.includes('amix=inputs=2'))).toBe(true)
    expect(args).toContain('pcm_s16le')
  })

  it('uses loopback_device= or loopback_system=true when that is the help form', () => {
    const byDevice = planWasapiCapture({ ...devices(), loopbackForm: 'loopback_device' })
    expect(ffmpegArgs(byDevice, 'audio.wav', 48000)).toContain(
      'loopback_device=Speakers (Realtek(R) Audio)'
    )

    const bySystem = planWasapiCapture({ ...devices(), loopbackForm: 'loopback_system' })
    const args = ffmpegArgs(bySystem, 'audio.wav', 48000)
    expect(args).toContain('loopback_system=true')
    expect(args).not.toContain('-loopback')
  })

  it('falls back to mic-only when loopback or a render device is missing', () => {
    const noFlag = planWasapiCapture({ ...devices(), loopbackForm: null })
    expect(noFlag.mode).toBe('mic-only')
    expect(noFlag.system).toBeNull()
    expect(noFlag.note).toBe(
      'System audio is unavailable, so only the microphone is being recorded. This ffmpeg build has no WASAPI loopback option. Enable Stereo Mix under Sound → Recording, or use a build with WASAPI loopback.'
    )
    expect(noFlag.note).not.toContain('TODO')
    const noFlagArgs = ffmpegArgs(noFlag, 'audio.wav', 48000)
    expect(noFlagArgs.filter((_, index) => noFlagArgs[index - 1] === '-i')).toEqual(['Headset Mic'])
    expect(noFlagArgs.some((arg) => arg.includes('amix'))).toBe(false)
    expect(noFlagArgs).not.toContain('-loopback')

    const noRender = planWasapiCapture({
      captures: devices().captures,
      renders: [],
      loopbackForm: 'loopback'
    })
    expect(noRender.mode).toBe('mic-only')
    expect(noRender.system).toBeNull()
    expect(noRender.note).toBe(
      'System audio is unavailable, so only the microphone is being recorded. No playback device was listed. Connect a speaker or headphones, or enable Stereo Mix under Sound → Recording.'
    )
    expect(noRender.note).not.toContain('TODO')
    const noRenderArgs = ffmpegArgs(noRender, 'audio.wav', 48000)
    expect(noRenderArgs.filter((_, index) => noRenderArgs[index - 1] === '-i')).toEqual([
      'Headset Mic'
    ])
    expect(noRenderArgs.some((arg) => arg.includes('amix'))).toBe(false)
    expect(noRenderArgs).not.toContain('-filter_complex')
  })
})
