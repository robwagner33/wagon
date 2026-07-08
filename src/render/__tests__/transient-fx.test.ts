import { describe, expect, it } from 'vitest'
import { createTransientFx } from '../transient-fx'

const ctx = {} as CanvasRenderingContext2D

describe('createTransientFx', () => {
  it('draws live effects (newest-first) and culls them once past their duration', () => {
    const drawn: number[] = []
    const fx = createTransientFx<{ id: number }>({ duration: () => 100, draw: (_c, e) => drawn.push(e.id) })
    fx.ingest([{ id: 1 }, { id: 2 }])
    fx.draw(ctx, 0, 0, 1, 0.05) // age 50 — both live; reverse walk draws 2 then 1
    expect(drawn).toEqual([2, 1])
    drawn.length = 0
    fx.draw(ctx, 0, 0, 1, 0.06) // age 110 — both expire, none drawn
    fx.draw(ctx, 0, 0, 1, 0.01) // empty
    expect(drawn).toEqual([])
  })

  it('scales lifetime per entry via duration(entry)', () => {
    const drawn: number[] = []
    const fx = createTransientFx<{ id: number; life: number }>({
      duration: (e) => e.life,
      draw: (_c, e) => drawn.push(e.id),
    })
    fx.ingest([
      { id: 1, life: 50 },
      { id: 2, life: 500 },
    ])
    fx.draw(ctx, 0, 0, 1, 0.1) // age 100 — id1 expired, id2 lives
    expect(drawn).toEqual([2])
  })

  it('reset drops every live effect', () => {
    const drawn: number[] = []
    const fx = createTransientFx<{ id: number }>({ duration: () => 1000, draw: (_c, e) => drawn.push(e.id) })
    fx.ingest([{ id: 1 }])
    fx.reset()
    fx.draw(ctx, 0, 0, 1, 0.01)
    expect(drawn).toEqual([])
  })
})
