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

  it('resyncs hard when the offset drifts past the resync threshold (e.g. after a tab stall)', () => {
    const clock = createClock()
    clock.noteSnapshot(100, 0)
    // A 300ms jump in arrival vs tick is past CLOCK_RESYNC_MS (250) → snap the full offset, no easing.
    clock.noteSnapshot(100, 300)
    expect(clock.serverNow(300)).toBeCloseTo(100 * TICK_MS)
  })

  it('holds the playout delay at the base when arrivals are perfectly paced', () => {
    const clock = createClock()
    // Every snapshot arrives exactly one tick-span after the last → zero jitter → delay never grows.
    for (let i = 0; i < 10; i++) clock.noteSnapshot(100 + i, i * TICK_MS)
    expect(clock.interpDelayMs()).toBeCloseTo(3 * TICK_MS)
  })

  it('widens the playout delay under arrival jitter but never past the max', () => {
    const clock = createClock()
    clock.noteSnapshot(100, 0)
    // Alternate early/late arrivals so each gap deviates wildly from its tick span.
    let localNow = 0
    for (let i = 1; i <= 40; i++) {
      localNow += i % 2 === 0 ? 1 : 500
      clock.noteSnapshot(100 + i, localNow)
    }
    expect(clock.interpDelayMs()).toBeGreaterThan(3 * TICK_MS)
    expect(clock.interpDelayMs()).toBeLessThanOrEqual(300)
  })
})
