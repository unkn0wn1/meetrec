import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { emptyMeta } from '../recording/meta'
import { writeMeta } from '../recording/store'
import { defaultAppSettings, writeAppSettings } from '../settings/settings-file'
import type { MeetingSearchPrefs } from '../settings/meeting-search-prefs'
import { sourceToken } from './export-md'
import { qmdJsEntryPath, qmdModelDir, qmdPackageJsonPath, qmdRuntimePath } from './paths'
import type { CommandResult, CommandRunner } from './qmd-spawn'
import { createSearchService, type SearchService } from './service'
import { searchStatusPath } from './status-file'

export const HELP = [
  'qmd pull [--refresh] [--progress]',
  'qmd collection add/list/remove',
  'qmd update',
  'qmd embed',
  'qmd doctor',
  'qmd query --format json'
].join('\n')

export const id = '2026-09-25T15-04-05-000Z'
export const otherId = '2026-09-25T16-04-05-000Z'

const dirs: string[] = []

export function cleanupSearchFixtures(): void {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
}

export interface SearchHarness {
  service: SearchService
  userData: string
  recordings: string
  calls: { args: string[]; killed: boolean }[]
  commands: () => string[]
  settle: () => Promise<void>
  waitFor: (ready: () => boolean) => Promise<void>
  scheduled: Array<() => void>
  recording: boolean
  inFlight: number
  maxInFlight: number
  releaseEmbed: (result: CommandResult) => void
}

export function statusIs(recordings: string, recordingId: string, state: string): boolean {
  try {
    return readFileSync(searchStatusPath(recordings, recordingId), 'utf8').includes(
      `"state": "${state}"`
    )
  } catch {
    return false
  }
}

export function tokenFor(recordings: string, recordingId: string): string {
  const transcript = statSync(join(recordings, recordingId, 'transcript.json'))
  return sourceToken({
    transcriptMtimeMs: transcript.mtimeMs,
    transcriptSize: transcript.size,
    summaryMtimeMs: null,
    summarySize: null,
    speakerNames: ['Ada']
  })
}

export async function seedRecording(recordings: string, recordingId: string): Promise<void> {
  const meta = emptyMeta({
    id: recordingId,
    startedAt: '2026-09-25T15:04:05.000Z',
    title: 'Standup'
  })
  meta.speakers = [{ id: 'speaker-1', label: 'Speaker 1', name: 'Ada' }]
  await writeMeta(recordings, meta)
  await writeFile(
    join(recordings, recordingId, 'transcript.json'),
    JSON.stringify({
      text: 'hello there',
      language: 'en',
      durationSec: 70,
      words: [],
      segments: [
        {
          speakerId: 'speaker-1',
          speakerLabel: 'Speaker 1',
          start: 62.5,
          end: 64,
          text: 'hello there'
        }
      ],
      model: 'test',
      createdAt: '2026-09-25T15:05:00.000Z'
    })
  )
}

export async function setup(options: {
  enabled: boolean
  indexAfterTranscript?: boolean
  indexAfterSummary?: boolean
  models?: boolean
  recording?: boolean
  holdFirstEmbed?: boolean
  holdPull?: boolean
  embedCode?: number
  embedStderr?: string
  help?: string
}): Promise<SearchHarness> {
  const root = mkdtempSync(join(tmpdir(), 'meetrec-search-'))
  dirs.push(root)
  const userData = join(root, 'user')
  const recordings = join(root, 'recordings')
  mkdirSync(userData, { recursive: true })
  mkdirSync(recordings, { recursive: true })
  const nodePath = join(userData, 'node')
  writeFileSync(nodePath, '')
  mkdirSync(join(qmdJsEntryPath(userData), '..'), { recursive: true })
  writeFileSync(qmdJsEntryPath(userData), '// qmd\n')
  writeFileSync(qmdPackageJsonPath(userData), `${JSON.stringify({ version: '2.8.3' })}\n`)
  writeFileSync(qmdRuntimePath(userData), `${JSON.stringify({ nodePath })}\n`)
  if (options.models !== false) {
    mkdirSync(qmdModelDir(userData), { recursive: true })
    for (const name of [
      'embeddinggemma-300M-Q8_0.gguf',
      'qwen3-reranker-0.6b-q8_0.gguf',
      'qmd-query-expansion-1.7B-q4_k_m.gguf'
    ]) {
      writeFileSync(join(qmdModelDir(userData), name), 'gguf')
    }
  }
  const prefs: MeetingSearchPrefs = {
    enabled: options.enabled,
    indexAfterTranscript: options.indexAfterTranscript ?? true,
    indexAfterSummary: options.indexAfterSummary ?? true,
    idleCatchUp: false
  }
  await writeAppSettings(userData, { ...defaultAppSettings(), meetingSearch: prefs })
  await seedRecording(recordings, id)
  const calls: SearchHarness['calls'] = []
  const scheduled: Array<() => void> = []
  let recording = options.recording === true
  let inFlight = 0
  let maxInFlight = 0
  let embeds = 0
  let releaseEmbed: (result: CommandResult) => void = () => {}
  const help = options.help ?? HELP
  const run: CommandRunner = (spec) => {
    const call = { args: spec.args, killed: false }
    calls.push(call)
    inFlight += 1
    maxInFlight = Math.max(maxInFlight, inFlight)
    let resolveResult: (result: CommandResult) => void = () => {}
    const result = new Promise<CommandResult>((resolve) => {
      resolveResult = resolve
    })
    const finish = (value: CommandResult): void => {
      inFlight -= 1
      resolveResult(value)
    }
    const args = qmdArgs(spec.args)
    const heldEmbed = args[0] === 'embed' && options.holdFirstEmbed === true && embeds === 0
    if (args[0] === 'embed') embeds += 1
    if (args[0] === 'pull' && options.holdPull === true) {
      releaseEmbed = () => finish({ code: null, stdout: '', stderr: '', signal: 'SIGTERM' })
    } else if (heldEmbed) {
      releaseEmbed = finish
    } else {
      finish(answer(args, help, options.embedCode ?? 0, options.embedStderr ?? ''))
    }
    return {
      result,
      kill() {
        call.killed = true
        finish({ code: null, stdout: '', stderr: '', signal: 'SIGTERM' })
      }
    }
  }
  const service = createSearchService({
    userDataDir: userData,
    recordingsDir: recordings,
    isRecording: () => recording,
    run,
    lookup: async (name) => (name === 'qmd' ? null : nodePath),
    probeNode: async () => ({ ok: true, major: 22 }),
    schedule: (fn) => {
      scheduled.push(fn)
      return () => {}
    }
  })
  return {
    service,
    userData,
    recordings,
    calls,
    commands: () => calls.map((call) => qmdArgs(call.args)[0] ?? ''),
    settle: async () => {
      for (let i = 0; i < 40; i += 1) await new Promise((resolve) => setImmediate(resolve))
    },
    waitFor: async (ready) => {
      const started = Date.now()
      while (!ready()) {
        if (Date.now() - started > 3000) {
          throw new Error(
            `timed out waiting; commands=${calls.map((call) => qmdArgs(call.args).join(' ')).join(' | ')}`
          )
        }
        await new Promise((resolve) => setTimeout(resolve, 10))
      }
    },
    scheduled,
    get recording() {
      return recording
    },
    set recording(value: boolean) {
      recording = value
    },
    get inFlight() {
      return inFlight
    },
    get maxInFlight() {
      return maxInFlight
    },
    get releaseEmbed() {
      return releaseEmbed
    }
  }
}

function qmdArgs(args: string[]): string[] {
  const entry = args.findIndex((arg) => arg.endsWith('qmd.js'))
  return entry >= 0 ? args.slice(entry + 1) : args
}

function answer(
  args: string[],
  help: string,
  embedCode: number,
  embedStderr: string
): CommandResult {
  if (args[0] === '--help') return { code: 0, stdout: help, stderr: '', signal: null }
  if (args[0] === 'doctor') return { code: 0, stdout: 'ok', stderr: '', signal: null }
  if (args[0] === 'query') return { code: 0, stdout: '[]', stderr: '', signal: null }
  if (args[0] === 'embed') return { code: embedCode, stdout: '', stderr: embedStderr, signal: null }
  if (args[0] === 'collection') {
    return { code: 0, stdout: 'meetings (qmd://meetings/)\n', stderr: '', signal: null }
  }
  return { code: 0, stdout: '', stderr: '', signal: null }
}
