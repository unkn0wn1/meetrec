import { describe, expect, it } from 'vitest'
import { parseAppSettings } from './settings-file'

describe('app settings', () => {
  it('reads the active provider and ignores unknown ids', () => {
    expect(parseAppSettings('{"provider":"openai"}')).toEqual({ provider: 'openai' })
    expect(parseAppSettings('{"provider":"anthropic"}')).toEqual({ provider: 'xai-key' })
    expect(parseAppSettings('not-json')).toEqual({ provider: 'xai-key' })
  })
})
