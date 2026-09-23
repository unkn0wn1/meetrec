import { connect } from 'node:net'
import { describe, expect, it } from 'vitest'
import { openLoopback } from './loopback'

describe('loopback', () => {
  it('binds 127.0.0.1 and returns the code when state matches', async () => {
    const session = await openLoopback({
      expectedState: 'good-state',
      timeoutMs: 2000,
      publicHost: '127.0.0.1'
    })
    try {
      expect(session.redirectUri.startsWith('http://127.0.0.1:')).toBe(true)
      const response = await fetch(`${session.redirectUri}?code=abc&state=good-state`)
      expect(response.status).toBe(200)
      expect(await response.text()).toContain('meetrec is connected. You can close this tab.')
      await expect(session.result).resolves.toBe('abc')
    } finally {
      session.cancel()
    }
  })

  it('rejects a bad state and does not yield the code', async () => {
    const session = await openLoopback({
      expectedState: 'expected',
      timeoutMs: 2000,
      publicHost: '127.0.0.1'
    })
    try {
      const response = await fetch(`${session.redirectUri}?code=secret-code&state=nope`)
      expect(response.status).toBe(400)
      await expect(session.result).rejects.toThrow(/did not match/)
      await expect(session.result).rejects.not.toThrow(/secret-code/)
    } finally {
      session.cancel()
    }
  })

  it('times out', async () => {
    const session = await openLoopback({
      expectedState: 'state',
      timeoutMs: 30,
      publicHost: '127.0.0.1'
    })
    await expect(session.result).rejects.toThrow(/timed out/)
  })

  it('ignores a second request', async () => {
    const session = await openLoopback({
      expectedState: 'state',
      timeoutMs: 2000,
      publicHost: '127.0.0.1'
    })
    try {
      const port = Number(new URL(session.redirectUri).port)
      const body = await pipeline(port, 'state')
      expect(body).toContain('meetrec is connected')
      await expect(session.result).resolves.toBe('first-code')
      expect(body).not.toContain('second-code')
    } finally {
      session.cancel()
    }
  })
})

function pipeline(port: number, state: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const socket = connect(port, '127.0.0.1', () => {
      socket.write(
        `GET /callback?code=first-code&state=${state} HTTP/1.1\r\nHost: 127.0.0.1\r\n\r\n`
      )
      socket.write(
        `GET /callback?code=second-code&state=${state} HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n`
      )
    })
    const chunks: Buffer[] = []
    socket.on('data', (chunk: Buffer) => {
      chunks.push(chunk)
    })
    socket.on('end', () => {
      resolve(Buffer.concat(chunks).toString('utf8'))
    })
    socket.on('error', reject)
  })
}
