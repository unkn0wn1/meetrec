import { describe, expect, it } from 'vitest'
import { parseLibraryDeleteOptions } from './delete-options'

describe('parseLibraryDeleteOptions', () => {
  it('treats a missing options object as local only', () => {
    expect(parseLibraryDeleteOptions(undefined)).toEqual({ removeCloud: false })
    expect(parseLibraryDeleteOptions(null)).toEqual({ removeCloud: false })
    expect(parseLibraryDeleteOptions({})).toEqual({ removeCloud: false })
    expect(parseLibraryDeleteOptions({ removeCloud: false })).toEqual({ removeCloud: false })
  })

  it('accepts only a strict true flag', () => {
    expect(parseLibraryDeleteOptions({ removeCloud: true })).toEqual({ removeCloud: true })
  })

  it('rejects coerced or non-object flags', () => {
    for (const value of ['true', 1, true, []]) {
      expect(() => parseLibraryDeleteOptions(value)).toThrow(
        'Choose whether to remove cloud copies.'
      )
    }
  })
})
