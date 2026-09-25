import { describe, expect, it } from 'vitest'
import { seekMsFromQuery } from './search-open'

describe('seekMsFromQuery', () => {
  it('reads a millisecond offset', () => {
    expect(seekMsFromQuery('62500')).toBe(62500)
  })

  it('ignores a missing, blank, or non-numeric query', () => {
    expect(seekMsFromQuery(undefined)).toBeNull()
    expect(seekMsFromQuery('')).toBeNull()
    expect(seekMsFromQuery('   ')).toBeNull()
    expect(seekMsFromQuery('soon')).toBeNull()
    expect(seekMsFromQuery('NaN')).toBeNull()
  })
})
