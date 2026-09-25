import { join } from 'node:path'

export function qmdCliDir(userDataDir: string): string {
  return join(userDataDir, 'qmd-cli')
}

export function qmdHomeDir(userDataDir: string): string {
  return join(userDataDir, 'qmd-home')
}

export function qmdCacheDir(userDataDir: string): string {
  return join(qmdHomeDir(userDataDir), 'cache')
}

export function qmdConfigDir(userDataDir: string): string {
  return join(qmdHomeDir(userDataDir), 'config')
}

export function qmdDataDir(userDataDir: string): string {
  return join(qmdHomeDir(userDataDir), 'data')
}

/** qmd 2.8.3 stores GGUFs at `$XDG_CACHE_HOME/qmd/models`. */
export function qmdModelDir(userDataDir: string): string {
  return join(qmdCacheDir(userDataDir), 'qmd', 'models')
}

/** Default index database when no project-local `.qmd` is adopted. */
export function qmdIndexDbPath(userDataDir: string): string {
  return join(qmdCacheDir(userDataDir), 'qmd', 'index.sqlite')
}

export function qmdExportDir(userDataDir: string): string {
  return join(userDataDir, 'qmd-export', 'meetings')
}

export function qmdExportPath(userDataDir: string, id: string): string {
  return join(qmdExportDir(userDataDir), `${id}.md`)
}

export function qmdRuntimePath(userDataDir: string): string {
  return join(qmdCliDir(userDataDir), 'runtime.json')
}

export function qmdPackageJsonPath(userDataDir: string): string {
  return join(qmdCliDir(userDataDir), 'node_modules', '@tobilu', 'qmd', 'package.json')
}

export function qmdJsEntryPath(userDataDir: string): string {
  return join(qmdCliDir(userDataDir), 'node_modules', '@tobilu', 'qmd', 'dist', 'cli', 'qmd.js')
}

export function qmdCatchUpPath(userDataDir: string): string {
  return join(qmdHomeDir(userDataDir), 'catchup.json')
}
