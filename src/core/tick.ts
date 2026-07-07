/**
 * The fixed-step cadence the whole engine runs on: the authoritative sim advances and the host broadcasts
 * once per tick, and clients predict + interpolate against the same rate. A core fundamental (not a net
 * concern) — the deterministic, byte-for-byte sim is defined relative to this tick, so both client and
 * server must agree on it. The net layer imports it for clock sync; games import it for their sim.
 */

/** Simulation + broadcast rate, ticks per second. */
export const TICK_HZ = 30

/** Milliseconds per tick — `1000 / TICK_HZ`. */
export const TICK_MS = 1000 / TICK_HZ
