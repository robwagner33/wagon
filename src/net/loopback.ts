import { bindHost, hostStep } from './host'
import { makeHostCallbacks, type HostHandlers, type HostTransport, type NetClient } from './transport'

/**
 * In-process transport: the authoritative world runs in this same tab (a listen-server). No sockets, no
 * server process — `send*` call the host's handlers directly and `broadcast` fans snapshots back to every
 * connected local client. The foundation for offline solo and couch co-op (one `connect()` per local
 * player). Satisfies the same {@link HostTransport}/{@link NetClient} seam as a socket transport.
 *
 * The game supplies its {@link HostHandlers} (so the loopback stays game-agnostic) and the tick interval;
 * any one-time world setup (e.g. loading the map) is the game's job before calling this.
 */
export function createLoopbackHost<TInput, TMsg, TSnapshot>(
  handlers: HostHandlers<TInput, TMsg, TSnapshot>,
  tickMs: number,
): { connect: () => NetClient<TInput, TMsg, TSnapshot> } {
  const { cb, register } = makeHostCallbacks<TInput, TMsg>()

  // Each connected local client's snapshot sink, keyed by its player id.
  const sinks = new Map<string, (snap: TSnapshot) => void>()
  let nextId = 1

  const host: HostTransport<TInput, TMsg, TSnapshot> = {
    ...register,
    broadcast: (snap) => {
      for (const sink of sinks.values()) sink(snap)
    },
  }

  bindHost(host, handlers)

  let tick = 0
  setInterval(() => {
    tick++
    hostStep(host, handlers, tick)
  }, tickMs)

  // One local player = one NetClient bound to its own id.
  function connect(): NetClient<TInput, TMsg, TSnapshot> {
    const id = `local-${nextId++}`
    let onSnapshot: ((snap: TSnapshot) => void) | null = null
    sinks.set(id, (snap) => onSnapshot?.(snap))
    cb.join(id)
    return {
      selfId: () => id,
      sendInput: (input) => cb.input(id, input),
      send: (msg) => cb.message(id, msg),
      onSnapshot: (cb) => {
        onSnapshot = cb
      },
    }
  }

  return { connect }
}
