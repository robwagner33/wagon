/**
 * The match-clock primitive: one tick of a period countdown. Frozen ticks (a pre-play countdown, a celebration,
 * a pause) hold the clock; an active tick decrements it and signals the edge when it reaches zero, so the caller
 * can end the period. Pure — the caller owns the clock field, the freeze conditions, and what "period end" does.
 */
export function tickCountdown(clockTicks: number, frozen: boolean): { clockTicks: number; ended: boolean } {
  if (frozen) return { clockTicks, ended: false }
  const decremented = clockTicks - 1
  if (decremented > 0) return { clockTicks: decremented, ended: false }
  return { clockTicks: 0, ended: true }
}
