import { describe, expect, it } from 'vitest'
import { modelsReadyOnDisk, parseDownloadPercent, pollModelGrowth } from './models'

describe('qmd model files', () => {
  it('is ready when each marker file is non-empty', () => {
    expect(
      modelsReadyOnDisk([
        { name: 'embeddinggemma-300M-Q8_0.gguf', size: 10 },
        { name: 'qwen3-reranker-0.6b-q8_0.gguf', size: 10 },
        { name: 'qmd-query-expansion-1.7B-q4_k_m.gguf', size: 10 }
      ])
    ).toBe(true)
  })

  it('is not ready when a marker file is empty', () => {
    expect(
      modelsReadyOnDisk([
        { name: 'embeddinggemma-300M-Q8_0.gguf', size: 10 },
        { name: 'qwen3-reranker-0.6b-q8_0.gguf', size: 0 },
        { name: 'qmd-query-expansion-1.7B-q4_k_m.gguf', size: 10 }
      ])
    ).toBe(false)
  })

  it('reports the newest growing file and the byte sum', () => {
    const previous = new Map<string, number>([
      ['embeddinggemma-300M-Q8_0.gguf', 100],
      ['qwen3-reranker-0.6b-q8_0.gguf', 50],
      ['notes.txt', 4]
    ])
    const progress = pollModelGrowth(previous, [
      { name: 'embeddinggemma-300M-Q8_0.gguf', size: 150, mtimeMs: 10 },
      { name: 'qwen3-reranker-0.6b-q8_0.gguf', size: 80, mtimeMs: 20 },
      { name: 'notes.txt', size: 4, mtimeMs: 30 }
    ])
    expect(progress.label).toBe('qwen3-reranker-0.6b-q8_0.gguf')
    expect(progress.bytes).toBe(234)
  })

  it('reads a percent only from a current/total pair', () => {
    expect(parseDownloadPercent('fetching model')).toBeNull()
    expect(parseDownloadPercent('embeddinggemma 30/100')).toBe(30)
  })
})
