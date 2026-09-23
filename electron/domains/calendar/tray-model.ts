import { eventHint } from './hint'
import type { CalendarEvent } from './source'

export type TrayActionId =
  'show' | 'start' | 'arm' | 'armed' | 'dismiss' | 'cancel-arm' | 'stop' | 'quit'

export interface TrayItem {
  id: TrayActionId
  label: string
}

export interface TrayModel {
  tooltip: string
  items: TrayItem[]
}

export function trayNext(
  event: CalendarEvent | null
): { title: string; startsAt: string; hint: string | null } | null {
  if (!event) return null
  return { title: event.title, startsAt: event.startsAt, hint: eventHint(event) }
}

export function buildTrayModel(input: {
  recording: boolean
  prompt: { title: string } | null
  arm: { title: string } | null
  startAllowed: boolean
  next: { title: string; startsAt: string; hint?: string | null } | null
}): TrayModel {
  const items: TrayItem[] = [{ id: 'show', label: 'Show meetrec' }]
  if (input.prompt && input.startAllowed) {
    items.push({ id: 'start', label: `Start: ${input.prompt.title}` })
  }
  if (input.prompt) {
    items.push({ id: 'arm', label: 'Auto-arm (T−1 min)' })
    items.push({ id: 'dismiss', label: 'Dismiss' })
  }
  if (input.arm) {
    items.push({ id: 'armed', label: `Armed: ${input.arm.title}` })
    items.push({ id: 'cancel-arm', label: 'Cancel auto-arm' })
  }
  if (input.recording) items.push({ id: 'stop', label: 'Stop recording' })
  items.push({ id: 'quit', label: 'Quit' })
  return { tooltip: tooltipFor(input.next), items }
}

function tooltipFor(
  next: { title: string; startsAt: string; hint?: string | null } | null
): string {
  if (!next) return 'meetrec'
  const when = new Date(next.startsAt)
  const hint = next.hint ? ` · ${next.hint}` : ''
  if (Number.isNaN(when.getTime())) return `${next.title}${hint}`
  const label = when.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  })
  return `${next.title}${hint} · ${label}`
}
