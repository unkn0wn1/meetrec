import type { SearchHit } from '../../shared/search-contract'

export interface IndexJob {
  kind: 'index'
  ids: string[]
  refresh: boolean
  rebuild: boolean
  followUps: Set<string>
  followRefresh: boolean
  followRebuild: boolean
}

export interface PullJob {
  kind: 'pull'
}

export interface QueryJob {
  kind: 'query'
  text: string
  resolve: (hits: SearchHit[]) => void
  reject: (error: unknown) => void
}

export type SearchJob = IndexJob | PullJob | QueryJob

export class SearchQueue {
  private pending: SearchJob[] = []
  private active: SearchJob | null = null
  private killer: (() => void) | null = null
  private waitStop: (() => void) | null = null
  private stopped = false

  constructor(
    private readonly opts: {
      isRecording: () => boolean
      schedule: (fn: () => void, ms: number) => () => void
      run: (job: SearchJob) => Promise<void>
    }
  ) {}

  get idle(): boolean {
    return this.active === null && this.pending.length === 0
  }

  bindKill(kill: (() => void) | null): void {
    this.killer = kill
  }

  enqueuePull(): void {
    if (this.active?.kind === 'pull' || this.pending.some((job) => job.kind === 'pull')) return
    this.pending.push({ kind: 'pull' })
    this.pump()
  }

  enqueueIndex(id: string): void {
    this.enqueueIndexMany([id])
  }

  enqueueIndexMany(ids: string[], flags: { refresh?: boolean; rebuild?: boolean } = {}): void {
    const refresh = flags.refresh === true
    const rebuild = flags.rebuild === true
    if (this.active?.kind === 'index') {
      for (const id of ids) this.active.followUps.add(id)
      if (refresh) this.active.followRefresh = true
      if (rebuild) this.active.followRebuild = true
      return
    }
    const queued = this.pending.find((job): job is IndexJob => job.kind === 'index')
    if (queued) {
      for (const id of ids) {
        if (!queued.ids.includes(id)) queued.ids.push(id)
      }
      queued.refresh = queued.refresh || refresh
      queued.rebuild = queued.rebuild || rebuild
      return
    }
    if (ids.length === 0 && !refresh && !rebuild) return
    this.pending.push({
      kind: 'index',
      ids: [...ids],
      refresh,
      rebuild,
      followUps: new Set(),
      followRefresh: false,
      followRebuild: false
    })
    this.pump()
  }

  enqueueQuery(text: string): Promise<SearchHit[]> {
    return new Promise((resolve, reject) => {
      this.pending.push({ kind: 'query', text, resolve, reject })
      this.pump()
    })
  }

  cancelCurrent(): void {
    this.killer?.()
  }

  clearPending(): void {
    const queued = this.pending
    this.pending = []
    for (const job of queued) {
      if (job.kind === 'query') job.reject(new Error('Meeting search is off.'))
    }
    if (this.active?.kind === 'index') {
      this.active.followUps.clear()
      this.active.followRefresh = false
      this.active.followRebuild = false
    }
  }

  stop(): void {
    this.stopped = true
    this.waitStop?.()
    this.waitStop = null
    this.clearPending()
    this.cancelCurrent()
  }

  private pump(): void {
    if (this.stopped || this.active || this.pending.length === 0) return
    if (this.opts.isRecording()) {
      if (this.waitStop) return
      this.waitStop = this.opts.schedule(() => {
        this.waitStop = null
        this.pump()
      }, 250)
      return
    }
    const job = this.pending.shift()
    if (!job) return
    this.active = job
    void this.opts
      .run(job)
      .catch((error: unknown) => {
        if (job.kind === 'query') job.reject(error)
      })
      .finally(() => {
        const finished = this.active
        this.active = null
        this.killer = null
        if (finished?.kind === 'index') this.queueFollowUp(finished)
        this.pump()
      })
  }

  private queueFollowUp(job: IndexJob): void {
    if (job.followUps.size === 0 && !job.followRefresh && !job.followRebuild) return
    this.pending.unshift({
      kind: 'index',
      ids: [...job.followUps],
      refresh: job.followRefresh,
      rebuild: job.followRebuild,
      followUps: new Set(),
      followRefresh: false,
      followRebuild: false
    })
  }
}
