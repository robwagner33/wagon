/**
 * Ambient context: a single mutable "currently-active" pointer behind a getter/setter pair. A game with
 * several independent worlds in one process (one per room) swaps the active one at the room boundary, so the
 * sim functions read it implicitly instead of threading it through every call. This is the `let X | null`
 * primitive — `createContext` is the only place that pattern lives, so games stop hand-writing it per slot.
 *
 * Ambient is an *opt-in* convenience, not an engine mandate: a game can ignore this and pass its world
 * explicitly. The room host never imports it — it couples only to an injected `activate(room)` callback, so
 * an explicit-DI game wires a no-op `activate` with zero rework.
 *
 * INVARIANT: the active pointer is only safe because a tick is fully synchronous (read input → step →
 * snapshot, no yield). **Never `await` inside a tick** — an await lets another room's `set` interleave and
 * clobber the pointer. (Multi-core scaling uses process/worker isolation, which is fine: each isolate owns
 * its own module-level pointer.) The first time a sim step must go async is the trigger to drop ambient for
 * an explicitly-threaded context.
 */
export interface Context<T> {
  /** The active value. Throws if none is set — a read slipped through before anything was activated. */
  active(): T
  /** The active value, or null if none is set — for optional reads (e.g. a map that may be unloaded). */
  current(): T | null
  /** Make `v` the active value (or null to clear). Called at the boundary before the active value is read. */
  set(v: T | null): void
}

/** A fresh ambient slot. `label` names it in the "nothing active" error so a missing `set` is easy to trace. */
export function createContext<T>(label: string): Context<T> {
  let active: T | null = null
  return {
    active() {
      if (active === null) throw new Error(`no active ${label} — call set() first`)
      return active
    },
    current() {
      return active
    },
    set(v: T | null) {
      active = v
    },
  }
}
