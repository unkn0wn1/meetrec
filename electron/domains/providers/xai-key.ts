import { resolveXaiApiKey } from '../settings/key-status'

/** Env-only lookup. Prefer SettingsService.readXaiApiKey so a saved key wins. */
export function readXaiApiKey(env: NodeJS.ProcessEnv = process.env): string | null {
  return resolveXaiApiKey(null, env.XAI_API_KEY)
}
