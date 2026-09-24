import { describe, expect, it } from 'vitest'
import { promptWindowVisible } from './prompt-window'

describe('promptWindowVisible', () => {
  it('leaves the window alone when the prompt key does not change', () => {
    expect(
      promptWindowVisible({ promptKey: 'event-1', nextKey: 'event-1', revealMicOnly: false })
    ).toBeNull()
    expect(promptWindowVisible({ promptKey: null, nextKey: null, revealMicOnly: false })).toBeNull()
  })

  it('hides when a prompt is dismissed and capture is not mic-only', () => {
    expect(promptWindowVisible({ promptKey: 'event-1', nextKey: null, revealMicOnly: false })).toBe(
      false
    )
  })

  it('stays open for a mic-only calendar start after the event prompt is gone', () => {
    expect(promptWindowVisible({ promptKey: 'event-1', nextKey: null, revealMicOnly: true })).toBe(
      true
    )
  })

  it('opens for a mic-only auto-start that never had a prompt', () => {
    expect(promptWindowVisible({ promptKey: null, nextKey: null, revealMicOnly: true })).toBe(true)
  })

  it('shows when a new event prompt arrives', () => {
    expect(promptWindowVisible({ promptKey: null, nextKey: 'event-2', revealMicOnly: false })).toBe(
      true
    )
  })
})
