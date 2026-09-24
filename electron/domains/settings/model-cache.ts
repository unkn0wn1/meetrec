import type { ProviderId, ProviderRole, RoleProbe } from '../../shared/ipc-contract'
import type { ListedModels } from '../providers/list-models'
import { coerceModel, modelOptions } from '../providers/registry'
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
    next = applyRoleList(
      next,
      provider,
      'voice',
      roleIdsOrSeed(provider, 'voice', listed),
      fetchedAt
    )
  }
  if (probes.ai.state === 'pass') {
    next = applyRoleList(next, provider, 'ai', roleIdsOrSeed(provider, 'ai', listed), fetchedAt)
  }
  return next
}

/**
 * Prefer the live catalog for a role. When the catalog request succeeded but that
 * role matched nothing (common for xAI STT), fall back to the registry seeds so a
 * passing probe is not stuck on “Test to load models”. A failed catalog request
 * (`listed === null`) still leaves the role empty.
 */
export function roleIdsOrSeed(
  provider: ProviderId,
  role: ProviderRole,
  listed: ListedModels | null
): string[] | null {
  if (!listed) return null
  const ids = role === 'voice' ? listed.voice : listed.ai
  if (ids.length > 0) return ids
  const seeds = modelOptions(provider, role).map((item) => item.id)
  return seeds.length > 0 ? seeds : null
}
