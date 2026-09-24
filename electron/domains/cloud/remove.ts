import type { RecordingUploads, UploadFileIds } from '../recording/meta'
import { CloudHttpError, trashDriveFile } from './google-drive'
import { deleteOneDriveItem } from './onedrive'

const KINDS = ['audio', 'transcript', 'summary'] as const
type Kind = (typeof KINDS)[number]
type Provider = 'google' | 'microsoft'

const KEPT = 'Cloud copies could not be removed, so the recording on this computer was kept.'

export async function removeUploadedCopies(input: {
  uploads: RecordingUploads | undefined
  getAccess: (provider: Provider, force?: boolean) => Promise<string>
  fetchImpl?: typeof fetch
}): Promise<void> {
  const failures: { label: string; reason: string }[] = []
  for (const provider of ['google', 'microsoft'] as const) {
    const targets = targetsFor(input.uploads, provider)
    if (targets.length === 0) continue
    let token: string
    try {
      token = await input.getAccess(provider, false)
    } catch (error) {
      failures.push({ label: providerName(provider), reason: safeAccessMessage(error) })
      continue
    }
    let refreshed = false
    for (const target of targets) {
      const outcome = await removeOne(provider, token, target, input.fetchImpl)
      if (outcome.ok) continue
      if (outcome.unauthorized && !refreshed) {
        try {
          token = await input.getAccess(provider, true)
          refreshed = true
        } catch (error) {
          failures.push({
            label: fileLabel(provider, target.kind),
            reason: safeAccessMessage(error)
          })
          break
        }
        const retried = await removeOne(provider, token, target, input.fetchImpl)
        if (retried.ok) continue
        failures.push({ label: fileLabel(provider, target.kind), reason: retried.reason })
        if (retried.unauthorized) break
        continue
      }
      failures.push({ label: fileLabel(provider, target.kind), reason: outcome.reason })
      if (outcome.unauthorized) break
    }
  }
  if (failures.length > 0) throw new Error(failureMessage(failures))
}

function targetsFor(
  uploads: RecordingUploads | undefined,
  provider: Provider
): { kind: Kind; id: string }[] {
  const files: UploadFileIds | undefined =
    provider === 'google' ? uploads?.google?.files : uploads?.microsoft?.files
  if (!files) return []
  const targets: { kind: Kind; id: string }[] = []
  for (const kind of KINDS) {
    const id = files[kind]
    if (typeof id === 'string' && id) targets.push({ kind, id })
  }
  return targets
}

type RemoveOutcome = { ok: true } | { ok: false; unauthorized: boolean; reason: string }

async function removeOne(
  provider: Provider,
  token: string,
  target: { kind: Kind; id: string },
  fetchImpl: typeof fetch | undefined
): Promise<RemoveOutcome> {
  try {
    if (provider === 'google') {
      await trashDriveFile({ accessToken: token, fileId: target.id, fetchImpl })
    } else {
      await deleteOneDriveItem({ accessToken: token, fileId: target.id, fetchImpl })
    }
    return { ok: true }
  } catch (error) {
    return {
      ok: false,
      unauthorized: error instanceof CloudHttpError && error.status === 401,
      reason: reasonFrom(provider, error)
    }
  }
}

function providerName(provider: Provider): string {
  return provider === 'google' ? 'Google Drive' : 'OneDrive'
}

function fileLabel(provider: Provider, kind: Kind): string {
  return `${providerName(provider)} ${kind}`
}

function safeAccessMessage(error: unknown): string {
  const message = error instanceof Error ? error.message.trim() : ''
  if (
    !message ||
    message.length > 180 ||
    /bearer/i.test(message) ||
    message.includes('access_token')
  ) {
    return 'Connect again.'
  }
  return message
}

function reasonFrom(provider: Provider, error: unknown): string {
  if (error instanceof CloudHttpError) return error.message
  if (error instanceof Error && error.message === 'That cloud file id is not valid.') {
    return error.message
  }
  return provider === 'google' ? 'Could not reach Google Drive.' : 'Could not reach OneDrive.'
}

function failureMessage(failures: { label: string; reason: string }[]): string {
  let message = KEPT
  for (const failure of failures) {
    const reason = failure.reason.endsWith('.') ? failure.reason : `${failure.reason}.`
    const next = `${message} ${failure.label}: ${reason}`
    if (next.length > 500) return `${message} Some failures were omitted.`
    message = next
  }
  return message
}
