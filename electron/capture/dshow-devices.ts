export interface DshowAudioDevice {
  name: string
}

/** DirectShow names Windows uses for a "what you hear" capture endpoint. */
const LOOPBACK_NAME =
  /stereo mix|wave\s*out mix|what u hear|what you hear|mixed output|\bloopback\b/i

const MIC_NAME = /\b(microphone|mic|headset)\b/i
const QUOTED_NAME = /"([^"]+)"/

/**
 * Parse `ffmpeg -list_devices true -f dshow -i dummy`.
 * Video devices and alternative-name lines are ignored.
 */
export function parseDshowAudioDevices(text: string): DshowAudioDevice[] {
  const devices: DshowAudioDevice[] = []
  let inAudio = false

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (/directshow audio devices/i.test(line)) {
      inAudio = true
      continue
    }
    if (/directshow video devices/i.test(line)) {
      inAudio = false
      continue
    }
    if (!inAudio || /alternative name/i.test(line)) continue

    const match = line.match(QUOTED_NAME)
    if (!match) continue
    devices.push({ name: match[1] })
  }

  return devices
}

export function isLoopbackName(name: string): boolean {
  return LOOPBACK_NAME.test(name)
}

export function selectDshowInputs(devices: DshowAudioDevice[]): {
  mic: string | null
  loopback: string | null
} {
  const loopbacks = devices.filter((device) => isLoopbackName(device.name))
  const stereo = loopbacks.find((device) => /stereo mix/i.test(device.name))
  const loopback = stereo ?? loopbacks[0] ?? null
  const mics = devices.filter((device) => !isLoopbackName(device.name))
  const preferred = mics.find((device) => MIC_NAME.test(device.name))
  const mic = preferred ?? mics[0] ?? null
  return { mic: mic?.name ?? null, loopback: loopback?.name ?? null }
}
