import { describe, expect, it } from 'vitest'
import { effectiveDestination, parseDestination } from './destination'

describe('recording destination', () => {
  it('keeps local when that provider upload is not available', () => {
    expect(effectiveDestination('local', { google: true, microsoft: true })).toBe('local')
    expect(effectiveDestination('google', { google: false, microsoft: true })).toBe('local')
    expect(effectiveDestination('microsoft', { google: true, microsoft: false })).toBe('local')
  })

  it('uses Drive or OneDrive only when that upload is available', () => {
    expect(effectiveDestination('google', { google: true, microsoft: true })).toBe('google')
    expect(effectiveDestination('microsoft', { google: false, microsoft: true })).toBe('microsoft')
  })

  it('treats an unknown stored value as local', () => {
    expect(parseDestination('dropbox')).toBe('local')
    expect(parseDestination('google')).toBe('google')
  })
})
