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

let clockOffset = 0
let clockReady = false

let jitter = 0
let interpDelay = INTERP_BASE_MS
let lastArrival = 0
let lastTick = 0
let haveArrival = false

/** Fold one snapshot's arrival into the clock offset and the adaptive interpolation delay. */
export function noteSnapshot(serverTick: number): void {
  const localNow = performance.now()

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

/** Server-clock time to render remote players at: local time mapped to server time, minus the playout delay. */
export function serverRenderTime(localNow: number): number {
  return localNow + clockOffset - interpDelay
}

/** Live server-clock time (no playout delay) — for extrapolating fast bodies like the puck near real-time. */
export function serverNow(localNow: number): number {
  return localNow + clockOffset
}

/** Current adaptive interpolation delay in ms (for debug/HUD). */
export function interpDelayMs(): number {
  return interpDelay
}
