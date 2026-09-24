import { describe, expect, it } from 'vitest'
import { idleStatus, statusFromSession, withCaptureSupport } from './session'

describe('recording session status', () => {
  it('is idle when no session is active', () => {
    expect(idleStatus()).toEqual({
      phase: 'idle',
      outPath: null,
      startedAt: null,
      captureMode: null,
      note: null,
      captureSupported: true,
      unsupportedReason: null
    })
    expect(statusFromSession(null).phase).toBe('idle')
  })

  it('reports recording while a session is active', () => {
    const status = statusFromSession({
      id: '2026-09-22T12-00-00-000Z-abc123',
      outPath: '/tmp/meetrec/a.wav',
      startedAtMs: Date.parse('2026-09-22T12:00:00.000Z'),
      captureMode: 'mix',
      note: null
    })
    expect(status.phase).toBe('recording')
    expect(status.outPath).toBe('/tmp/meetrec/a.wav')
    expect(status.startedAt).toBe('2026-09-22T12:00:00.000Z')
    expect(status.captureMode).toBe('mix')
    expect(status.captureSupported).toBe(true)
  })

  it('overlays macOS unsupported reason', () => {
    const status = withCaptureSupport(idleStatus(), {
      supported: false,
      message: 'macOS capture is not available in this build.'
    })
    expect(status.captureSupported).toBe(false)
    expect(status.unsupportedReason).toMatch(/macOS capture is not available/)
  })
})
