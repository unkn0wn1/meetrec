import { MICROSOFT_APPFOLDER_SCOPE, MICROSOFT_CALENDAR_SCOPE, OAUTH_TIMEOUT_MS } from './constants'
import type { CalendarCore } from './deps'
import { OAUTH_CLIENT_MISSING, effectiveMicrosoftClientId } from './env'
import { openLoopback } from './loopback'
import {
  applyMicrosoftSignIn,
  microsoftConnectionId,
  prepareMicrosoftSignIn
} from './microsoft-connections'
import { moveMicrosoftBucket } from './microsoft-fetch'
import { exchangeMicrosoftCode, fetchMicrosoftProfile } from './microsoft-oauth'
import { authorizeUrl } from './oauth-request'
import { codeChallenge, codeVerifier, oauthState } from './pkce'
import {
  dropMicrosoftCalendarSelection,
  moveMicrosoftCalendarSelection,
  writePreferences
} from './preferences'
import { dropConnectionKeys } from './state-file'

export async function runMicrosoftConnect(
  core: CalendarCore,
  generation: number,
  purpose: 'calendar' | 'drive' = 'calendar'
): Promise<void> {
  const clientId = effectiveMicrosoftClientId()
  if (generation !== core.memory.connectGeneration) return
  try {
    if (!clientId) throw new Error(OAUTH_CLIENT_MISSING)
    const verifier = codeVerifier()
    const state = oauthState()
    const session = await openLoopback({
      expectedState: state,
      timeoutMs: OAUTH_TIMEOUT_MS,
      publicHost: 'localhost'
    })
    if (generation !== core.memory.connectGeneration) {
      session.cancel()
      return
    }
    core.memory.connectCancel = () => {
      session.cancel()
    }
    await core.run(() => core.publish())
    const replaceId = core.memory.connectTargetId
    const hint = await loginHint(core, replaceId)
    await core.deps.openExternal(
      authorizeUrl({
        provider: 'microsoft',
        clientId,
        redirectUri: session.redirectUri,
        scope:
          purpose === 'drive'
            ? `${MICROSOFT_CALENDAR_SCOPE} ${MICROSOFT_APPFOLDER_SCOPE}`
            : MICROSOFT_CALENDAR_SCOPE,
        state,
        codeChallenge: codeChallenge(verifier),
        loginHint: hint
      })
    )
    const code = await session.result
    await core.run(async () => {
      if (generation !== core.memory.connectGeneration) return
      const tokens = await exchangeMicrosoftCode({
        code,
        redirectUri: session.redirectUri,
        clientId,
        codeVerifier: verifier,
        fetchImpl: core.deps.fetchImpl,
        now: core.deps.now()
      })
      if (generation !== core.memory.connectGeneration) return
      const profile = await fetchMicrosoftProfile(tokens.accessToken, core.deps.fetchImpl).catch(
        () => ({ id: null, email: null })
      )
      const accountId = microsoftConnectionId(profile)
      if (!accountId) throw new Error('Microsoft did not return an account id.')
      const existing = (await core.deps.secrets.readBag()).microsoftConnections.find(
        (item) => item.id === accountId
      )
      tokens.accountEmail = profile.email ?? existing?.accountEmail ?? null
      const account = { ...tokens, id: accountId }
      let droppedId: string | null = null
      let rekeyedFrom: string | null = null
      await core.deps.secrets.update((draft) => {
        const prepared = prepareMicrosoftSignIn(draft.microsoftConnections, account)
        rekeyedFrom = prepared.rekeyedFrom
        const applied = applyMicrosoftSignIn(prepared.connections, account, replaceId)
        draft.microsoftConnections = applied.connections
        droppedId = applied.droppedId
      })
      if (rekeyedFrom) {
        core.memory.prefs = moveMicrosoftCalendarSelection(
          core.memory.prefs,
          rekeyedFrom,
          accountId
        )
        moveMicrosoftBucket(core.memory, rekeyedFrom, accountId)
        await writePreferences(core.deps.userDataDir(), core.memory.prefs)
      }
      if (droppedId && droppedId !== rekeyedFrom) {
        core.memory.prefs = dropMicrosoftCalendarSelection(core.memory.prefs, droppedId)
        core.memory.runtime = dropConnectionKeys(core.memory.runtime, 'microsoft', droppedId)
        delete core.memory.events.microsoftByConnection[droppedId]
        delete core.memory.fetchedAt.microsoftByConnection[droppedId]
        delete core.memory.lists.microsoft[droppedId]
        delete core.memory.microsoftAccountErrors[droppedId]
        await writePreferences(core.deps.userDataDir(), core.memory.prefs)
        await core.saveRuntime()
      }
      core.memory.errors.microsoft = null
      await core.fetchMicrosoft()
    })
  } catch (error) {
    await core.run(async () => {
      if (generation !== core.memory.connectGeneration) return
      const message = error instanceof Error ? error.message : 'Microsoft sign-in failed.'
      if (message !== 'Sign-in cancelled.') core.memory.errors.microsoft = message
    })
  } finally {
    if (generation === core.memory.connectGeneration) {
      await core.run(async () => {
        if (generation !== core.memory.connectGeneration) return
        core.memory.connectPending = null
        core.memory.connectTargetId = null
        core.memory.connectCancel = null
        await core.publish()
      })
    }
  }
}

async function loginHint(core: CalendarCore, connectionId: string | null): Promise<string | null> {
  if (!connectionId) return null
  const bag = await core.deps.secrets.readBag()
  return bag.microsoftConnections.find((item) => item.id === connectionId)?.accountEmail ?? null
}
