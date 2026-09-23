export interface WasapiEndpoint {
  name: string
  isDefault: boolean
}

export interface WasapiDevices {
  captures: WasapiEndpoint[]
  renders: WasapiEndpoint[]
}

/** How this ffmpeg build asks for WASAPI loopback. Null when the demuxer has none. */
export type WasapiLoopbackForm = 'loopback' | 'loopback_device' | 'loopback_system' | null

const QUOTED_NAME = /"([^"]+)"/

/**
 * True when `ffmpeg -devices` lists `name` as a demuxer.
 * The legend line `D. = Demuxing supported` does not count.
 */
export function ffmpegListsDemuxer(text: string, name: string): boolean {
  for (const raw of text.split(/\r?\n/)) {
    const match = raw.match(/^\s*D[E ]\s+(\S+)/)
    if (!match) continue
    if (match[1].split(',').includes(name)) return true
  }
  return false
}

/** Prefer a boolean `-loopback` option, then `loopback_device`, then `loopback_system`. */
export function parseWasapiHelp(text: string): WasapiLoopbackForm {
  if (hasOption(text, 'loopback')) return 'loopback'
  if (hasOption(text, 'loopback_device') || text.includes('loopback_device=')) {
    return 'loopback_device'
  }
  if (hasOption(text, 'loopback_system') || text.includes('loopback_system=')) {
    return 'loopback_system'
  }
  return null
}

/**
 * Parse `ffmpeg -f wasapi -list_devices true -i dummy`.
 * Sections are "Capture devices" / "Render devices". A `(default)` mark wins over list order.
 */
export function parseWasapiDevices(text: string): WasapiDevices {
  const captures: WasapiEndpoint[] = []
  const renders: WasapiEndpoint[] = []
  let section: 'capture' | 'render' | null = null

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (/capture devices/i.test(line) && !QUOTED_NAME.test(line)) {
      section = 'capture'
      continue
    }
    if (/render devices/i.test(line) && !QUOTED_NAME.test(line)) {
      section = 'render'
      continue
    }

    const match = line.match(QUOTED_NAME)
    if (!match) continue
    const role = deviceRole(line, section)
    if (!role) continue

    const endpoint = { name: match[1], isDefault: /\(default\)/i.test(line) }
    if (role === 'capture') captures.push(endpoint)
    else renders.push(endpoint)
  }

  if (captures.length === 0 && renders.length === 0) {
    const excerpt = text.trim().replace(/\s+/g, ' ').slice(0, 180)
    throw new Error(
      excerpt
        ? `ffmpeg WASAPI device list was not recognized: ${excerpt}`
        : 'ffmpeg WASAPI device list was not recognized.'
    )
  }

  return { captures, renders }
}

export function pickWasapiEndpoint(devices: WasapiEndpoint[]): string | null {
  if (devices.length === 0) return null
  return (devices.find((device) => device.isDefault) ?? devices[0]).name
}

function deviceRole(
  line: string,
  section: 'capture' | 'render' | null
): 'capture' | 'render' | null {
  if (/\(render\)/i.test(line)) return 'render'
  if (/\(capture\)/i.test(line)) return 'capture'
  return section
}

function hasOption(text: string, name: string): boolean {
  return new RegExp(`(?:^|\\s)-${name}(?![\\w-])`, 'm').test(text)
}
