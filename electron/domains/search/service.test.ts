import { readFileSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { afterEach, describe, expect, it } from 'vitest'
import { qmdExportPath } from './paths'
import {
  cleanupSearchFixtures,
  HELP,
  id,
  otherId,
  seedRecording,
  setup,
  statusIs,
  tokenFor
} from './service-harness'
import { readSearchStatus, searchStatusPath, writeSearchStatus } from './status-file'

describe('search service', () => {
  afterEach(() => {
    cleanupSearchFixtures()
  })

  it('exports and indexes after a transcript when the checkbox is on', async () => {
    const harness = await setup({ enabled: true })
    harness.service.notifyTranscript(id)
    await harness.waitFor(() => statusIs(harness.recordings, id, 'indexed'))
    const markdown = await readFile(qmdExportPath(harness.userData, id), 'utf8')
    expect(markdown).toContain('[t=62.5] [01:02] Ada: hello there')
    expect(markdown).not.toContain('audio.mp3')
    expect(markdown).not.toContain('audio.wav')
    expect(harness.commands()).toContain('update')
    expect(harness.commands()).toContain('embed')
    expect(harness.calls.flatMap((call) => call.args).join(' ')).not.toContain('audio.mp3')
    expect((await readSearchStatus(searchStatusPath(harness.recordings, id))).state).toBe('indexed')
    harness.service.stop()
  })

  it('does nothing when search is off or the transcript checkbox is off', async () => {
    const off = await setup({ enabled: false })
    off.service.notifyTranscript(id)
    await off.settle()
    expect(off.calls).toHaveLength(0)
    await expect(readFile(qmdExportPath(off.userData, id))).rejects.toThrow()
    off.service.stop()

    const quiet = await setup({ enabled: true, indexAfterTranscript: false })
    quiet.service.notifyTranscript(id)
    await quiet.settle()
    expect(quiet.calls).toHaveLength(0)
    quiet.service.stop()
  })

  it('respects index after summary and still retries when both checkboxes are off', async () => {
    const summaryOff = await setup({ enabled: true, indexAfterSummary: false })
    summaryOff.service.notifySummary(id)
    await summaryOff.settle()
    expect(summaryOff.calls).toHaveLength(0)
    summaryOff.service.stop()

    const summaryOn = await setup({ enabled: true })
    summaryOn.service.notifySummary(id)
    await summaryOn.waitFor(
      () => summaryOn.commands().includes('embed') && summaryOn.inFlight === 0
    )
    expect(summaryOn.commands()).toContain('embed')
    summaryOn.service.stop()

    const manual = await setup({
      enabled: true,
      indexAfterTranscript: false,
      indexAfterSummary: false
    })
    await manual.service.retry(id)
    await manual.waitFor(() => manual.commands().includes('embed') && manual.inFlight === 0)
    expect(manual.commands()).toContain('embed')
    manual.service.stop()
  })

  it('runs one follow-up embed when the same id is notified again mid-run', async () => {
    const harness = await setup({ enabled: true, holdFirstEmbed: true })
    harness.service.notifyTranscript(id)
    await harness.waitFor(() => harness.commands().filter((name) => name === 'embed').length === 1)
    harness.service.notifyTranscript(id)
    harness.releaseEmbed({ code: 0, stdout: '', stderr: '', signal: null })
    await harness.waitFor(
      () =>
        harness.commands().filter((name) => name === 'embed').length === 2 && harness.inFlight === 0
    )
    expect(harness.maxInFlight).toBe(1)
    harness.service.stop()
  })

  it('waits to spawn qmd until recording has stopped', async () => {
    const harness = await setup({ enabled: true, recording: true })
    harness.service.notifyTranscript(id)
    await harness.settle()
    expect(harness.commands()).not.toContain('update')
    harness.recording = false
    harness.scheduled.shift()?.()
    await harness.waitFor(() => harness.commands().includes('update'))
    harness.service.stop()
  })

  it('marks the batch indexed or keeps a short stderr tail', async () => {
    const ok = await setup({ enabled: true })
    ok.service.notifyTranscript(id)
    await ok.waitFor(() => statusIs(ok.recordings, id, 'indexed'))
    ok.service.stop()

    const failed = await setup({
      enabled: true,
      embedCode: 1,
      embedStderr: `boom ${'x'.repeat(400)}`
    })
    failed.service.notifyTranscript(id)
    await failed.waitFor(() => statusIs(failed.recordings, id, 'error'))
    const status = await readSearchStatus(searchStatusPath(failed.recordings, id))
    expect(status.state).toBe('error')
    expect(status.error?.startsWith('boom')).toBe(true)
    expect(status.error?.length ?? 0).toBeLessThanOrEqual(200)
    failed.service.stop()
  })

  it('unlinks the export and enqueues an update when a recording is deleted', async () => {
    const harness = await setup({ enabled: true })
    await mkdir(qmdExportPath(harness.userData, id).replace(/[^/]+$/, ''), { recursive: true })
    await writeFile(qmdExportPath(harness.userData, id), 'gone\n')
    harness.service.notifyDelete(id)
    await harness.waitFor(() => harness.commands().includes('update'))
    await expect(readFile(qmdExportPath(harness.userData, id))).rejects.toThrow()
    expect(harness.service.snapshot().records[id]).toBeUndefined()
    harness.service.stop()
  })

  it('pulls models on enable, cancels without turning search off, and disables by killing the child', async () => {
    const pulled = await setup({ enabled: false, models: false })
    await pulled.service.enable()
    await pulled.waitFor(() => pulled.commands().includes('pull'))
    expect(pulled.service.snapshot().prefs.enabled).toBe(true)
    pulled.service.stop()

    const warmup = await setup({
      enabled: false,
      models: false,
      help: HELP.replace('qmd pull [--refresh] [--progress]\n', '')
    })
    await warmup.service.enable()
    await warmup.waitFor(
      () => warmup.commands().includes('embed') && warmup.commands().includes('query')
    )
    expect(warmup.commands()).not.toContain('pull')
    warmup.service.stop()

    const cancel = await setup({ enabled: false, models: false, holdPull: true })
    await cancel.service.enable()
    await cancel.waitFor(() => cancel.commands().includes('pull'))
    cancel.service.cancelDownload()
    await cancel.settle()
    expect(cancel.service.snapshot().prefs.enabled).toBe(true)
    expect(cancel.calls.some((call) => call.killed)).toBe(true)
    cancel.service.stop()

    const disabled = await setup({ enabled: false, models: false, holdPull: true })
    await disabled.service.enable()
    await disabled.waitFor(() => disabled.commands().includes('pull'))
    await disabled.service.disable()
    expect(disabled.service.snapshot().prefs.enabled).toBe(false)
    expect(disabled.calls.some((call) => call.killed)).toBe(true)
    disabled.service.stop()
  })

  it('resumes pending sidecars on launch and leaves a fresh indexed sidecar alone', async () => {
    const harness = await setup({ enabled: true, models: true })
    await seedRecording(harness.recordings, otherId)
    const token = tokenFor(harness.recordings, otherId)
    await writeSearchStatus(searchStatusPath(harness.recordings, otherId), {
      state: 'indexed',
      error: null,
      updatedAt: '2026-09-25T12:00:00.000Z',
      sourceToken: token
    })
    await writeSearchStatus(searchStatusPath(harness.recordings, id), {
      state: 'pending',
      error: null,
      updatedAt: '2026-09-25T12:00:00.000Z',
      sourceToken: 'stale'
    })
    const before = readFileSync(searchStatusPath(harness.recordings, otherId), 'utf8')
    await harness.service.start()
    await harness.waitFor(() => harness.commands().includes('embed') && harness.inFlight === 0)
    expect(readFileSync(searchStatusPath(harness.recordings, otherId), 'utf8')).toBe(before)
    expect((await readSearchStatus(searchStatusPath(harness.recordings, id))).state).toBe('indexed')
    harness.service.stop()
  })
})
