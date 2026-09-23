import { describe, expect, it } from 'vitest'
import { minutesToMarkdown, parseMinutesJson, topicFromMarkdown } from './markdown'

describe('minutes markdown', () => {
  it('renders overview, topic, decisions, and action items', () => {
    const markdown = minutesToMarkdown({
      overview: 'We agreed to ship the library.',
      topic: 'Library review',
      decisions: ['Keep files local.'],
      actions: [{ text: 'Write the README', owner: 'Spencer' }]
    })
    expect(markdown).toContain('## Overview')
    expect(markdown).toContain('## Action items')
    expect(markdown).toContain('- Write the README (Spencer)')
    expect(topicFromMarkdown(markdown)).toBe('Library review')
  })

  it('parses a JSON object wrapped in extra prose', () => {
    const draft = parseMinutesJson(
      'Here you go:\n{"overview":"Short.","topic":"Standup","decisions":[],"actions":[{"text":"Ship it","owner":null}]}'
    )
    expect(draft?.topic).toBe('Standup')
    expect(draft?.actions[0]?.text).toBe('Ship it')
  })

  it('rejects text that is not minutes JSON', () => {
    expect(parseMinutesJson('no json here')).toBeNull()
  })
})
