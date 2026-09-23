import { createServer, type Server } from 'node:http'

export interface LoopbackSession {
  redirectUri: string
  result: Promise<string>
  cancel: () => void
}

export function openLoopback(input: {
  expectedState: string
  timeoutMs: number
  publicHost: string
}): Promise<LoopbackSession> {
  return new Promise((resolve, reject) => {
    let settled = false
    let opened = false
    let resolveCode: (code: string) => void = () => undefined
    let rejectCode: (error: Error) => void = () => undefined
    const result = new Promise<string>((resolveResult, rejectResult) => {
      resolveCode = resolveResult
      rejectCode = rejectResult
    })
    // The caller awaits `result`. A rejection before that await must not crash the process.
    result.catch(() => undefined)

    const server: Server = createServer((request, response) => {
      if (settled) {
        response.statusCode = 404
        response.end('Ignored.')
        return
      }
      const url = new URL(request.url ?? '/', 'http://127.0.0.1')
      if (url.pathname !== '/callback') {
        response.statusCode = 404
        response.end('Not found.')
        return
      }
      const oauthError = url.searchParams.get('error')
      if (oauthError) {
        const code = safeErrorCode(oauthError)
        response.statusCode = 400
        response.setHeader('content-type', 'text/html; charset=utf-8')
        response.end(`<!DOCTYPE html><title>meetrec</title><p>Sign-in failed (${code}).</p>`)
        finishError(new Error(`Sign-in failed (${code}).`))
        return
      }
      const state = url.searchParams.get('state')
      const code = url.searchParams.get('code')
      if (!code || state !== input.expectedState) {
        response.statusCode = 400
        response.setHeader('content-type', 'text/html; charset=utf-8')
        response.end('<!DOCTYPE html><title>meetrec</title><p>Sign-in could not be confirmed.</p>')
        finishError(new Error('Sign-in state did not match.'))
        return
      }
      response.statusCode = 200
      response.setHeader('content-type', 'text/html; charset=utf-8')
      response.end(
        '<!DOCTYPE html><title>meetrec</title><p>meetrec is connected. You can close this tab.</p>'
      )
      finishCode(code)
    })

    const timer = setTimeout(() => {
      finishError(new Error('Sign-in timed out.'))
    }, input.timeoutMs)

    const finishCode = (code: string): void => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      server.close()
      resolveCode(code)
    }

    const finishError = (error: Error): void => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      server.close()
      rejectCode(error)
      if (!opened) reject(error)
    }

    server.on('error', (error) => {
      finishError(
        error instanceof Error ? error : new Error('Could not bind the sign-in redirect.')
      )
    })

    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      if (!address || typeof address === 'string') {
        finishError(new Error('Could not bind the sign-in redirect.'))
        return
      }
      opened = true
      resolve({
        redirectUri: `http://${input.publicHost}:${address.port}/callback`,
        result,
        cancel: () => {
          finishError(new Error('Sign-in cancelled.'))
        }
      })
    })
  })
}

function safeErrorCode(value: string): string {
  const cleaned = value.trim().slice(0, 64)
  return /^[A-Za-z0-9_]+$/.test(cleaned) ? cleaned : 'error'
}
