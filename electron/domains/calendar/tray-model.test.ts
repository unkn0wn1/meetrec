import { describe, expect, it } from 'vitest'
import { buildTrayModel } from './tray-model'

const idle = {
  recording: false,
  prompt: null,
  arm: null,
  startAllowed: false,
  next: null
}

describe('tray model', () => {
  it('shows an idle menu', () => {
    const model = buildTrayModel(idle)
    expect(model.tooltip).toBe('meetrec')
    expect(model.items.map((item) => item.label)).toEqual(['Show meetrec', 'Quit'])
  })

  it('adds prompt actions', () => {
    const model = buildTrayModel({
      ...idle,
      prompt: { title: 'Standup' },
      startAllowed: true,
      next: { title: 'Standup', startsAt: '2026-09-23T15:00:00.000Z' }
    })
    expect(model.items.map((item) => item.label)).toEqual([
      'Show meetrec',
      'Start: Standup',
      'Auto-arm (T−1 min)',
      'Dismiss',
      'Quit'
    ])
    expect(model.tooltip).toContain('Standup')
  })

  it('adds armed actions', () => {
    const labels = buildTrayModel({ ...idle, arm: { title: 'Standup' } }).items.map(
      (item) => item.label
    )
    expect(labels).toContain('Armed: Standup')
    expect(labels).toContain('Cancel auto-arm')
  })

  it('adds a stop item while recording', () => {
    const labels = buildTrayModel({ ...idle, recording: true }).items.map((item) => item.label)
    expect(labels).toContain('Stop recording')
  })
})
