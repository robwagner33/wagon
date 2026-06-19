import { describe, expect, it } from 'vitest'
import { createClock } from '../clock'
import { TICK_MS } from '../../tick'

describe('createClock', () => {
  it('snaps the offset hard on the first snapshot', () => {
    const clock = createClock()
    // serverTick 100 → server time 100*TICK_MS; observed at localNow 0 → offset = server time.
    clock.noteSnapshot(100, 0)
    expect(clock.serverNow(0)).toBeCloseTo(100 * TICK_MS)
  })

  it('eases the offset toward later snapshots instead of jumping', () => {
    const clock = createClock()
    clock.noteSnapshot(100, 0)
    const before = clock.serverNow(0)
    // A small drift well under the resync threshold is absorbed gradually, not applied in full.
    clock.noteSnapshot(101, TICK_MS + 5)
    const after = clock.serverNow(0)
    expect(after).not.toBe(before)
    expect(Math.abs(after - before)).toBeLessThan(5)
  })

  it('isolates state per instance', () => {
    const a = createClock()
    const b = createClock()
    a.noteSnapshot(100, 0)
    expect(a.serverNow(0)).toBeCloseTo(100 * TICK_MS)
    expect(b.serverNow(0)).toBe(0) // b never saw a snapshot
  })

  it('renders remotes behind live time by the playout delay', () => {
    const clock = createClock()
    clock.noteSnapshot(100, 0)
    expect(clock.serverNow(0) - clock.serverRenderTime(0)).toBeCloseTo(clock.interpDelayMs())
  })
})
