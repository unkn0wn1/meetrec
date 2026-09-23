import { GOOGLE_CALENDAR_SCOPE, GOOGLE_DRIVE_SCOPE, OAUTH_TIMEOUT_MS } from './constants'
import type { CalendarCore } from './deps'
import { OAUTH_CLIENT_MISSING, effectiveGoogleClientId, effectiveGoogleSecret } from './env'
import { applyGoogleSignIn } from './google-connections'
import { exchangeGoogleCode, fetchGoogleProfile } from './google-oauth'
import { dropGoogleCalendarSelection, writePreferences } from './preferences'
import { dropGoogleConnectionKeys } from './state-file'
import { openLoopback } from './loopback'
import { authorizeUrl } from './oauth-request'
import { codeChallenge, codeVerifier, oauthState } from './pkce'

export async function runGoogleConnect(
  core: CalendarCore,
  generation: number,
  purpose: 'calendar' | 'drive' = 'calendar'
): Promise<void> {
  const clientId = effectiveGoogleClientId()
  if (generation !== core.memory.connectGeneration) return
  try {
    if (!clientId) throw new Error(OAUTH_CLIENT_MISSING)
    const verifier = codeVerifier()
    const state = oauthState()
    const session = await openLoopback({
      expectedState: state,
      timeoutMs: OAUTH_TIMEOUT_MS,
      publicHost: '127.0.0.1'
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
    const knownDrive = purpose === 'drive' && replaceId != null
    const hint = knownDrive ? await loginHint(core, replaceId) : null
    await core.deps.openExternal(
      authorizeUrl({
        provider: 'google',
        clientId,
        redirectUri: session.redirectUri,
        scope:
          purpose === 'drive'
            ? `${GOOGLE_CALENDAR_SCOPE} ${GOOGLE_DRIVE_SCOPE}`
            : GOOGLE_CALENDAR_SCOPE,
        state,
        codeChallenge: codeChallenge(verifier),
        selectAccount: !knownDrive,
        loginHint: hint
      })
    )
    const code = await session.result
    await core.run(async () => {
      if (generation !== core.memory.connectGeneration) return
      const tokens = await exchangeGoogleCode({
        code,
        redirectUri: session.redirectUri,
        clientId,
        codeVerifier: verifier,
        clientSecret: effectiveGoogleSecret(),
        fetchImpl: core.deps.fetchImpl,
        now: core.deps.now()
      })
      if (generation !== core.memory.connectGeneration) return
      const profile = await fetchGoogleProfile(tokens.accessToken, core.deps.fetchImpl).catch(
        () => ({ id: null, email: null })
      )
      if (!profile.id) throw new Error('Google did not return an account id.')
      const accountId = profile.id
      const existing = (await core.deps.secrets.readBag()).googleConnections.find(
        (item) => item.id === accountId
      )
      tokens.accountEmail = profile.email ?? existing?.accountEmail ?? null
      let droppedId: string | null = null
      await core.deps.secrets.update((draft) => {
        const applied = applyGoogleSignIn(
          draft.googleConnections,
          { ...tokens, id: accountId },
          replaceId
        )
        draft.googleConnections = applied.connections
        droppedId = applied.droppedId
      })
      if (droppedId) {
        core.memory.prefs = dropGoogleCalendarSelection(core.memory.prefs, droppedId)
        core.memory.runtime = dropGoogleConnectionKeys(core.memory.runtime, droppedId)
        delete core.memory.events.googleByConnection[droppedId]
        delete core.memory.fetchedAt.googleByConnection[droppedId]
        delete core.memory.lists.google[droppedId]
        delete core.memory.accountErrors[droppedId]
        await writePreferences(core.deps.userDataDir(), core.memory.prefs)
        await core.saveRuntime()
      }
      core.memory.errors.google = null
      await core.fetchGoogle()
    })
  } catch (error) {
    await core.run(async () => {
      if (generation !== core.memory.connectGeneration) return
      const message = error instanceof Error ? error.message : 'Google sign-in failed.'
      if (message !== 'Sign-in cancelled.') core.memory.errors.google = message
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

async function loginHint(core: CalendarCore, connectionId: string): Promise<string | null> {
  const bag = await core.deps.secrets.readBag()
  return bag.googleConnections.find((item) => item.id === connectionId)?.accountEmail ?? null
}
