import { describe, expect, it } from 'vitest'
import type { GoogleConnection } from '../settings/secret-codec'
import { GOOGLE_DRIVE_SCOPE } from './constants'
import { applyGoogleSignIn, driveConnection, rekeyGoogleConnection } from './google-connections'

function token(id: string, scope = 'openid'): GoogleConnection {
  return {
    id,
    accessToken: 'access',
    refreshToken: 'refresh',
    expiresAt: 1,
    tokenType: 'Bearer',
    scope,
    accountEmail: `${id}@example.com`
  }
}

describe('google connections', () => {
  it('replaces the same user and drops a different reconnect target', () => {
    const same = applyGoogleSignIn([token('a'), token('b')], token('b', 'drive'), 'b')
    expect(same.droppedId).toBeNull()
    expect(same.connections.map((item) => item.id)).toEqual(['a', 'b'])
    expect(same.connections[1]?.scope).toBe('drive')
    const replaced = applyGoogleSignIn([token('a'), token('b')], token('c'), 'a')
    expect(replaced.droppedId).toBe('a')
    expect(replaced.connections.map((item) => item.id)).toEqual(['b', 'c'])
  })

  it('rejects a sixth new account', () => {
    const five = ['a', 'b', 'c', 'd', 'e'].map((id) => token(id))
    expect(() => applyGoogleSignIn(five, token('f'), null)).toThrow(/five Google accounts/)
    const replaced = applyGoogleSignIn(five, token('f'), 'a')
    expect(replaced.connections).toHaveLength(5)
    expect(replaced.droppedId).toBe('a')
  })

  it('picks the first connection that granted Drive', () => {
    const connections = [
      token('a'),
      token('b', `openid ${GOOGLE_DRIVE_SCOPE}`),
      token('c', GOOGLE_DRIVE_SCOPE)
    ]
    expect(driveConnection(connections)?.id).toBe('b')
    expect(driveConnection([token('a')])).toBeNull()
  })

  it('rekeys a legacy id and drops it when that user is already connected', () => {
    expect(
      rekeyGoogleConnection([token('legacy')], 'legacy', 'gid').map((item) => item.id)
    ).toEqual(['gid'])
    expect(
      rekeyGoogleConnection([token('legacy'), token('gid')], 'legacy', 'gid').map((item) => item.id)
    ).toEqual(['gid'])
  })
})
