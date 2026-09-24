import { describe, expect, it } from 'vitest'
import {
  byteProgress,
  feedBlock,
  installDecision,
  updateInfoChannel,
  updateInfoFileName
} from './policy'

describe('update feed policy', () => {
  it('skips unpackaged builds and allows a packaged install', () => {
    expect(feedBlock({ packaged: false, portable: false })).toEqual({
      kind: 'skip',
      message: 'Updates apply to packaged installs.'
    })
    expect(feedBlock({ packaged: true, portable: false })).toEqual({ kind: 'ok' })
  })

  it('skips a portable build even when it is also packaged', () => {
    const block = feedBlock({ packaged: true, portable: true })
    expect(block).toEqual({
      kind: 'skip',
      message:
        'This portable build does not auto-update. Download the new exe from GitHub Releases.'
    })
    expect(feedBlock({ packaged: false, portable: true })).toEqual(block)
  })

  it('installs only when an update is ready and recording is idle', () => {
    expect(installDecision({ phase: 'ready', recording: true })).toBe('defer')
    expect(installDecision({ phase: 'ready', recording: false })).toBe('install')
    expect(installDecision({ phase: 'downloading', recording: false })).toBe('ignore')
  })

  it('keeps byte progress only when the total is a positive finite number', () => {
    expect(byteProgress(10, 0)).toBeNull()
    expect(byteProgress(Number.NaN, 5)).toBeNull()
    expect(byteProgress(4, Number.NaN)).toBeNull()
    expect(byteProgress(3, -2)).toBeNull()
    expect(byteProgress(1, 2)).toEqual({ transferred: 1, total: 2 })
  })

  it('names the channel file the way electron-builder does', () => {
    expect(updateInfoChannel('0.2.0')).toBe('latest')
    expect(updateInfoFileName('latest', 'win32')).toBe('latest.yml')
    expect(updateInfoFileName('latest', 'linux')).toBe('latest-linux.yml')
    expect(updateInfoFileName('latest', 'darwin')).toBe('latest-mac.yml')

    expect(updateInfoChannel('0.2.0-beta.1')).toBe('beta')
    expect(updateInfoFileName('beta', 'win32')).toBe('beta.yml')
    expect(updateInfoFileName('beta', 'linux')).toBe('beta-linux.yml')

    expect(updateInfoChannel('1.0.0-rc.1')).toBe('rc')
    expect(updateInfoFileName('rc', 'win32')).toBe('rc.yml')

    expect(updateInfoChannel('0.1.0-alpha.3')).toBe('alpha')
    expect(updateInfoFileName('alpha', 'linux')).toBe('alpha-linux.yml')

    expect(updateInfoChannel('0.2.0+build')).toBe('latest')
  })
})
