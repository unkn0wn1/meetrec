export interface PulseSource {
  name: string
  description: string
}

export interface PulseDevices {
  defaultSource: string | null
  defaultSink: string | null
  sources: PulseSource[]
}

const DEFAULT_SOURCE = /^\*\s+(\S+)/
const DEFAULT_SINK_LINE = /^Default Sink:\s+(\S+)/
const SOURCE_LINE = /^\s*(\S+)\s+\[(.+)\]/

/**
 * Parse `ffmpeg -sources pulse` plus `pactl get-default-sink` text.
 * ffmpeg marks the Pulse default source with a leading asterisk.
 */
export function parseFfmpegPulseSources(text: string): {
  defaultSource: string | null
  sources: PulseSource[]
} {
  const sources: PulseSource[] = []
  let defaultSource: string | null = null
  let inPulse = false

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trimEnd()
    if (line.includes('Auto-detected sources for pulse')) {
      inPulse = true
      continue
    }
    if (!inPulse) continue
    if (line.startsWith('Auto-detected sources for ')) break
    if (!line.trim()) continue

    const marked = line.match(DEFAULT_SOURCE)
    const plain = line.trim().match(SOURCE_LINE)
    const match = marked ?? plain
    if (!match) continue

    const name = match[1]
    const description = match[2]?.replace(/\s+\([^)]*\)\s*$/, '') ?? name
    sources.push({ name, description })
    if (line.trimStart().startsWith('*')) {
      defaultSource = name
    }
  }

  return { defaultSource, sources }
}

export function parseDefaultSink(pactlInfo: string): string | null {
  for (const line of pactlInfo.split(/\r?\n/)) {
    const match = line.match(DEFAULT_SINK_LINE)
    if (match) return match[1]
  }
  const trimmed = pactlInfo.trim()
  if (trimmed && !trimmed.includes('\n') && !trimmed.includes(' ')) return trimmed
  return null
}

export function monitorNameForSink(sink: string): string {
  return `${sink}.monitor`
}

export function findSource(devices: PulseDevices, name: string | null): PulseSource | null {
  if (!name) return null
  return devices.sources.find((source) => source.name === name) ?? null
}

export function resolveMixInputs(devices: PulseDevices): {
  mic: string | null
  monitor: string | null
} {
  const mic = devices.defaultSource
  const sink = devices.defaultSink
  if (!sink) return { mic, monitor: null }
  const monitor = monitorNameForSink(sink)
  const known = devices.sources.some((source) => source.name === monitor)
  return { mic, monitor: known ? monitor : monitor }
}
