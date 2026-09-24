import { describe, expect, it } from 'vitest'
import { assertCaptureSupported, captureSupport } from './support'

describe('captureSupport', () => {
  it('allows Linux and Windows', () => {
    expect(captureSupport('linux')).toEqual({
      platform: 'linux',
      supported: true,
      message: null
    })
    expect(captureSupport('win32')).toEqual({
      platform: 'win32',
      supported: true,
      message: null
    })
  })

  it('rejects macOS with a clear message', () => {
    const support = captureSupport('darwin')
    expect(support.supported).toBe(false)
    expect(support.message).toMatch(/macOS capture is not available/i)
    expect(support.message).toMatch(/ScreenCaptureKit/i)
  })

  it('rejects unknown platforms', () => {
    const support = captureSupport('freebsd' as NodeJS.Platform)
    expect(support.supported).toBe(false)
    expect(support.message).toMatch(/Unsupported platform/i)
  })

  it('assertCaptureSupported throws only when unsupported', () => {
    expect(() => assertCaptureSupported('linux')).not.toThrow()
    expect(() => assertCaptureSupported('darwin')).toThrow(/macOS capture is not available/i)
  })
})
