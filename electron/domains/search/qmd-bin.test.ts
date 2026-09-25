import { describe, expect, it } from 'vitest'
import { npmInstallArgs, QMD_PACKAGE_SPEC, resolveQmdLaunch } from './qmd-bin'

const electron = '/usr/lib/meetrec/meetrec'

describe('qmd launch resolution', () => {
  it('prefers the stored runtime node and the installed JS entry', () => {
    const launch = resolveQmdLaunch({
      installed: { nodePath: '/usr/bin/node', jsPath: '/data/qmd-cli/qmd.js' },
      pathQmd: '/usr/local/bin/qmd',
      electronExecPath: electron
    })
    expect(launch).toEqual({
      kind: 'js',
      nodePath: '/usr/bin/node',
      jsPath: '/data/qmd-cli/qmd.js'
    })
  })

  it('rejects Electron’s execPath and falls back to qmd on PATH', () => {
    const launch = resolveQmdLaunch({
      installed: { nodePath: electron, jsPath: '/data/qmd-cli/qmd.js' },
      pathQmd: '/usr/local/bin/qmd',
      electronExecPath: electron
    })
    expect(launch).toEqual({ kind: 'path', command: '/usr/local/bin/qmd' })
  })

  it('uses PATH qmd when nothing is installed under userData', () => {
    const launch = resolveQmdLaunch({
      installed: null,
      pathQmd: '/usr/local/bin/qmd',
      electronExecPath: electron
    })
    expect(launch).toEqual({ kind: 'path', command: '/usr/local/bin/qmd' })
  })

  it('needs a runtime when Electron is the only node and qmd is absent', () => {
    const launch = resolveQmdLaunch({
      installed: { nodePath: electron, jsPath: '/data/qmd.js' },
      pathQmd: null,
      electronExecPath: electron
    })
    expect(launch.kind).toBe('missing')
  })

  it('pins the npm install to the exact package and a prefix', () => {
    const args = npmInstallArgs('/tmp/meetrec/qmd-cli')
    expect(args).toContain('--prefix')
    expect(args).toContain('/tmp/meetrec/qmd-cli')
    expect(args).toContain(QMD_PACKAGE_SPEC)
    expect(args.join(' ')).not.toContain('latest')
    expect(QMD_PACKAGE_SPEC).toBe('@tobilu/qmd@2.8.3')
  })
})
