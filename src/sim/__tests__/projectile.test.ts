import { describe, expect, it } from 'vitest'
import {
  createProjectileStore,
  nearestHit,
  stepProjectiles,
  type FlightEnv,
  type Hittable,
  type Projectile,
  type ProjectileHandlers,
} from '../index'

/** A minimal flight body. */
const proj = (over: Partial<Projectile> = {}): Projectile => ({
  id: 'p',
  pos: { x: 1, y: 5 },
  vel: { x: 0.5, y: 0 },
  radius: 0.1,
  ticksLeft: 100,
  settling: false,
  ...over,
})

const target = (id: string, x: number, y: number): Hittable => ({
  id,
  pos: { x, y },
  vel: { x: 0, y: 0 },
  radius: 0.3,
  invMass: 1,
  apply() {},
})

const OPEN: FlightEnv = { walls: [], blocker: null, width: 12, height: 12 }

/** Handlers that record which terminal fired, on which body. */
function recorder(bodies: Hittable[] = []) {
  const log: string[] = []
  const handlers: ProjectileHandlers<Projectile> = {
    targetable: () => bodies,
    onExpire: () => log.push('expire'),
    onStatic: (_p, at) => log.push(`static@${at.x.toFixed(1)},${at.y.toFixed(1)}`),
    onRest: () => log.push('rest'),
    onBody: (_p, b) => log.push(`body:${b.id}`),
  }
  return { log, handlers }
}

describe('stepProjectiles', () => {
  it('flies straight and stops on the nearest body, then despawns', () => {
    const store = createProjectileStore<Projectile>()
    store.map.set('p', proj())
    const { log, handlers } = recorder([target('victim', 7, 5)])
    for (let i = 0; i < 30 && store.map.size; i++) stepProjectiles(store, OPEN, handlers, 0.12)
    expect(log).toContain('body:victim')
    expect(store.map.size).toBe(0) // despawned on contact
  })

  it('air-bursts (onExpire) and despawns when lifetime runs out with no contact', () => {
    const store = createProjectileStore<Projectile>()
    store.map.set('p', proj({ ticksLeft: 3, vel: { x: 0, y: 0 } }))
    const { log, handlers } = recorder()
    for (let i = 0; i < 5 && store.map.size; i++) stepProjectiles(store, OPEN, handlers, 0.12)
    expect(log).toEqual(['expire'])
    expect(store.map.size).toBe(0)
  })

  it('stops static at the rink bound', () => {
    const store = createProjectileStore<Projectile>()
    store.map.set('p', proj({ pos: { x: 11.5, y: 5 }, vel: { x: 1, y: 0 } }))
    const { log, handlers } = recorder()
    stepProjectiles(store, OPEN, handlers, 0.12)
    expect(log.some((l) => l.startsWith('static@'))).toBe(true)
    expect(store.map.size).toBe(0)
  })

  it('never hits its own owner if the game omits it from targetable', () => {
    const store = createProjectileStore<Projectile>()
    store.map.set('p', proj())
    const { log, handlers } = recorder([]) // owner filtered out → empty list
    for (let i = 0; i < 20 && store.map.size; i++) stepProjectiles(store, OPEN, handlers, 0.12)
    expect(log).not.toContain('body:owner')
  })
})

describe('nearestHit', () => {
  it('picks the closest overlapping body within both radii', () => {
    const p = proj({ pos: { x: 5, y: 5 }, radius: 0.2 })
    const near = target('near', 5.2, 5)
    const far = target('far', 5.4, 5)
    expect(nearestHit(p, [far, near])?.id).toBe('near')
    expect(nearestHit(p, [target('miss', 8, 8)])).toBeNull()
  })
})
