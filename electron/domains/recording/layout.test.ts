import { describe, expect, it } from 'vitest'
import { idFromFlatWav, recordingLayout, startedAtFromRecordingId } from './layout'

describe('recording layout', () => {
  it('places audio, meta, transcript, and summary inside the id folder', () => {
    const layout = recordingLayout('/data/recordings', '2026-09-22T12-00-00-000Z-abc123')
    expect(layout.dir).toBe('/data/recordings/2026-09-22T12-00-00-000Z-abc123')
    expect(layout.audioPath).toBe('/data/recordings/2026-09-22T12-00-00-000Z-abc123/audio.wav')
    expect(layout.metaPath.endsWith('/meta.json')).toBe(true)
    expect(layout.transcriptPath.endsWith('/transcript.json')).toBe(true)
    expect(layout.summaryPath.endsWith('/summary.md')).toBe(true)
  })

  it('reads an id from a flat wav name and ignores other files', () => {
    expect(idFromFlatWav('2026-09-22T12-00-00-000Z-abc123.wav')).toBe(
      '2026-09-22T12-00-00-000Z-abc123'
    )
    expect(idFromFlatWav('notes.txt')).toBeNull()
    expect(idFromFlatWav('.wav')).toBeNull()
  })

  it('recovers the start time encoded in a recording id', () => {
    expect(startedAtFromRecordingId('2026-09-22T13-58-02-629Z-ec02af')).toBe(
      '2026-09-22T13:58:02.629Z'
    )
    expect(startedAtFromRecordingId('not-a-stamp')).toBeNull()
  })
})
