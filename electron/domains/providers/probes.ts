import type { ProviderRole, RoleProbe } from '../../shared/ipc-contract'
import { OPENAI_CHAT_URL, OPENAI_STT_URL, XAI_CHAT_URL, XAI_STT_URL } from './models'
import { silentWavBytes } from './probe-sample'
import type { ProviderFamily } from './registry'

export interface RoleProbeInput {
  family: ProviderFamily
  model: string
  token: string | null
  supported: boolean
  missingMessage: string
  fetchImpl?: typeof fetch
}

export function idleProbe(): RoleProbe {
  return { state: 'idle', message: '' }
}

export async function probeVoice(input: RoleProbeInput): Promise<RoleProbe> {
  if (!input.supported) return unsupported('voice')
  const token = input.token?.trim() ?? ''
  if (!token) return { state: 'fail', message: input.missingMessage }
  const url = input.family === 'openai' ? OPENAI_STT_URL : XAI_STT_URL
  return postProbe({
    url,
    token,
    label: 'Voice',
    fetchImpl: input.fetchImpl,
    body: voiceBody(input.model),
    accept: (status) => status === 200
  })
}

export async function probeAi(input: RoleProbeInput): Promise<RoleProbe> {
  if (!input.supported) return unsupported('ai')
  const token = input.token?.trim() ?? ''
  if (!token) return { state: 'fail', message: input.missingMessage }
  const url = input.family === 'openai' ? OPENAI_CHAT_URL : XAI_CHAT_URL
  return postProbe({
    url,
    token,
    label: 'AI',
    fetchImpl: input.fetchImpl,
    json: {
      model: input.model,
      temperature: 0,
      max_tokens: 1,
      messages: [{ role: 'user', content: 'ping' }]
    },
    accept: (status) => status === 200
  })
}

function unsupported(role: ProviderRole): RoleProbe {
  return {
    state: 'na',
    message:
      role === 'voice' ? 'This provider does not transcribe.' : 'This provider does not summarize.'
  }
}

function voiceBody(model: string): FormData {
  const form = new FormData()
  form.append('model', model)
  const bytes = silentWavBytes()
  form.append('file', new Blob([new Uint8Array(bytes)], { type: 'audio/wav' }), 'probe.wav')
  return form
}

async function postProbe(input: {
  url: string
  token: string
  label: 'Voice' | 'AI'
  fetchImpl?: typeof fetch
  body?: FormData
  json?: unknown
  accept: (status: number, body: string) => boolean
}): Promise<RoleProbe> {
  const fetchImpl = input.fetchImpl ?? fetch
  try {
    const response = await fetchImpl(input.url, {
      method: 'POST',
      headers: input.json
        ? { Authorization: `Bearer ${input.token}`, 'Content-Type': 'application/json' }
        : { Authorization: `Bearer ${input.token}` },
      body: input.json ? JSON.stringify(input.json) : input.body
    })
    const raw = await response.text()
    if (input.accept(response.status, raw)) {
      return { state: 'pass', message: `${input.label} check passed.` }
    }
    return { state: 'fail', message: `${input.label} check failed (${response.status}).` }
  } catch {
    return { state: 'fail', message: `${input.label} check failed.` }
  }
}
