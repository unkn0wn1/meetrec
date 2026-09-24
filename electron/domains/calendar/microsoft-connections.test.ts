import { describe, expect, it } from 'vitest'
import type { MicrosoftConnection } from '../settings/secret-codec'
import { MICROSOFT_APPFOLDER_SCOPE } from './constants'
import {
  applyMicrosoftSignIn,
  oneDriveConnection,
  prepareMicrosoftSignIn
} from './microsoft-connections'

function token(id: string, scope = 'Calendars.Read'): MicrosoftConnection {
  return {
    id,
    accessToken: 'access',
    refreshToken: 'refresh',
    expiresAt: 1,
    tokenType: 'Bearer',
    scope,
    accountEmail: `${id}@contoso.com`
  }
}

describe('microsoft connections', () => {
  it('adds a second account and replaces the same user', () => {
    const added = applyMicrosoftSignIn([token('a')], token('b'), null)
    expect(added.droppedId).toBeNull()
    expect(added.connections.map((item) => item.id)).toEqual(['a', 'b'])
    const same = applyMicrosoftSignIn([token('a'), token('b')], token('b', 'Files.Read'), 'b')
    expect(same.droppedId).toBeNull()
    expect(same.connections[1]?.scope).toBe('Files.Read')
    expect(same.connections).toHaveLength(2)
  })

  it('replaces one card and rejects a third new account', () => {
    const two = [token('a'), token('b')]
    expect(() => applyMicrosoftSignIn(two, token('c'), null)).toThrow(/two Microsoft accounts/)
    const replaced = applyMicrosoftSignIn(two, token('c'), 'a')
    expect(replaced.droppedId).toBe('a')
    expect(replaced.connections.map((item) => item.id)).toEqual(['b', 'c'])
  })

  it('folds a migrated email row into the Graph user id', () => {
    const provisional = token('email:ada@contoso.com')
    provisional.accountEmail = 'Ada@Contoso.com'
    const next = token('oid-1')
    next.accountEmail = 'ada@contoso.com'
    const prepared = prepareMicrosoftSignIn([provisional, token('other')], next)
    expect(prepared.rekeyedFrom).toBe('email:ada@contoso.com')
    const applied = applyMicrosoftSignIn(prepared.connections, next, null)
    expect(applied.droppedId).toBeNull()
    expect(applied.connections.map((item) => item.id)).toEqual(['oid-1', 'other'])
    expect(applied.connections[0]?.accountEmail).toBe('ada@contoso.com')
  })

  it('picks the first connection that granted the OneDrive app folder', () => {
    const connections = [
      token('a'),
      token('b', `Calendars.Read ${MICROSOFT_APPFOLDER_SCOPE}`),
      token('c', MICROSOFT_APPFOLDER_SCOPE)
    ]
    expect(oneDriveConnection(connections)?.id).toBe('b')
    expect(oneDriveConnection([token('a')])).toBeNull()
  })
})
