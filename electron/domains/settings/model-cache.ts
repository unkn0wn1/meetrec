import type { ProviderId, ProviderRole, RoleProbe } from '../../shared/ipc-contract'
import type { ListedModels } from '../providers/list-models'
import { coerceModel } from '../providers/registry'
import type { AppSettings } from './settings-file'

export function applyRoleList(
  settings: AppSettings,
  provider: ProviderId,
  role: ProviderRole,
  ids: readonly string[] | null,
  fetchedAt: string
): AppSettings {
  if (!ids || ids.length === 0) return settings
  const selected = coerceModel(provider, role, settings.models[provider][role], ids)
  return {
    ...settings,
    models: {
      ...settings.models,
      [provider]: { ...settings.models[provider], [role]: selected }
    },
    modelCache: {
      ...settings.modelCache,
      [provider]: {
        ...settings.modelCache[provider],
        [role]: { ids: [...ids], fetchedAt }
      }
    }
  }
}

export function mergeListedModels(
  settings: AppSettings,
  provider: ProviderId,
  probes: { voice: RoleProbe; ai: RoleProbe },
  listed: ListedModels | null,
  fetchedAt: string
): AppSettings {
  let next = settings
  if (probes.voice.state === 'pass') {
    next = applyRoleList(next, provider, 'voice', listed?.voice ?? null, fetchedAt)
  }
  if (probes.ai.state === 'pass') {
    next = applyRoleList(next, provider, 'ai', listed?.ai ?? null, fetchedAt)
  }
  return next
}
