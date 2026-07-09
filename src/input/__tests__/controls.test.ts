import { describe, expect, it } from 'vitest'
import { createControls, type InputTarget } from '../controls'

/** A fake event target that records listeners and lets a test dispatch synthetic events. */
function fakeTarget() {
  const listeners = new Map<string, Set<(e: any) => void>>()
  const target: InputTarget = {
    innerWidth: 800,
    innerHeight: 600,
    addEventListener: (t, l) => {
      const s = listeners.get(t) ?? new Set()
      s.add(l)
      listeners.set(t, s)
    },
    removeEventListener: (t, l) => listeners.get(t)?.delete(l),
  }
  const fire = (t: string, e: any) => listeners.get(t)?.forEach((l) => l(e))
  return { target, fire, count: () => [...listeners.values()].reduce((n, s) => n + s.size, 0) }
}

const bindings = {
  move: { up: ['w'], down: ['s'], left: ['a'], right: ['d'] },
  primary: { buttons: [0] },
  alt: { buttons: [2], keys: ['r'] },
  actions: { interact: ['e'] },
  suppressContextMenu: true,
}

describe('createControls', () => {
  it('reads the direction axis from held move keys', () => {
    const { target, fire } = fakeTarget()
    const c = createControls(bindings, target)
    fire('keydown', { key: 'd' })
    fire('keydown', { key: 'w' })
    expect(c.direction()).toEqual({ dx: 1, dy: -1 })
    fire('keyup', { key: 'd' })
    expect(c.direction()).toEqual({ dx: 0, dy: -1 })
  })

  it('tracks the pointer (centered until moved)', () => {
    const { target, fire } = fakeTarget()
    const c = createControls(bindings, target)
    expect(c.pointer()).toEqual({ x: 400, y: 300 })
    fire('mousemove', { clientX: 10, clientY: 20 })
    expect(c.pointer()).toEqual({ x: 10, y: 20 })
  })

  it('holds primary on its button, alt on its button OR key', () => {
    const { target, fire } = fakeTarget()
    const c = createControls(bindings, target)
    fire('mousedown', { button: 0 })
    expect(c.primary()).toBe(true)
    expect(c.alt()).toBe(false)
    fire('mousedown', { button: 2 })
    expect(c.alt()).toBe(true)
    fire('mouseup', { button: 2 })
    expect(c.alt()).toBe(false)
    fire('keydown', { key: 'r' })
    expect(c.alt()).toBe(true) // key binding
  })

  it('fires a named action on the rising edge only', () => {
    const { target, fire } = fakeTarget()
    const c = createControls(bindings, target)
    let hits = 0
    c.onAction('interact', () => hits++)
    fire('keydown', { key: 'e' })
    fire('keydown', { key: 'e', repeat: true }) // auto-repeat ignored
    expect(hits).toBe(1)
  })

  it('dispose detaches every listener', () => {
    const { target, count } = fakeTarget()
    const c = createControls(bindings, target)
    expect(count()).toBeGreaterThan(0)
    c.dispose()
    expect(count()).toBe(0)
  })
})
