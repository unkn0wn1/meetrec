const SECRET_FIELDS = ['access_token', 'refresh_token', 'id_token', 'code', 'client_secret']

export async function readJson(response: Response): Promise<unknown> {
  const text = await response.text()
  if (!text) return null
  try {
    return JSON.parse(text) as unknown
  } catch {
    return null
  }
}

export function collectSecrets(value: unknown, found: string[] = []): string[] {
  if (!value || typeof value !== 'object') return found
  if (Array.isArray(value)) {
    for (const item of value) collectSecrets(item, found)
    return found
  }
  for (const [key, item] of Object.entries(value)) {
    if (SECRET_FIELDS.includes(key) && typeof item === 'string' && item.length > 0) {
      found.push(item)
    } else if (item && typeof item === 'object') {
      collectSecrets(item, found)
    }
  }
  return found
}

/** Error and error_description only, with token strings removed. */
export function shortTokenError(payload: unknown, fallback: string): string {
  let message = fallback
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    const record = payload as Record<string, unknown>
    const error = typeof record.error === 'string' ? record.error.trim() : ''
    const description =
      typeof record.error_description === 'string' ? record.error_description.trim() : ''
    const parts = [error, description].filter(Boolean)
    if (parts.length > 0) message = parts.join(': ')
  }
  for (const secret of collectSecrets(payload)) {
    if (secret.length < 4) continue
    message = message.split(secret).join('[redacted]')
  }
  if (message.length > 180) return message.slice(0, 180)
  return message
}
