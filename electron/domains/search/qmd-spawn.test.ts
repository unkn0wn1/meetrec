import { describe, expect, it } from 'vitest'
import { qmdQueryArgs, qmdUpdateArgs } from './argv'
import { qmdChildEnv } from './qmd-spawn'

describe('qmd child env', () => {
  it('keeps the cache under userData and forces CPU', () => {
    const env = qmdChildEnv('/tmp/meetrec-user', { PATH: '/usr/bin', HOME: '/home/ada' })
    expect(env.XDG_CACHE_HOME).toBe('/tmp/meetrec-user/qmd-home/cache')
    expect(env.XDG_CONFIG_HOME).toBe('/tmp/meetrec-user/qmd-home/config')
    expect(env.XDG_DATA_HOME).toBe('/tmp/meetrec-user/qmd-home/data')
    expect(env.QMD_LLAMA_GPU).toBe('false')
    expect(env.HOME).toBe('/home/ada')
    const argv = [...qmdUpdateArgs(), ...qmdQueryArgs('standup notes')]
    expect(argv.join(' ')).not.toContain('audio.mp3')
    expect(argv.join(' ')).not.toContain('audio.wav')
  })
})
