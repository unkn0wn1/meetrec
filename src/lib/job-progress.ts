import { formatDuration } from '../../electron/capture/duration'
import {
  SUMMARIZE_STAGES,
  TRANSCRIBE_STAGES,
  type LibraryJobKind,
  type LibraryJobProgress,
  type SummarizeStage,
  type TranscribeStage
} from '../../electron/shared/ipc-contract'

const TRANSCRIBE_LABELS: Record<TranscribeStage, string> = {
  preparing: 'Preparing audio',
  uploading: 'Uploading',
  waiting: 'Waiting for model',
  saving: 'Saving'
}

const SUMMARIZE_LABELS: Record<SummarizeStage, string> = {
  preparing: 'Preparing',
  waiting: 'Waiting for model',
  saving: 'Saving'
}

export interface JobView {
  id: string
  job: LibraryJobKind
  stage: TranscribeStage | SummarizeStage
  label: string
  startedAt: number
}

export function stageLabel(job: LibraryJobKind, stage: string): string | null {
  if (job === 'transcribe' && isTranscribeStage(stage)) return TRANSCRIBE_LABELS[stage]
  if (job === 'summarize' && isSummarizeStage(stage)) return SUMMARIZE_LABELS[stage]
  return null
}

export function progressLabel(job: LibraryJobKind, stage: string, message?: string): string | null {
  const fallback = stageLabel(job, stage)
  if (fallback === null) return null
  if (typeof message === 'string' && message.trim() !== '') return message
  return fallback
}

export function elapsedLabel(startedAt: number, now: number): string {
  if (!Number.isFinite(startedAt) || !Number.isFinite(now)) return '00:00'
  return formatDuration(now - startedAt)
}

export function nextJobView(
  current: JobView | null,
  sealedStartedAt: number | null,
  event: LibraryJobProgress
): { current: JobView | null; sealedStartedAt: number | null } {
  if (!isJobKind(event.job)) return { current, sealedStartedAt }
  if (typeof event.id !== 'string' || event.id.length === 0 || !Number.isFinite(event.startedAt)) {
    return { current, sealedStartedAt }
  }
  if (event.stage === null) {
    const matches =
      current !== null && current.id === event.id && current.startedAt === event.startedAt
    return {
      current: matches ? null : current,
      sealedStartedAt: event.startedAt
    }
  }
  if (event.startedAt === sealedStartedAt) return { current, sealedStartedAt }
  const label = progressLabel(event.job, event.stage, event.message)
  if (label === null || !isStageForJob(event.job, event.stage)) {
    return { current, sealedStartedAt }
  }
  return {
    current: {
      id: event.id,
      job: event.job,
      stage: event.stage,
      label,
      startedAt: event.startedAt
    },
    sealedStartedAt
  }
}

function isJobKind(job: string): job is LibraryJobKind {
  return job === 'transcribe' || job === 'summarize'
}

function isTranscribeStage(stage: string): stage is TranscribeStage {
  return TRANSCRIBE_STAGES.some((item) => item === stage)
}

function isSummarizeStage(stage: string): stage is SummarizeStage {
  return SUMMARIZE_STAGES.some((item) => item === stage)
}

function isStageForJob(
  job: LibraryJobKind,
  stage: string
): stage is TranscribeStage | SummarizeStage {
  return stageLabel(job, stage) !== null
}
