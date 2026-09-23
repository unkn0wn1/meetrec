import { MICROSOFT_APPFOLDER_SCOPE, MICROSOFT_CALENDAR_SCOPE, OAUTH_TIMEOUT_MS } from './constants'
import type { CalendarCore } from './deps'
import { OAUTH_CLIENT_MISSING, effectiveMicrosoftClientId } from './env'
import { openLoopback } from './loopback'
import { exchangeMicrosoftCode, fetchMicrosoftEmail } from './microsoft-oauth'
import { authorizeUrl } from './oauth-request'
import { codeChallenge, codeVerifier, oauthState } from './pkce'

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
        codeChallenge: codeChallenge(verifier)
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
      try {
        tokens.accountEmail = await fetchMicrosoftEmail(tokens.accessToken, core.deps.fetchImpl)
      } catch {
        tokens.accountEmail = null
      }
      await core.deps.secrets.update((draft) => {
        draft.microsoftOAuth = tokens
      })
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
