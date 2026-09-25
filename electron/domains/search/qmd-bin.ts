import { existsSync, readFileSync } from 'node:fs'
import { qmdJsEntryPath, qmdPackageJsonPath, qmdRuntimePath } from './paths'

/** Exact pin from `npm view @tobilu/qmd version` on 2026-09-25. Not a range. */
export const QMD_PACKAGE_VERSION = '2.8.3'
export const QMD_PACKAGE_SPEC = `@tobilu/qmd@${QMD_PACKAGE_VERSION}`
/** `@tobilu/qmd@2.8.3` declares `engines.node` `>=22.0.0`. */
export const QMD_NODE_MAJOR = 22

export interface InstalledQmd {
  nodePath: string
  jsPath: string
}

export type QmdLaunch =
  | { kind: 'js'; nodePath: string; jsPath: string }
  | { kind: 'path'; command: string }
  | { kind: 'missing' }

export function npmInstallArgs(prefix: string): string[] {
  return ['install', '--prefix', prefix, '--no-fund', '--no-audit', QMD_PACKAGE_SPEC]
}

export function resolveQmdLaunch(input: {
  installed: InstalledQmd | null
  pathQmd: string | null
  electronExecPath: string
}): QmdLaunch {
  const installed = input.installed
  if (
    installed &&
    installed.nodePath &&
    installed.jsPath &&
    installed.nodePath !== input.electronExecPath
  ) {
    return { kind: 'js', nodePath: installed.nodePath, jsPath: installed.jsPath }
  }
  if (input.pathQmd && input.pathQmd !== input.electronExecPath) {
    return { kind: 'path', command: input.pathQmd }
  }
  return { kind: 'missing' }
}

export function readInstalledQmd(userDataDir: string): InstalledQmd | null {
  const jsPath = qmdJsEntryPath(userDataDir)
  if (!existsSync(jsPath)) return null
  if (readInstalledVersion(userDataDir) !== QMD_PACKAGE_VERSION) return null
  const nodePath = readRuntimeNode(userDataDir)
  if (!nodePath || !existsSync(nodePath)) return null
  return { nodePath, jsPath }
}

export function readInstalledVersion(userDataDir: string): string | null {
  try {
    const raw = readFileSync(qmdPackageJsonPath(userDataDir), 'utf8')
    const parsed = JSON.parse(raw) as { version?: unknown }
    return typeof parsed.version === 'string' ? parsed.version : null
  } catch {
    return null
  }
}

export function readRuntimeNode(userDataDir: string): string | null {
  try {
    const raw = readFileSync(qmdRuntimePath(userDataDir), 'utf8')
    const parsed = JSON.parse(raw) as { nodePath?: unknown }
    return typeof parsed.nodePath === 'string' && parsed.nodePath.trim() ? parsed.nodePath : null
  } catch {
    return null
  }
}

export function nodeMajor(version: string): number | null {
  const major = Number.parseInt(version.split('.')[0] ?? '', 10)
  return Number.isFinite(major) ? major : null
}

export function nodeProbeAccepts(input: {
  nodePath: string
  electronExecPath: string
  versionsNode: string | null
  versionsElectron: string | null
}): { ok: boolean; major: number | null } {
  if (!input.nodePath || input.nodePath === input.electronExecPath) {
    return { ok: false, major: null }
  }
  if (input.versionsElectron) return { ok: false, major: null }
  const major = input.versionsNode ? nodeMajor(input.versionsNode) : null
  if (major === null || major < QMD_NODE_MAJOR) return { ok: false, major }
  return { ok: true, major }
}
