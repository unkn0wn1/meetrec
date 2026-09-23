import type { CalendarList, CalendarStatus } from '../../shared/calendar-contract'
import { FETCH_INTERVAL_MS, TICK_INTERVAL_MS } from './constants'
import { loadAccess } from './access'
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
import { emptyPreferences, readPreferences, writePreferences } from './preferences'
import { saveUploadPreference } from './upload-pref'
import { nextRecordableEvent } from './event-view'
import { clearSkippedArm, setRecordOptOut } from './record-opt'
import { decideSchedule, noticeBody } from './schedule'
import { readAutoRecordFlag } from '../settings/settings-file'
import { cachedEvents, fetchGoogleSnapshot, fetchMicrosoftSnapshot, freshEvents } from './snapshot'
import { emptyRuntimeState, readState, rememberKey, writeState } from './state-file'
import { buildCalendarStatus, visibleArm } from './status-view'
import { buildTrayModel, trayNext } from './tray-model'
import { cleanCalendarIds, cleanConnectionId, cleanProvider, cleanPurpose } from './validate'

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
    this.memory.connectTargetId = null
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
        next: trayNext(
          nextRecordableEvent(cachedEvents(this.memory), this.memory.runtime, this.deps.now())
        )
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
      snapshotAt: fresh.snapshotAt,
      autoRecord: readAutoRecordFlag(this.deps.userDataDir())
    })
    this.deps.onTray(
      buildTrayModel({
        recording: this.deps.recording.status().phase === 'recording',
        prompt: decision.prompt,
        arm: visibleArm(this),
        startAllowed: decision.startAllowed,
        next: trayNext(nextRecordableEvent(cachedEvents(this.memory), this.memory.runtime, now))
      })
    )
  }

  status(): Promise<CalendarStatus> {
    return this.run(() => this.buildStatus())
  }

  connect(input: {
    provider: unknown
    purpose: unknown
    connectionId?: unknown
  }): Promise<CalendarStatus> {
    const provider = cleanProvider(input.provider)
    const purpose = cleanPurpose(input.purpose)
    const connectionId = cleanConnectionId(input.connectionId)
    if (this.memory.connectPending) {
      return Promise.reject(new Error('Sign-in already in progress.'))
    }
    this.memory.connectPending = provider
    this.memory.connectTargetId = provider === 'google' ? connectionId : null
    const generation = ++this.memory.connectGeneration
    return this.finishConnect(provider, purpose, generation)
  }

  cancelConnect(): Promise<CalendarStatus> {
    this.memory.connectGeneration += 1
    this.memory.connectCancel?.()
    this.memory.connectCancel = null
    this.memory.connectPending = null
    this.memory.connectTargetId = null
    return this.run(async () => {
      await this.publish()
      return this.buildStatus()
    })
  }

  disconnect(input: { provider: unknown; connectionId?: unknown }): Promise<CalendarStatus> {
    return this.run(async () => {
      const provider = cleanProvider(input.provider)
      if (provider === 'microsoft') await disconnectMicrosoft(this)
      else await disconnectGoogle(this, cleanConnectionId(input.connectionId))
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

  list(): Promise<CalendarList> {
    return this.run(async () => {
      const status = await this.buildStatus()
      return { connected: status.connected, events: status.upcoming }
    })
  }

  setRecord(input: {
    occurrenceKey: unknown
    enabled: unknown
    scope: unknown
  }): Promise<CalendarStatus> {
    return this.run(async () => {
      await setRecordOptOut(this, input)
      return this.buildStatus()
    })
  }

  noteStopped(): Promise<void> {
    return this.run(() => clearLinkedStop(this))
  }

  refreshSchedule(): Promise<void> {
    return this.run(() => this.evaluate())
  }

  accessToken(provider: 'google' | 'microsoft', force = false): Promise<string> {
    return this.run(() => loadAccess(this.deps, this.memory, provider, force))
  }

  setCalendars(input: {
    provider: unknown
    connectionId?: unknown
    calendarIds: unknown
  }): Promise<CalendarStatus> {
    return this.run(async () => {
      const provider = cleanProvider(input.provider)
      const calendarIds = cleanCalendarIds(input.calendarIds)
      if (provider === 'microsoft') {
        this.memory.prefs = { ...this.memory.prefs, microsoftCalendarIds: calendarIds }
      } else {
        const connectionId = cleanConnectionId(input.connectionId)
        if (!connectionId) throw new Error('Choose a Google account.')
        const bag = await this.deps.secrets.readBag()
        if (!bag.googleConnections.some((item) => item.id === connectionId)) {
          throw new Error('That Google account is not connected.')
        }
        this.memory.prefs = {
          ...this.memory.prefs,
          googleCalendars: { ...this.memory.prefs.googleCalendars, [connectionId]: calendarIds }
        }
      }
      await writePreferences(this.deps.userDataDir(), this.memory.prefs)
      if (provider === 'microsoft') await this.fetchMicrosoft()
      else await this.fetchGoogle()
      await this.evaluate()
      return this.buildStatus()
    })
  }

  setUpload(provider: 'google' | 'microsoft', enabled: boolean): Promise<CalendarStatus> {
    return this.run(() => saveUploadPreference(this, provider, enabled))
  }

  private async finishConnect(
    provider: 'google' | 'microsoft',
    purpose: 'calendar' | 'drive',
    generation: number
  ): Promise<CalendarStatus> {
    await this.run(() => this.publish())
    if (provider === 'microsoft') await runMicrosoftConnect(this, generation, purpose)
    else await runGoogleConnect(this, generation, purpose)
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
    if (clearSkippedArm(this)) await this.saveRuntime()
    const autoRecord = readAutoRecordFlag(this.deps.userDataDir())
    const decision = this.decision(autoRecord)
    if (decision.graceDue) await runGraceStop(this)
    const afterGrace = this.decision(autoRecord)
    if (afterGrace.dueArm) {
      try {
        await fireArm(this, afterGrace.dueArm)
      } catch (error) {
        this.memory.runtime.arm = null
        if (autoRecord) {
          this.memory.runtime.dismissed = rememberKey(
            this.memory.runtime.dismissed,
            afterGrace.dueArm.occurrenceKey
          )
        }
        const provider = afterGrace.dueArm.occurrenceKey.startsWith('microsoft:')
          ? 'microsoft'
          : 'google'
        this.memory.errors[provider] =
          error instanceof Error ? error.message : 'Could not start the recording.'
        await this.saveRuntime()
      }
    }
    const prompt = this.decision(autoRecord)
    if (prompt.notify && prompt.notice) {
      this.memory.runtime.notified = rememberKey(
        this.memory.runtime.notified,
        prompt.notice.occurrenceKey
      )
      await this.saveRuntime()
      this.deps.onNotify({
        title: prompt.notice.title,
        body: noticeBody(prompt.notice, autoRecord)
      })
    }
    await this.publish()
  }

  private decision(autoRecord = readAutoRecordFlag(this.deps.userDataDir())) {
    const now = this.deps.now()
    const fresh = freshEvents(this.memory, now)
    return decideSchedule({
      now,
      events: fresh.events,
      state: this.memory.runtime,
      recording: this.deps.recording.status().phase === 'recording',
      snapshotAt: fresh.snapshotAt,
      autoRecord
    })
  }

  buildStatus(): Promise<CalendarStatus> {
    return buildCalendarStatus(this)
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
