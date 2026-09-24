import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, isAbsolute, join, relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  STT_UPLOAD_MAX_BYTES,
  needsSttSplit,
  parseSegmentList,
  splitPreparedMp3,
  sttBytesPerSecond,
  sttSegmentArgs,
  sttSegmentSeconds,
  transcribeChunks
} from './stt-chunk'

const SPLIT_FAILURE = 'Could not split the recording for speech-to-text.'

describe('STT upload threshold', () => {
  it('keeps a 24 MB file whole and splits the next byte', () => {
    expect(needsSttSplit(24_000_000)).toBe(false)
    expect(needsSttSplit(STT_UPLOAD_MAX_BYTES)).toBe(false)
    expect(needsSttSplit(24_000_001)).toBe(true)
  })

  it('plans 3666 second pieces at 48 kbps', () => {
    expect(sttBytesPerSecond('48k')).toBe(6000)
    expect(sttSegmentSeconds()).toBe(3666)
  })
})

describe('sttSegmentArgs', () => {
  it('stream-copies the prepared MP3 into a csv segment list', () => {
    expect(sttSegmentArgs('/tmp/in.mp3', '/tmp/chunks.csv', '/tmp/chunk-%03d.mp3', 3666)).toEqual([
      '-hide_banner',
      '-y',
      '-i',
      '/tmp/in.mp3',
      '-map',
      '0:a:0',
      '-f',
      'segment',
      '-segment_time',
      '3666',
      '-reset_timestamps',
      '1',
      '-segment_list',
      '/tmp/chunks.csv',
      '-segment_list_type',
      'csv',
      '-c',
      'copy',
      '/tmp/chunk-%03d.mp3'
    ])
  })
})

describe('parseSegmentList', () => {
  it('reads filename,start,end and sorts by start', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'meetrec-stt-list-'))
    try {
      const rows = parseSegmentList(
        'chunk-001.mp3,10.000000,20.000000\n\nchunk-000.mp3,0.000000,1.044000\n',
        dir
      )
      expect(rows.map((row) => row.start)).toEqual([0, 10])
      expect(rows[0]).toEqual({
        path: resolve(dir, 'chunk-000.mp3'),
        fileName: 'chunk-000.mp3',
        start: 0,
        end: 1.044
      })
      expect(rows[1]?.fileName).toBe('chunk-001.mp3')
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('keeps an absolute name only when it stays inside the temp dir', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'meetrec-stt-list-'))
    try {
      const inside = resolve(dir, 'chunk-000.mp3')
      expect(parseSegmentList(`${inside},0.000000,1.044000`, dir)[0]?.path).toBe(inside)
      expect(() => parseSegmentList('/etc/passwd,0.000000,1.000000', dir)).toThrow(SPLIT_FAILURE)
      expect(() => parseSegmentList('../outside.mp3,0.000000,1.000000', dir)).toThrow(SPLIT_FAILURE)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('rejects an empty list', () => {
    expect(() => parseSegmentList('', '/tmp/meetrec-stt')).toThrow(SPLIT_FAILURE)
    expect(() => parseSegmentList('\n  \n', '/tmp/meetrec-stt')).toThrow(SPLIT_FAILURE)
  })
})

describe('splitPreparedMp3', () => {
  it('returns csv offsets for files inside the prepared directory', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'meetrec-stt-split-'))
    const prepared = join(dir, 'audio.mp3')
    await writeFile(prepared, Buffer.from('mp3'))
    const seen: string[][] = []
    try {
      const result = await splitPreparedMp3(prepared, {
        resolveFfmpeg: async () => 'ffmpeg',
        runFfmpeg: async (_ffmpeg, args) => {
          seen.push(args)
          await writeSplitFixture(args)
        }
      })
      expect(seen).toEqual([
        sttSegmentArgs(prepared, join(dir, 'chunks.csv'), join(dir, 'chunk-%03d.mp3'), 3666)
      ])
      expect(result.chunks.map((chunk) => chunk.offsetSec)).toEqual([0, 10.5])
      expect(result.chunks.map((chunk) => chunk.fileName)).toEqual([
        'chunk-000.mp3',
        'chunk-001.mp3'
      ])
      expect(result.timelineEndSec).toBe(20)
      const root = resolve(dir)
      for (const chunk of result.chunks) {
        const rel = relative(root, chunk.path)
        expect(rel.startsWith('..')).toBe(false)
        expect(isAbsolute(rel)).toBe(false)
        expect(dirname(chunk.path)).toBe(root)
      }
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('throws before any upload when a piece is still over the limit', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'meetrec-stt-split-'))
    const prepared = join(dir, 'audio.mp3')
    await writeFile(prepared, Buffer.from('mp3'))
    let posted = false
    try {
      await expect(async () => {
        const split = await splitPreparedMp3(prepared, {
          resolveFfmpeg: async () => 'ffmpeg',
          runFfmpeg: async (_ffmpeg, args) => {
            await writeSplitFixture(args)
          },
          stat: async () => ({ size: STT_UPLOAD_MAX_BYTES + 1 })
        })
        await transcribeChunks({
          chunks: split.chunks,
          model: 'm',
          createdAt: '2026-09-25T00:00:00.000Z',
          timelineEndSec: split.timelineEndSec,
          post: async () => {
            posted = true
            return {}
          },
          toPiece: () => ({ text: '', language: null, segments: [], words: [] })
        })
      }).rejects.toThrow('A split piece is still over the 24 MB upload limit.')
      expect(posted).toBe(false)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})

async function writeSplitFixture(args: string[]): Promise<void> {
  const listFlag = args.indexOf('-segment_list')
  const listPath = args[listFlag + 1]
  if (!listPath) throw new Error('missing segment list')
  const dir = dirname(listPath)
  await writeFile(join(dir, 'chunk-000.mp3'), Buffer.alloc(0))
  await writeFile(join(dir, 'chunk-001.mp3'), Buffer.alloc(0))
  await writeFile(
    listPath,
    'chunk-001.mp3,10.500000,20.000000\n\nchunk-000.mp3,0.000000,10.500000\n'
  )
}
