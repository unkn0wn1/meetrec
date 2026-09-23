import type { CalendarStatus } from '../../shared/calendar-contract'
import {
  FETCH_INTERVAL_MS,
  GOOGLE_DRIVE_SCOPE,
  MICROSOFT_APPFOLDER_SCOPE,
  TICK_INTERVAL_MS
} from './constants'
import {
  armOccurrence,
  clearLinkedStop,
  disconnectGoogle,
  disconnectMicrosoft,
  dismissOccurrence,
  fireArm,
  runGraceStop,
  startOccurrence
} from './actions'
import { runGoogleConnect } from './connect'
import { runMicrosoftConnect } from './microsoft-connect'
import { emptyMemory, type CalendarCore, type CalendarDeps, type CalendarMemory } from './deps'
import { effectiveGoogleClientId, effectiveGoogleSecret, effectiveMicrosoftClientId } from './env'
import { emptyPreferences, readPreferences, writePreferences } from './preferences'
import { decideSchedule } from './schedule'
import { cachedEvents, fetchGoogleSnapshot, fetchMicrosoftSnapshot, freshEvents } from './snapshot'
import type { CalendarEvent } from './source'
import { emptyRuntimeState, readState, rememberKey, writeState } from './state-file'
import { scopeIncludes } from './tokens'
import { buildTrayModel } from './tray-model'
import { cleanClientId, cleanClientSecret, cleanProvider, cleanPurpose } from './validate'

export class CalendarService implements CalendarCore {
  readonly memory: CalendarMemory
  private chain: Promise<void> = Promise.resolve()
  private started = false
  private fetchTimer: ReturnType<typeof setInterval> | null = null
  private tickTimer: ReturnType<typeof setInterval> | null = null
  private lastEncoded = ''
  private promptKey: string | null = null

  constructor(readonly deps: CalendarDeps) {
    this.memory = emptyMemory(emptyPreferences(), emptyRuntimeState())
  }

  start(): void {
    if (this.started) return
    this.started = true
    this.fetchTimer = setInterval(() => {
      void this.run(() => this.fetchAndEvaluate())
    }, FETCH_INTERVAL_MS)
    this.tickTimer = setInterval(() => {
      void this.run(() => this.evaluate())
    }, TICK_INTERVAL_MS)
    void this.run(() => this.boot())
  }

  stop(): void {
    this.started = false
    if (this.fetchTimer) clearInterval(this.fetchTimer)
    if (this.tickTimer) clearInterval(this.tickTimer)
    this.fetchTimer = null
    this.tickTimer = null
    this.memory.connectGeneration += 1
    this.memory.connectCancel?.()
    this.memory.connectCancel = null
    this.memory.connectPending = null
  }

  fetchGoogle(): Promise<void> {
    return fetchGoogleSnapshot(this.deps, this.memory)
  }

  fetchMicrosoft(): Promise<void> {
    return fetchMicrosoftSnapshot(this.deps, this.memory)
  }

  async saveRuntime(): Promise<void> {
    await writeState(this.deps.userDataDir(), this.memory.runtime, this.deps.now())
    this.memory.runtime = await readState(this.deps.userDataDir(), this.deps.now())
  }

  async publish(): Promise<void> {
    const status = await this.buildStatus()
    const encoded = JSON.stringify(status)
    if (encoded !== this.lastEncoded) {
      this.lastEncoded = encoded
      this.deps.onStatus(status)
    }
    this.deps.onTray(
      buildTrayModel({
        recording: this.deps.recording.status().phase === 'recording',
        prompt: status.prompt,
        arm: status.arm,
        startAllowed: Boolean(status.prompt) && this.deps.recording.status().phase !== 'recording',
        next: nextEvent(cachedEvents(this.memory), this.deps.now())
      })
    )
    const key = status.prompt?.occurrenceKey ?? null
    if (key !== this.promptKey) {
      this.promptKey = key
      this.deps.onPrompt(key != null)
    }
  }

  renderTray(): void {
    const now = this.deps.now()
    const fresh = freshEvents(this.memory, now)
    const decision = decideSchedule({
      now,
      events: fresh.events,
      state: this.memory.runtime,
      recording: this.deps.recording.status().phase === 'recording',
      snapshotAt: fresh.snapshotAt
    })
    this.deps.onTray(
      buildTrayModel({
        recording: this.deps.recording.status().phase === 'recording',
        prompt: decision.prompt,
        arm: this.memory.runtime.arm,
        startAllowed: decision.startAllowed,
        next: nextEvent(cachedEvents(this.memory), now)
      })
    )
  }

  status(): Promise<CalendarStatus> {
    return this.run(() => this.buildStatus())
  }

  saveGoogleClient(input: { clientId: unknown; clientSecret?: unknown }): Promise<CalendarStatus> {
    return this.run(async () => {
      const clientId = cleanClientId(input.clientId)
      this.memory.prefs = { ...this.memory.prefs, googleClientId: clientId }
      await writePreferences(this.deps.userDataDir(), this.memory.prefs)
      if (typeof input.clientSecret === 'string' && input.clientSecret.trim()) {
        const secret = cleanClientSecret(input.clientSecret)
        await this.deps.secrets.update((bag) => {
          bag.googleClientSecret = secret
        })
      }
      await this.publish()
      return this.buildStatus()
    })
  }

  clearGoogleSecret(): Promise<CalendarStatus> {
    return this.run(async () => {
      await this.deps.secrets.update((bag) => {
        bag.googleClientSecret = null
      })
      await this.publish()
      return this.buildStatus()
    })
  }

  saveMicrosoftClient(input: { clientId: unknown }): Promise<CalendarStatus> {
    return this.run(async () => {
      this.memory.prefs = { ...this.memory.prefs, microsoftClientId: cleanClientId(input.clientId) }
      await writePreferences(this.deps.userDataDir(), this.memory.prefs)
      await this.publish()
      return this.buildStatus()
    })
  }

  connect(input: { provider: unknown; purpose: unknown }): Promise<CalendarStatus> {
    const provider = cleanProvider(input.provider)
    const purpose = cleanPurpose(input.purpose)
    if (purpose === 'drive') return Promise.reject(new Error('Drive connect is not available yet.'))
    if (this.memory.connectPending) {
      return Promise.reject(new Error('Sign-in already in progress.'))
    }
    this.memory.connectPending = provider
    const generation = ++this.memory.connectGeneration
    return this.finishConnect(provider, generation)
  }

  cancelConnect(): Promise<CalendarStatus> {
    this.memory.connectGeneration += 1
    this.memory.connectCancel?.()
    this.memory.connectCancel = null
    this.memory.connectPending = null
    return this.run(async () => {
      await this.publish()
      return this.buildStatus()
    })
  }

  disconnect(input: { provider: unknown }): Promise<CalendarStatus> {
    return this.run(async () => {
      const provider = cleanProvider(input.provider)
      if (provider === 'microsoft') await disconnectMicrosoft(this)
      else await disconnectGoogle(this)
      return this.buildStatus()
    })
  }

  dismiss(input: { occurrenceKey: unknown }): Promise<CalendarStatus> {
    return this.run(async () => {
      await dismissOccurrence(this, input.occurrenceKey)
      return this.buildStatus()
    })
  }

  arm(input: { occurrenceKey: unknown }): Promise<CalendarStatus> {
    return this.run(async () => {
      await armOccurrence(this, input.occurrenceKey)
      return this.buildStatus()
    })
  }

  cancelArm(): Promise<CalendarStatus> {
    return this.run(async () => {
      this.memory.runtime.arm = null
      await this.saveRuntime()
      await this.publish()
      return this.buildStatus()
    })
  }

  startFromOccurrence(input: { occurrenceKey: unknown }): Promise<CalendarStatus> {
    return this.run(async () => {
      await startOccurrence(this, input.occurrenceKey)
      return this.buildStatus()
    })
  }

  noteStopped(): Promise<void> {
    return this.run(() => clearLinkedStop(this))
  }

  private async finishConnect(
    provider: 'google' | 'microsoft',
    generation: number
  ): Promise<CalendarStatus> {
    await this.run(() => this.publish())
    if (provider === 'microsoft') await runMicrosoftConnect(this, generation)
    else await runGoogleConnect(this, generation)
    return this.run(() => this.buildStatus())
  }

  private async boot(): Promise<void> {
    this.memory.prefs = await readPreferences(this.deps.userDataDir())
    this.memory.runtime = await readState(this.deps.userDataDir(), this.deps.now())
    await this.fetchAndEvaluate()
  }

  private async fetchAndEvaluate(): Promise<void> {
    await this.fetchGoogle()
    await this.fetchMicrosoft()
    await this.evaluate()
  }

  private async evaluate(): Promise<void> {
    const decision = this.decision()
    if (decision.graceDue) await runGraceStop(this)
    const afterGrace = this.decision()
    if (afterGrace.dueArm) {
      try {
        await fireArm(this, afterGrace.dueArm)
      } catch (error) {
        this.memory.runtime.arm = null
        const provider = afterGrace.dueArm.occurrenceKey.startsWith('microsoft:')
          ? 'microsoft'
          : 'google'
        this.memory.errors[provider] =
          error instanceof Error ? error.message : 'Could not start the recording.'
        await this.saveRuntime()
      }
    }
    const prompt = this.decision()
    if (prompt.notify && prompt.prompt) {
      this.memory.runtime.notified = rememberKey(
        this.memory.runtime.notified,
        prompt.prompt.occurrenceKey
      )
      await this.saveRuntime()
      this.deps.onNotify({
        title: prompt.prompt.title,
        body: `Starts in ${prompt.prompt.minutesUntil} min.`
      })
    }
    await this.publish()
  }

  private decision() {
    const now = this.deps.now()
    const fresh = freshEvents(this.memory, now)
    return decideSchedule({
      now,
      events: fresh.events,
      state: this.memory.runtime,
      recording: this.deps.recording.status().phase === 'recording',
      snapshotAt: fresh.snapshotAt
    })
  }

  private async buildStatus(): Promise<CalendarStatus> {
    const bag = await this.deps.secrets.readBag()
    const now = this.deps.now()
    const fresh = freshEvents(this.memory, now)
    const decision = decideSchedule({
      now,
      events: fresh.events,
      state: this.memory.runtime,
      recording: this.deps.recording.status().phase === 'recording',
      snapshotAt: fresh.snapshotAt
    })
    const google = bag.googleOAuth
    const microsoft = bag.microsoftOAuth
    return {
      connectPending: this.memory.connectPending,
      google: {
        clientId: effectiveGoogleClientId(this.memory.prefs),
        secretSet: Boolean(effectiveGoogleSecret(bag.googleClientSecret)),
        connected: Boolean(google?.refreshToken),
        accountEmail: google?.accountEmail ?? null,
        uploadEnabled: this.memory.prefs.uploadGoogle,
        uploadScopeGranted: scopeIncludes(google?.scope ?? '', GOOGLE_DRIVE_SCOPE),
        error: this.memory.errors.google
      },
      microsoft: {
        clientId: effectiveMicrosoftClientId(this.memory.prefs),
        secretSet: false,
        connected: Boolean(microsoft?.refreshToken),
        accountEmail: microsoft?.accountEmail ?? null,
        uploadEnabled: this.memory.prefs.uploadMicrosoft,
        uploadScopeGranted: scopeIncludes(microsoft?.scope ?? '', MICROSOFT_APPFOLDER_SCOPE),
        error: this.memory.errors.microsoft
      },
      upcoming: cachedEvents(this.memory).map(toView),
      prompt: decision.prompt,
      arm: this.memory.runtime.arm
        ? {
            occurrenceKey: this.memory.runtime.arm.occurrenceKey,
            title: this.memory.runtime.arm.title,
            fireAt: this.memory.runtime.arm.fireAt
          }
        : null
    }
  }

  run<T>(work: () => Promise<T>): Promise<T> {
    const next = this.chain.then(work, work)
    this.chain = next.then(
      () => undefined,
      () => undefined
    )
    return next
  }
}

function toView(event: CalendarEvent): CalendarStatus['upcoming'][number] {
  const names: string[] = []
  for (const attendee of event.attendees) {
    const name = attendee.name.trim()
    if (!name || name.includes('@') || names.includes(name)) continue
    names.push(name)
  }
  return {
    occurrenceKey: event.occurrenceKey,
    provider: event.provider,
    title: event.title,
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    attendeeNames: names
  }
}

function nextEvent(events: CalendarEvent[], now: number): CalendarEvent | null {
  return events.find((event) => Date.parse(event.startsAt) >= now) ?? null
}
