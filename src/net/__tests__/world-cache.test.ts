import { describe, expect, it, vi } from 'vitest'

import { createWorldCache } from '../rooms'

type World = { code: string; n: number }

/** Yield to the macrotask queue so a serialized cache op has a chance to start. */
const tick = () => new Promise((resolve) => setTimeout(resolve))

/** A fake store: counts hydrate/flush calls and lets a test hold a hydrate open to force a race. */
function fakeStore() {
  const hydrate = vi.fn(async (code: string): Promise<World> => ({ code, n: 0 }))
  const flush = vi.fn(async (_code: string, _world: World): Promise<void> => {})
  return { hydrate, flush }
}

describe('createWorldCache', () => {
  it('hydrates on first acquire and caches after', async () => {
    const store = fakeStore()
    const cache = createWorldCache(store)

    const a = await cache.acquire('AAAA')
    const b = await cache.acquire('AAAA')

    expect(a).toBe(b)
    expect(store.hydrate).toHaveBeenCalledTimes(1)
  })

  it('de-dupes concurrent acquires of the same code into one hydration', async () => {
    let release!: (w: World) => void
    const hydrate = vi.fn(
      (code: string) =>
        new Promise<World>((resolve) => {
          release = () => resolve({ code, n: 1 })
        }),
    )
    const cache = createWorldCache({ hydrate, flush: async () => {} })

    const p1 = cache.acquire('AAAA')
    const p2 = cache.acquire('AAAA')
    await tick()
    release(null as unknown as World)
    const [w1, w2] = await Promise.all([p1, p2])

    expect(w1).toBe(w2)
    expect(hydrate).toHaveBeenCalledTimes(1)
  })

  it('get is a synchronous peek: undefined before acquire, the world after', async () => {
    const cache = createWorldCache(fakeStore())
    expect(cache.get('AAAA')).toBeUndefined()
    const world = await cache.acquire('AAAA')
    expect(cache.get('AAAA')).toBe(world)
  })

  it('evict flushes the world then drops it from memory', async () => {
    const store = fakeStore()
    const cache = createWorldCache(store)

    const world = await cache.acquire('AAAA')
    await cache.evict('AAAA')

    expect(store.flush).toHaveBeenCalledWith('AAAA', world)
    expect(cache.get('AAAA')).toBeUndefined()
  })

  it('re-acquiring after evict hydrates a fresh copy', async () => {
    const store = fakeStore()
    const cache = createWorldCache(store)

    await cache.acquire('AAAA')
    await cache.evict('AAAA')
    await cache.acquire('AAAA')

    expect(store.hydrate).toHaveBeenCalledTimes(2)
  })

  it('evict of an unknown code is a no-op', async () => {
    const store = fakeStore()
    const cache = createWorldCache(store)
    await cache.evict('ZZZZ')
    expect(store.flush).not.toHaveBeenCalled()
  })

  it('flushAll flushes every resident world without evicting', async () => {
    const store = fakeStore()
    const cache = createWorldCache(store)

    await cache.acquire('AAAA')
    await cache.acquire('BBBB')
    await cache.flushAll()

    expect(store.flush).toHaveBeenCalledTimes(2)
    expect(cache.resident().map((r) => r.code).sort()).toEqual(['AAAA', 'BBBB'])
  })

  it('serializes a re-acquire that lands during an evict flush', async () => {
    let releaseFlush!: () => void
    const order: string[] = []
    const hydrate = vi.fn(async (code: string): Promise<World> => {
      order.push('hydrate')
      return { code, n: 0 }
    })
    const flush = vi.fn(
      (_code: string) =>
        new Promise<void>((resolve) => {
          order.push('flush-start')
          releaseFlush = () => {
            order.push('flush-end')
            resolve()
          }
        }),
    )
    const cache = createWorldCache({ hydrate, flush })

    await cache.acquire('AAAA')
    const evicting = cache.evict('AAAA')
    const reacquiring = cache.acquire('AAAA')
    await tick()
    releaseFlush()
    await Promise.all([evicting, reacquiring])

    // The re-acquire must not run until the evict's flush has fully finished.
    expect(order).toEqual(['hydrate', 'flush-start', 'flush-end', 'hydrate'])
  })
})
