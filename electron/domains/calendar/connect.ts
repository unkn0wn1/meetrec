import { GOOGLE_CALENDAR_SCOPE, OAUTH_TIMEOUT_MS } from './constants'
import type { CalendarCore } from './deps'
import { effectiveGoogleClientId, effectiveGoogleSecret } from './env'
import { exchangeGoogleCode, fetchGoogleEmail } from './google-oauth'
import { openLoopback } from './loopback'
import { authorizeUrl } from './oauth-request'
import { codeChallenge, codeVerifier, oauthState } from './pkce'

export async function runGoogleConnect(core: CalendarCore, generation: number): Promise<void> {
  const clientId = effectiveGoogleClientId(core.memory.prefs)
  if (generation !== core.memory.connectGeneration) return
  try {
    if (!clientId) throw new Error('Add a Google client id first.')
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
    await core.deps.openExternal(
      authorizeUrl({
        provider: 'google',
        clientId,
        redirectUri: session.redirectUri,
        scope: GOOGLE_CALENDAR_SCOPE,
        state,
        codeChallenge: codeChallenge(verifier)
      })
    )
    const code = await session.result
    await core.run(async () => {
      if (generation !== core.memory.connectGeneration) return
      const bag = await core.deps.secrets.readBag()
      const tokens = await exchangeGoogleCode({
        code,
        redirectUri: session.redirectUri,
        clientId,
        codeVerifier: verifier,
        clientSecret: effectiveGoogleSecret(bag.googleClientSecret),
        fetchImpl: core.deps.fetchImpl,
        now: core.deps.now()
      })
      if (generation !== core.memory.connectGeneration) return
      try {
        tokens.accountEmail = await fetchGoogleEmail(tokens.accessToken, core.deps.fetchImpl)
      } catch {
        tokens.accountEmail = null
      }
      await core.deps.secrets.update((draft) => {
        draft.googleOAuth = tokens
      })
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
        core.memory.connectCancel = null
        await core.publish()
      })
    }
  }
}
