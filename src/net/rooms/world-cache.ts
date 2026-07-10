/**
 * A cache of live worlds for games whose worlds outlive a session — the world's truth is a store (a
 * database, a file), and memory holds a hydrated copy only while someone is using it. The counterpart to
 * {@link createRoomRegistry}, whose rooms are ephemeral and vanish when they empty: here a world is loaded
 * on demand, flushed and dropped when the game decides it is idle, and comes back byte-for-byte on the next
 * acquire.
 *
 * Game-agnostic and I/O-free: the game injects async `hydrate(code)` and `flush(code, world)`, so the cache
 * knows nothing about the store or the world's shape. It owns two hard parts a hand-rolled `Map` gets wrong:
 *
 * - **De-duped hydration.** Two players joining the same cold world at once must not both hydrate it (and,
 *   with a find-or-create store, race to create duplicate rows). Concurrent `acquire`s of one code share a
 *   single hydration.
 * - **Serialized lifecycle.** `acquire` and `evict` for the same code never overlap, so a re-join landing in
 *   the middle of an evict's flush can't read a half-written world or resurrect a dropped one.
 *
 * The cache does not decide *when* a world is idle — only the game knows what "empty" means (no players, no
 * pending work). The game calls `evict(code)` when it decides; `resident()` and `get()` feed its tick loop.
 */

export interface WorldCache<TWorld> {
  /** The live world for a code, hydrating it from the store on first use. Concurrent calls share one hydrate. */
  acquire(code: string): Promise<TWorld>
  /** The resident world for a code, or undefined — a synchronous peek for the tick loop and input routing. */
  get(code: string): TWorld | undefined
  /** Flush a world and drop it from memory. The store keeps it; the next `acquire` re-hydrates. */
  evict(code: string): Promise<void>
  /** Flush every resident world without evicting — the periodic write-back and the shutdown hook. */
  flushAll(): Promise<void>
  /** Every resident world with its code, for the tick loop. */
  resident(): { code: string; world: TWorld }[]
}

export function createWorldCache<TWorld>(opts: {
  hydrate: (code: string) => Promise<TWorld>
  flush: (code: string, world: TWorld) => Promise<void>
}): WorldCache<TWorld> {
  const resolved = new Map<string, TWorld>()
  const locks = new Map<string, Promise<unknown>>()

  function serial<T>(code: string, op: () => Promise<T>): Promise<T> {
    const prev = locks.get(code) ?? Promise.resolve()
    const next = prev.then(op, op)
    locks.set(
      code,
      next.then(
        () => {},
        () => {},
      ),
    )
    return next
  }

  function acquire(code: string): Promise<TWorld> {
    return serial(code, async () => {
      const live = resolved.get(code)
      if (live !== undefined) return live
      const world = await opts.hydrate(code)
      resolved.set(code, world)
      return world
    })
  }

  function evict(code: string): Promise<void> {
    return serial(code, async () => {
      const world = resolved.get(code)
      if (world === undefined) return
      await opts.flush(code, world)
      resolved.delete(code)
    })
  }

  async function flushAll(): Promise<void> {
    for (const [code, world] of [...resolved]) await opts.flush(code, world)
  }

  return {
    acquire,
    get: (code) => resolved.get(code),
    evict,
    flushAll,
    resident: () => [...resolved].map(([code, world]) => ({ code, world })),
  }
}
