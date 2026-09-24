import { describe, expect, it } from 'vitest'
import type { LibraryJobProgress } from '../../electron/shared/ipc-contract'
import { elapsedLabel, nextJobView, progressLabel, stageLabel, type JobView } from './job-progress'

const startedAt = 1_700_000_000_000

function event(
  partial: Partial<LibraryJobProgress> & Pick<LibraryJobProgress, 'stage'>
): LibraryJobProgress {
  return {
    id: 'rec',
    job: 'transcribe',
    startedAt,
    ...partial
  }
}

describe('stageLabel', () => {
  it('names each transcribe stage', () => {
    expect(stageLabel('transcribe', 'preparing')).toBe('Preparing audio')
    expect(stageLabel('transcribe', 'uploading')).toBe('Uploading')
    expect(stageLabel('transcribe', 'waiting')).toBe('Waiting for model')
    expect(stageLabel('transcribe', 'saving')).toBe('Saving')
  })

  it('names each summarize stage', () => {
    expect(stageLabel('summarize', 'preparing')).toBe('Preparing')
    expect(stageLabel('summarize', 'waiting')).toBe('Waiting for model')
    expect(stageLabel('summarize', 'saving')).toBe('Saving')
  })

  it('rejects a stage that does not belong to the job', () => {
    expect(stageLabel('summarize', 'uploading')).toBeNull()
    expect(stageLabel('transcribe', 'missing')).toBeNull()
  })
})

describe('progressLabel', () => {
  it('uses a non-empty message and falls back when the message is blank', () => {
    expect(progressLabel('transcribe', 'waiting', 'Custom')).toBe('Custom')
    expect(progressLabel('transcribe', 'waiting', '')).toBe('Waiting for model')
    expect(progressLabel('transcribe', 'waiting', '   ')).toBe('Waiting for model')
    expect(progressLabel('summarize', 'uploading', 'Nope')).toBeNull()
  })
})

describe('elapsedLabel', () => {
  it('formats elapsed milliseconds as mm:ss', () => {
    expect(elapsedLabel(0, 0)).toBe('00:00')
    expect(elapsedLabel(0, 1500)).toBe('00:01')
    expect(elapsedLabel(0, 90_000)).toBe('01:30')
    expect(elapsedLabel(0, 3_600_000)).toBe('60:00')
  })

  it('clamps a negative or non-finite span to 00:00', () => {
    expect(elapsedLabel(5_000, 1_000)).toBe('00:00')
    expect(elapsedLabel(Number.NaN, 1_000)).toBe('00:00')
    expect(elapsedLabel(0, Number.POSITIVE_INFINITY)).toBe('00:00')
  })
})

describe('nextJobView', () => {
  it('shows the first stage and keeps startedAt when the stage changes', () => {
    const first = nextJobView(null, null, event({ stage: 'preparing' }))
    expect(first.current).toEqual({
      id: 'rec',
      job: 'transcribe',
      stage: 'preparing',
      label: 'Preparing audio',
      startedAt
    })
    const next = nextJobView(first.current, first.sealedStartedAt, event({ stage: 'uploading' }))
    expect(next.current?.stage).toBe('uploading')
    expect(next.current?.label).toBe('Uploading')
    expect(next.current?.startedAt).toBe(startedAt)
  })

  it('clears a matching job and ignores a later stage for that start time', () => {
    const current = view()
    const cleared = nextJobView(current, null, event({ stage: null }))
    expect(cleared.current).toBeNull()
    expect(cleared.sealedStartedAt).toBe(startedAt)
    const stale = nextJobView(cleared.current, cleared.sealedStartedAt, event({ stage: 'saving' }))
    expect(stale.current).toBeNull()
    expect(stale.sealedStartedAt).toBe(startedAt)
  })

  it('leaves the current job when a different recording clears', () => {
    const current = view()
    const next = nextJobView(
      current,
      null,
      event({ id: 'other', stage: null, startedAt: startedAt + 5 })
    )
    expect(next.current).toEqual(current)
    expect(next.sealedStartedAt).toBe(startedAt + 5)
  })

  it('replaces the view when a new job starts', () => {
    const current = view()
    const next = nextJobView(
      current,
      null,
      event({ job: 'summarize', stage: 'preparing', startedAt: startedAt + 10 })
    )
    expect(next.current).toEqual({
      id: 'rec',
      job: 'summarize',
      stage: 'preparing',
      label: 'Preparing',
      startedAt: startedAt + 10
    })
  })

  it('ignores an unknown job or a stage from the other job', () => {
    const current = view()
    const unknown = nextJobView(current, null, {
      id: 'rec',
      job: 'delete',
      stage: 'preparing',
      startedAt: startedAt + 1
    } as unknown as LibraryJobProgress)
    expect(unknown.current).toBe(current)
    const wrongStage = nextJobView(
      current,
      null,
      event({ job: 'summarize', stage: 'uploading', message: 'Nope', startedAt: startedAt + 2 })
    )
    expect(wrongStage.current).toBe(current)
  })
})

function view(): JobView {
  return {
    id: 'rec',
    job: 'transcribe',
    stage: 'waiting',
    label: 'Waiting for model',
    startedAt
  }
}
