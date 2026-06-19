import { clamp } from '../geom'
import { TICK_MS } from '../tick'

/** Per-snapshot easing of the local→server clock offset; small enough to absorb arrival jitter. */
const CLOCK_SMOOTHING = 0.05

/** Re-sync the clock hard (no easing) when it drifts this far, e.g. after a tab stall. */
const CLOCK_RESYNC_MS = 250

/** Adaptive playout buffer: render remotes this far in the past, sized to measured jitter. */
const INTERP_BASE_MS = 3 * TICK_MS
const INTERP_MIN_MS = 3 * TICK_MS
const INTERP_MAX_MS = 300

/** How many jitter-widths of margin the delay carries above the base. */
const JITTER_K = 2

/** RTP-style jitter smoothing (RFC 3550): jitter += (|deviation| - jitter) / 16. */
const JITTER_GAIN = 1 / 16

/** Per-snapshot easing of the interpolation delay toward its target, so the timeline never warps. */
const DELAY_EASE = 0.05

/**
 * Tracks one client's mapping from local time to server time, plus an adaptive playout delay. Each client
 * (couch co-op runs several in one tab) owns its own clock. `localNow` is passed in rather than read here so
 * the clock is pure and testable; callers pass `performance.now()`.
 */
export interface NetClock {
  /** Fold one snapshot's arrival into the clock offset and the adaptive interpolation delay. */
  noteSnapshot(serverTick: number, localNow: number): void
  /** Server-clock time to render remote players at: local time mapped to server time, minus the playout delay. */
  serverRenderTime(localNow: number): number
  /** Live server-clock time (no playout delay) — for extrapolating fast bodies like the puck near real-time. */
  serverNow(localNow: number): number
  /** Current adaptive interpolation delay in ms (for debug/HUD). */
  interpDelayMs(): number
}

/** Create one client's clock. Call once per {@link NetClient}; feed every snapshot through `noteSnapshot`. */
export function createClock(): NetClock {
  let clockOffset = 0
  let clockReady = false

  let jitter = 0
  let interpDelay = INTERP_BASE_MS
  let lastArrival = 0
  let lastTick = 0
  let haveArrival = false

  function noteSnapshot(serverTick: number, localNow: number): void {
    const target = serverTick * TICK_MS - localNow
    if (!clockReady || Math.abs(target - clockOffset) > CLOCK_RESYNC_MS) {
      clockOffset = target
      clockReady = true
    } else {
      clockOffset += (target - clockOffset) * CLOCK_SMOOTHING
    }

    if (haveArrival) {
      // Deviation of this snapshot's real arrival gap from the gap its tick span implies.
      const expected = TICK_MS * (serverTick - lastTick)
      const deviation = localNow - lastArrival - expected
      jitter += (Math.abs(deviation) - jitter) * JITTER_GAIN
      const targetDelay = clamp(INTERP_BASE_MS + JITTER_K * jitter, INTERP_MIN_MS, INTERP_MAX_MS)
      interpDelay += (targetDelay - interpDelay) * DELAY_EASE
    }

    lastArrival = localNow
    lastTick = serverTick
    haveArrival = true
  }

  return {
    noteSnapshot,
    serverRenderTime: (localNow) => localNow + clockOffset - interpDelay,
    serverNow: (localNow) => localNow + clockOffset,
    interpDelayMs: () => interpDelay,
  }
}
