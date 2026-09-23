export type XaiKeySource = 'settings' | 'env' | 'none'

export interface XaiKeyStatus {
  hasXaiKey: boolean
  xaiKeySource: XaiKeySource
}

export function resolveXaiApiKey(
  saved: string | null,
  envValue: string | undefined
): string | null {
  const fromSettings = saved?.trim() ?? ''
  if (fromSettings) return fromSettings
  const fromEnv = envValue?.trim() ?? ''
  if (fromEnv) return fromEnv
  return null
}

export function xaiKeyStatus(saved: string | null, envValue: string | undefined): XaiKeyStatus {
  const fromSettings = saved?.trim() ?? ''
  if (fromSettings) return { hasXaiKey: true, xaiKeySource: 'settings' }
  const fromEnv = envValue?.trim() ?? ''
  if (fromEnv) return { hasXaiKey: true, xaiKeySource: 'env' }
  return { hasXaiKey: false, xaiKeySource: 'none' }
}

export function canUseXai(status: XaiKeyStatus, validationOk: boolean): boolean {
  return status.hasXaiKey && validationOk
}
