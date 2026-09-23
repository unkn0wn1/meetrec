export interface ActionItem {
  text: string
  owner: string | null
}

export interface MinutesDraft {
  overview: string
  topic: string
  decisions: string[]
  actions: ActionItem[]
}

const HEADINGS = ['## Overview', '## Topic', '## Decisions', '## Action items'] as const

export function minutesToMarkdown(draft: MinutesDraft): string {
  const decisions =
    draft.decisions.length === 0
      ? '- None recorded.'
      : draft.decisions.map((item) => `- ${item}`).join('\n')
  const actions =
    draft.actions.length === 0
      ? '- None recorded.'
      : draft.actions
          .map((item) => (item.owner ? `- ${item.text} (${item.owner})` : `- ${item.text}`))
          .join('\n')
  return [
    HEADINGS[0],
    '',
    draft.overview.trim() || 'No overview.',
    '',
    HEADINGS[1],
    '',
    draft.topic.trim() || 'Untitled meeting',
    '',
    HEADINGS[2],
    '',
    decisions,
    '',
    HEADINGS[3],
    '',
    actions,
    ''
  ].join('\n')
}

export function topicFromMarkdown(markdown: string): string | null {
  const match = /## Topic\s*\n+([^\n#].*)/.exec(markdown)
  const topic = match?.[1]?.trim()
  if (!topic || topic === 'Untitled meeting') return topic || null
  return topic
}

export function parseMinutesJson(raw: string): MinutesDraft | null {
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start < 0 || end <= start) return null
  let value: unknown
  try {
    value = JSON.parse(raw.slice(start, end + 1))
  } catch {
    return null
  }
  if (!value || typeof value !== 'object') return null
  const record = value as Record<string, unknown>
  const overview = typeof record.overview === 'string' ? record.overview.trim() : ''
  const topic = typeof record.topic === 'string' ? record.topic.trim() : ''
  if (!overview && !topic) return null
  const decisions = Array.isArray(record.decisions)
    ? record.decisions.filter(
        (item): item is string => typeof item === 'string' && item.trim().length > 0
      )
    : []
  const actions = Array.isArray(record.actions) ? record.actions.flatMap(parseAction) : []
  return {
    overview: overview || 'No overview.',
    topic: topic || 'Untitled meeting',
    decisions,
    actions
  }
}

function parseAction(value: unknown): ActionItem[] {
  if (typeof value === 'string' && value.trim()) return [{ text: value.trim(), owner: null }]
  if (!value || typeof value !== 'object') return []
  const record = value as Record<string, unknown>
  const text = typeof record.text === 'string' ? record.text.trim() : ''
  if (!text) return []
  const owner = typeof record.owner === 'string' && record.owner.trim() ? record.owner.trim() : null
  return [{ text, owner }]
}

export function minutesPrompt(transcriptText: string, speakerLines: string[]): string {
  const speakers = speakerLines.length ? speakerLines.join('\n') : 'Speakers were not labeled.'
  return [
    'You write meeting minutes from a transcript.',
    'Reply with JSON only. No markdown fences.',
    'Shape: {"overview": string, "topic": string, "decisions": string[], "actions": [{"text": string, "owner": string | null}]}',
    'overview is 2-4 sentences. topic is a short title. decisions and actions may be empty arrays.',
    'Use speaker names when they are present. Do not invent attendees who are not in the transcript.',
    '',
    'Speakers:',
    speakers,
    '',
    'Transcript:',
    transcriptText
  ].join('\n')
}
