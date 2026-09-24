import { describe, expect, it } from 'vitest'
import {
  applyInviteePick,
  selectedInviteeKey,
  uniqueInviteeOptions,
  type InviteeOption
} from './invitee-options'

describe('uniqueInviteeOptions', () => {
  it('returns nothing for an empty list or blank names', () => {
    expect(uniqueInviteeOptions([])).toEqual([])
    expect(
      uniqueInviteeOptions([
        { name: '  ', email: 'ada@example.com' },
        { name: '', email: null }
      ])
    ).toEqual([])
  })

  it('keeps a single label for a unique name and hides the email', () => {
    expect(
      uniqueInviteeOptions([
        { name: ' Ada ', email: ' ada@example.com ' },
        { name: 'Ada', email: 'ada@example.com' },
        { name: 'Grace', email: null }
      ])
    ).toEqual([
      {
        key: 'Ada|ada%40example.com',
        name: 'Ada',
        email: 'ada@example.com',
        label: 'Ada'
      },
      {
        key: 'Grace|',
        name: 'Grace',
        email: null,
        label: 'Grace'
      }
    ])
  })

  it('adds the email when two invitees share a name', () => {
    const options = uniqueInviteeOptions([
      { name: 'Ada', email: 'ada@example.com' },
      { name: 'Ada', email: 'ada@other.test' },
      { name: 'Ada', email: null }
    ])
    expect(options.map((option) => option.label)).toEqual([
      'Ada (ada@example.com)',
      'Ada (ada@other.test)',
      'Ada'
    ])
    expect(new Set(options.map((option) => option.key)).size).toBe(3)
  })
})

describe('applyInviteePick', () => {
  const ada: InviteeOption = {
    key: 'Ada|ada%40example.com',
    name: 'Ada',
    email: 'ada@example.com',
    label: 'Ada'
  }

  it('fills that speaker draft with the invitee name', () => {
    expect(applyInviteePick({ s1: 'Speaker 1', s2: '' }, 's1', ada)).toEqual({
      s1: 'Ada',
      s2: ''
    })
  })

  it('leaves drafts unchanged when the option is missing', () => {
    const drafts = { s1: 'Kept' }
    expect(applyInviteePick(drafts, 's1', undefined)).toBe(drafts)
  })
})

describe('selectedInviteeKey', () => {
  const options: InviteeOption[] = [
    { key: 'Ada|a', name: 'Ada', email: 'a@example.com', label: 'Ada (a@example.com)' },
    { key: 'Ada|b', name: 'Ada', email: 'b@example.com', label: 'Ada (b@example.com)' }
  ]

  it('keeps the picked invitee when names match', () => {
    expect(selectedInviteeKey(options, 'Ada', 'Ada|b')).toBe('Ada|b')
  })

  it('falls back to the first name match after the draft is edited back', () => {
    expect(selectedInviteeKey(options, 'Ada', 'missing')).toBe('Ada|a')
  })

  it('clears the selection when the typed name matches nobody', () => {
    expect(selectedInviteeKey(options, 'Ada Lovelace', 'Ada|b')).toBe('')
  })
})
