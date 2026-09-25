import { spawn, type ChildProcess } from 'node:child_process'
import { parse } from 'node:path'
import { qmdCacheDir, qmdConfigDir, qmdDataDir } from './paths'

export interface CommandSpec {
  command: string
  args: string[]
  env: NodeJS.ProcessEnv
  cwd: string
}

export interface CommandResult {
  code: number | null
  stdout: string
  stderr: string
  signal: NodeJS.Signals | null
}

export interface CommandHandlers {
  onStdout: (chunk: string) => void
  onStderr: (chunk: string) => void
}

export interface CommandChild {
  result: Promise<CommandResult>
  kill: () => void
}

export type CommandRunner = (spec: CommandSpec, handlers: CommandHandlers) => CommandChild

/** qmd 2.8.3 reads XDG_CACHE_HOME before the user profile, including on Windows. */
export function qmdChildEnv(
  userDataDir: string,
  base: NodeJS.ProcessEnv = process.env
): NodeJS.ProcessEnv {
  return {
    ...base,
    XDG_CACHE_HOME: qmdCacheDir(userDataDir),
    XDG_CONFIG_HOME: qmdConfigDir(userDataDir),
    XDG_DATA_HOME: qmdDataDir(userDataDir),
    QMD_LLAMA_GPU: 'false'
  }
}

/** Drive root so a parent `.qmd` project index is not adopted. */
export function qmdChildCwd(userDataDir: string): string {
  return parse(userDataDir).root
}

export function spawnCommand(spec: CommandSpec, handlers: CommandHandlers): CommandChild {
  const launched = commandForPlatform(spec.command, spec.args, process.platform)
  const child = spawn(launched.command, launched.args, {
    cwd: spec.cwd,
    env: spec.env,
    shell: false,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe']
  })
  return trackChild(child, handlers)
}

function commandForPlatform(
  command: string,
  args: string[],
  platform: NodeJS.Platform
): { command: string; args: string[] } {
  if (platform === 'win32' && /\.(cmd|bat)$/i.test(command)) {
    return {
      command: process.env.ComSpec || 'cmd.exe',
      args: ['/d', '/s', '/c', command, ...args]
    }
  }
  return { command, args }
}

function trackChild(child: ChildProcess, handlers: CommandHandlers): CommandChild {
  let stdout = ''
  let stderr = ''
  let killTimer: ReturnType<typeof setTimeout> | null = null
  child.stdout?.on('data', (chunk: Buffer) => {
    const text = chunk.toString('utf8')
    stdout += text
    handlers.onStdout(text)
  })
  child.stderr?.on('data', (chunk: Buffer) => {
    const text = chunk.toString('utf8')
    stderr += text
    handlers.onStderr(text)
  })
  const result = new Promise<CommandResult>((resolve) => {
    child.once('error', (error) => {
      resolve({ code: 1, stdout, stderr: `${stderr} ${error.message}`.trim(), signal: null })
    })
    child.once('exit', (code, signal) => {
      if (killTimer) clearTimeout(killTimer)
      resolve({ code, stdout, stderr, signal })
    })
  })
  return {
    result,
    kill() {
      if (process.platform === 'win32' && child.pid) {
        spawn('taskkill', ['/pid', String(child.pid), '/t', '/f'], {
          shell: false,
          windowsHide: true,
          stdio: 'ignore'
        })
        return
      }
      child.kill('SIGTERM')
      killTimer = setTimeout(() => {
        child.kill('SIGKILL')
      }, 2000)
      killTimer.unref?.()
    }
  }
}
