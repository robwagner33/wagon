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
 *
 * Pass `tickMs: null` to drive ticks yourself via the returned `step`, calling it once per fixed tick of
 * the game's own loop. A `setInterval` host is a second clock that drifts against the local client's
 * accumulator, so it periodically runs a tick the client has not predicted — a reconcile correction of one
 * tick's motion, felt as a stutter. Stepping in lockstep makes the offline host deterministic with local
 * prediction: zero corrections.
 */
export function createLoopbackHost<TInput, TMsg, TSnapshot, TEvent = never>(
  handlers: HostHandlers<TInput, TMsg, TSnapshot, TEvent>,
  tickMs: number | null,
): { connect: () => NetClient<TInput, TMsg, TSnapshot, TEvent>; step: () => void } {
  const { cb, register } = makeHostCallbacks<TInput, TMsg>()

  // Each connected local client's snapshot + event sinks, keyed by its player id.
  const sinks = new Map<string, (snap: TSnapshot) => void>()
  const eventSinks = new Map<string, (ev: TEvent) => void>()
  let nextId = 1

  const host: HostTransport<TInput, TMsg, TSnapshot, TEvent> = {
    ...register,
    broadcast: (snap) => {
      for (const sink of sinks.values()) sink(snap)
    },
    emit: (ev) => {
      for (const sink of eventSinks.values()) sink(ev)
    },
    peers: () => [...sinks.keys()],
    sendTo: (peerId, snap) => sinks.get(peerId)?.(snap),
    emitTo: (peerId, ev) => eventSinks.get(peerId)?.(ev),
  }

  bindHost(host, handlers)

  let tick = 0
  const step = (): void => {
    tick++
    hostStep(host, handlers, tick)
  }
  if (tickMs !== null) setInterval(step, tickMs)

  // One local player = one NetClient bound to its own id.
  function connect(): NetClient<TInput, TMsg, TSnapshot, TEvent> {
    const id = `local-${nextId++}`
    let onSnapshot: ((snap: TSnapshot) => void) | null = null
    let onEvent: ((ev: TEvent) => void) | null = null
    sinks.set(id, (snap) => onSnapshot?.(snap))
    eventSinks.set(id, (ev) => onEvent?.(ev))
    cb.join(id)
    return {
      selfId: () => id,
      sendInput: (input) => cb.input(id, input),
      send: (msg) => cb.message(id, msg),
      onSnapshot: (cb) => {
        onSnapshot = cb
      },
      onEvent: (cb) => {
        onEvent = cb
      },
    }
  }

  return { connect, step }
}
