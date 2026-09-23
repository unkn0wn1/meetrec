import { describe, expect, it } from 'vitest'
import { canUseXai, resolveXaiApiKey, xaiKeyStatus } from './key-status'

describe('xAI key resolution', () => {
  it('prefers a saved settings key over the environment', () => {
    expect(resolveXaiApiKey('  saved-key  ', 'env-key')).toBe('saved-key')
    expect(xaiKeyStatus('saved-key', 'env-key')).toEqual({
      hasXaiKey: true,
      xaiKeySource: 'settings'
    })
  })

  it('falls back to the environment when settings are empty', () => {
    expect(resolveXaiApiKey(null, ' env-key ')).toBe('env-key')
    expect(resolveXaiApiKey('   ', 'env-key')).toBe('env-key')
    expect(xaiKeyStatus('', 'env-key')).toEqual({
      hasXaiKey: true,
      xaiKeySource: 'env'
    })
  })

  it('reports none when both sources are missing', () => {
    expect(resolveXaiApiKey(null, undefined)).toBeNull()
    expect(resolveXaiApiKey('  ', '  ')).toBeNull()
    expect(xaiKeyStatus(null, '')).toEqual({
      hasXaiKey: false,
      xaiKeySource: 'none'
    })
  })

  it('enables provider actions only when a key exists and validation succeeded', () => {
    const ready = { hasXaiKey: true, xaiKeySource: 'settings' as const }
    const missing = { hasXaiKey: false, xaiKeySource: 'none' as const }
    expect(canUseXai(ready, true)).toBe(true)
    expect(canUseXai(ready, false)).toBe(false)
    expect(canUseXai(missing, true)).toBe(false)
  })
})
