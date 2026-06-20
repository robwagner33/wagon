import { describe, expect, it } from 'vitest'
import { createRemoteSet } from '../remotes'

interface Meta {
  name: string
}

describe('createRemoteSet', () => {
  it('records samples + metadata and lists tracked ids', () => {
    const set = createRemoteSet<Meta>()
    set.record('a', { t: 0, x: 0, y: 0 }, { name: 'alice' })
    set.record('b', { t: 0, x: 5, y: 0 }, { name: 'bob' })
    expect(set.ids().sort()).toEqual(['a', 'b'])
    expect(set.meta('a')).toEqual({ name: 'alice' })
    expect(set.meta('ghost')).toBeNull()
  })

  it('refreshes metadata on a re-record', () => {
    const set = createRemoteSet<Meta>()
    set.record('a', { t: 0, x: 0, y: 0 }, { name: 'alice' })
    set.record('a', { t: 10, x: 1, y: 0 }, { name: 'alice2' })
    expect(set.meta('a')).toEqual({ name: 'alice2' })
  })

  it('prunes entities absent from the keep set', () => {
    const set = createRemoteSet<Meta>()
    set.record('a', { t: 0, x: 0, y: 0 }, { name: 'a' })
    set.record('b', { t: 0, x: 0, y: 0 }, { name: 'b' })
    set.prune(new Set(['a']))
    expect(set.ids()).toEqual(['a'])
    expect(set.meta('b')).toBeNull()
  })

  it('builds immovable collision blockers at each entity’s latest position', () => {
    const set = createRemoteSet<Meta>()
    set.record('a', { t: 0, x: 1, y: 2 }, { name: 'a' })
    set.record('a', { t: 10, x: 3, y: 4 }, { name: 'a' }) // newer sample wins for collision
    const blockers = set.blockers(0.5)
    expect(blockers).toHaveLength(1)
    expect(blockers[0]).toMatchObject({ pos: { x: 3, y: 4 }, r: 0.5, invMass: 0 })
    expect(blockers[0].vel).toEqual({ x: 0, y: 0 })
  })

  it('derives travel heading + speed from the samples around a moment', () => {
    const set = createRemoteSet<Meta>()
    // Eastward at 1 tile per 10ms — across a 10ms step that is 100 tiles/s along +x (heading 0).
    for (let i = 0; i <= 4; i++) set.record('a', { t: i * 10, x: i, y: 0 }, { name: 'a' })
    const { heading, speed } = set.velocityAt('a', 30, 10)
    expect(heading).toBeCloseTo(0)
    expect(speed).toBeCloseTo(100)
  })

  it('reports zero velocity for an unknown id', () => {
    const set = createRemoteSet<Meta>()
    expect(set.velocityAt('ghost', 5, 10)).toEqual({ heading: 0, speed: 0 })
  })
})
