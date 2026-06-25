import { describe, expect, it } from 'vitest'
import { createRoomRegistry, type Member, type Room } from '../rooms'

/** A throwaway world + member type so the tests exercise the registry's generics, not a real game. */
type World = { label: string }
type TestRoom = Room<World, Member>

/** Build a registerable room with the given members (default phase 'lobby'). */
function room(code: string, hostId: string, memberIds: string[], phase: 'lobby' | 'playing' = 'lobby'): TestRoom {
  return {
    code,
    hostId,
    phase,
    world: { label: code },
    tick: 0,
    createdAt: 0,
    members: memberIds.map((id) => ({ id, name: id.toUpperCase() })),
  }
}

describe('createRoomRegistry', () => {
  it('generates unique, correctly-sized codes that never collide with a registered room', () => {
    const reg = createRoomRegistry<TestRoom>()
    const codes = new Set<string>()
    for (let i = 0; i < 200; i++) {
      const code = reg.genCode()
      reg.register(room(code, 'h', ['h']))
      codes.add(code)
    }
    expect(codes.size).toBe(200) // every genCode saw the prior registrations and avoided them
    for (const code of codes) expect(code).toHaveLength(4)
  })

  it('honours a custom alphabet and code length', () => {
    const reg = createRoomRegistry<TestRoom>({ alphabet: 'AB', codeLength: 6 })
    const code = reg.genCode()
    expect(code).toHaveLength(6)
    expect([...code].every((ch) => ch === 'A' || ch === 'B')).toBe(true)
  })

  it('finds the room a player belongs to by membership', () => {
    const reg = createRoomRegistry<TestRoom>()
    const a = room('AAAA', 'h1', ['h1', 'p1'])
    const b = room('BBBB', 'h2', ['h2'])
    reg.register(a)
    reg.register(b)
    expect(reg.roomOf('p1')).toBe(a)
    expect(reg.roomOf('h2')).toBe(b)
    expect(reg.roomOf('nobody')).toBeUndefined()
  })

  it('filters playing rooms and lists all rooms', () => {
    const reg = createRoomRegistry<TestRoom>()
    reg.register(room('AAAA', 'h1', ['h1'], 'playing'))
    reg.register(room('BBBB', 'h2', ['h2'], 'lobby'))
    expect(reg.playing().map((r) => r.code)).toEqual(['AAAA'])
    expect(reg.all()).toHaveLength(2)
  })

  it('deletes a room when the host leaves, regardless of who remains', () => {
    const reg = createRoomRegistry<TestRoom>()
    reg.register(room('AAAA', 'host', ['host', 'guest']))
    const res = reg.removeMember('host')
    expect(res).toMatchObject({ deleted: true })
    expect(reg.get('AAAA')).toBeUndefined()
  })

  it('keeps a room alive while a non-host remains, then deletes it once empty', () => {
    const reg = createRoomRegistry<TestRoom>()
    reg.register(room('AAAA', 'host', ['host', 'guest']))
    expect(reg.removeMember('guest')).toMatchObject({ deleted: false })
    expect(reg.get('AAAA')?.members.map((m) => m.id)).toEqual(['host'])
    expect(reg.removeMember('host')).toMatchObject({ deleted: true }) // host is also the last member
    expect(reg.get('AAAA')).toBeUndefined()
  })

  it('returns null removing a player in no room', () => {
    const reg = createRoomRegistry<TestRoom>()
    expect(reg.removeMember('ghost')).toBeNull()
  })

  it('clears every room', () => {
    const reg = createRoomRegistry<TestRoom>()
    reg.register(room('AAAA', 'h', ['h']))
    reg.clear()
    expect(reg.all()).toHaveLength(0)
  })
})
