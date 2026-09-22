import { describe, expect, it } from 'vitest'
import {
  monitorNameForSink,
  parseDefaultSink,
  parseFfmpegPulseSources,
  resolveMixInputs
} from './pulse-devices'
import { planCapture } from './linux'

const FFMPEG_SAMPLE = `
Auto-detected sources for pulse:
  alsa_output.Speaker.monitor [Monitor of Speaker] (none)
* alsa_input.Mic [Built-in Mic] (none)
  bluez_output.JBL.monitor [Monitor of JBL] (none)
Auto-detected sources for avfoundation:
  ignored
`

describe('parseFfmpegPulseSources', () => {
  it('reads the starred default source and listed monitors', () => {
    const parsed = parseFfmpegPulseSources(FFMPEG_SAMPLE)
    expect(parsed.defaultSource).toBe('alsa_input.Mic')
    expect(parsed.sources.map((source) => source.name)).toEqual([
      'alsa_output.Speaker.monitor',
      'alsa_input.Mic',
      'bluez_output.JBL.monitor'
    ])
  })
})

describe('parseDefaultSink', () => {
  it('accepts pactl get-default-sink output', () => {
    expect(parseDefaultSink('bluez_output.JBL\n')).toBe('bluez_output.JBL')
  })

  it('accepts a pactl info line', () => {
    expect(parseDefaultSink('Default Sink: alsa_output.Speaker\n')).toBe('alsa_output.Speaker')
  })
})

describe('planCapture', () => {
  it('plans a mix when the default sink monitor exists', () => {
    const parsed = parseFfmpegPulseSources(FFMPEG_SAMPLE)
    const plan = planCapture({
      ...parsed,
      defaultSink: 'bluez_output.JBL'
    })
    expect(plan.mode).toBe('mix')
    expect(plan.monitor).toBe(monitorNameForSink('bluez_output.JBL'))
    expect(plan.note).toBeNull()
  })

  it('falls back to mic-only when no sink is reported', () => {
    const parsed = parseFfmpegPulseSources(FFMPEG_SAMPLE)
    const plan = planCapture({ ...parsed, defaultSink: null })
    expect(plan.mode).toBe('mic-only')
    expect(plan.monitor).toBeNull()
    expect(plan.note).toContain('TODO')
  })
})

describe('resolveMixInputs', () => {
  it('pairs the default mic with the sink monitor', () => {
    const inputs = resolveMixInputs({
      defaultSource: 'alsa_input.Mic',
      defaultSink: 'bluez_output.JBL',
      sources: [{ name: 'bluez_output.JBL.monitor', description: 'Monitor' }]
    })
    expect(inputs).toEqual({
      mic: 'alsa_input.Mic',
      monitor: 'bluez_output.JBL.monitor'
    })
  })
})
