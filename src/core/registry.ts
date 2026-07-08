/**
 * Small helpers for the registry pattern a game builds its item catalog on: a module-scope const table of
 * entries whose keys ARE the id union (`type Id = keyof typeof TABLE`), often mirrored by a second table on the
 * same id (e.g. sim-stats + render). The `keyof typeof` id-union and the concrete tables must stay in the game
 * (they only work at module scope); these are the reusable bits layered on top — nothing here names a game.
 */

/**
 * Build a per-key number record over a registry — a fresh per-item reserve/loadout (e.g. every weapon's starting
 * ammo). `amount` maps each entry to its number. Iterates the table's keys in insertion order (deterministic).
 */
export function freshReserves<K extends string, T>(table: Record<K, T>, amount: (entry: T) => number): Record<K, number> {
  const out = {} as Record<K, number>
  for (const key of Object.keys(table) as K[]) out[key] = amount(table[key])
  return out
}

/** Real-world ms for a tick count at the given tick length — a fire cadence / cooldown expressed in ms. */
export function cadenceMs(ticks: number, tickMs: number): number {
  return ticks * tickMs
}
