import { describe, expect, it } from 'vitest'
import { tickCountdown } from '../countdown'

describe('tickCountdown', () => {
  it('holds the clock while frozen', () => {
    expect(tickCountdown(100, true)).toEqual({ clockTicks: 100, ended: false })
  })
  it('decrements while running, no edge', () => {
    expect(tickCountdown(100, false)).toEqual({ clockTicks: 99, ended: false })
  })
  it('clamps to 0 and signals the edge on the last tick', () => {
    expect(tickCountdown(1, false)).toEqual({ clockTicks: 0, ended: true })
  })
  it('signals ended (clamped) even from 0 — reaching the edge is idempotent', () => {
    expect(tickCountdown(0, false)).toEqual({ clockTicks: 0, ended: true })
  })
})
