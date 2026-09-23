import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { bundledFfmpegPath, ffmpegFileName, resolveFfmpegBinary } from './ffmpeg-binary'

describe('resolveFfmpegBinary', () => {
  it('returns the bundled linux binary when that file exists', async () => {
    const resourcesPath = join('/app', 'resources')
    const bundled = bundledFfmpegPath(resourcesPath, 'linux')
    const resolved = await resolveFfmpegBinary({
      resourcesPath,
      platform: 'linux',
      exists: async (path) => path === bundled,
      lookupPath: async () => {
        throw new Error('PATH lookup should not run')
      }
    })
    expect(resolved).toBe(bundled)
    expect(ffmpegFileName('linux')).toBe('ffmpeg')
  })

  it('returns the bundled Windows exe when that file exists', async () => {
    const resourcesPath = join('/app', 'resources')
    const bundled = bundledFfmpegPath(resourcesPath, 'win32')
    const resolved = await resolveFfmpegBinary({
      resourcesPath,
      platform: 'win32',
      exists: async (path) => path === bundled,
      lookupPath: async () => null
    })
    expect(resolved).toBe(bundled)
    expect(resolved.endsWith(`${join('ffmpeg', 'ffmpeg.exe')}`)).toBe(true)
  })

  it('uses PATH when the bundled file is absent', async () => {
    const resolved = await resolveFfmpegBinary({
      resourcesPath: join('/app', 'resources'),
      platform: 'linux',
      exists: async () => false,
      lookupPath: async (command) => (command === 'ffmpeg' ? '/usr/bin/ffmpeg' : null)
    })
    expect(resolved).toBe('/usr/bin/ffmpeg')
  })

  it('tries ffmpeg.exe and then ffmpeg on Windows PATH', async () => {
    const seen: string[] = []
    const resolved = await resolveFfmpegBinary({
      resourcesPath: join('/app', 'resources'),
      platform: 'win32',
      exists: async () => false,
      lookupPath: async (command) => {
        seen.push(command)
        return command === 'ffmpeg' ? 'C:\\Tools\\ffmpeg.exe' : null
      }
    })
    expect(seen).toEqual(['ffmpeg.exe', 'ffmpeg'])
    expect(resolved).toBe('C:\\Tools\\ffmpeg.exe')
  })

  it('throws when the bundle and PATH are both missing', async () => {
    await expect(
      resolveFfmpegBinary({
        resourcesPath: join('/app', 'resources'),
        platform: 'linux',
        exists: async () => false,
        lookupPath: async () => null
      })
    ).rejects.toThrow(/resources\/ffmpeg/)
  })
})
