import { describe, expect, it } from 'vitest'
import { SpriteSheet, type Atlas } from './spritesheet'

describe('SpriteSheet lookups', () => {
  const atlas: Atlas = { hero: { x: 0, y: 0, w: 16, h: 24 } }
  // The image is never touched by has()/rect(), so a bare stand-in is enough.
  const sheet = new SpriteSheet({} as HTMLImageElement, atlas)

  it('has() reports whether a sprite name is defined', () => {
    expect(sheet.has('hero')).toBe(true)
    expect(sheet.has('missing')).toBe(false)
  })

  it('rect() returns the source rect for a known sprite', () => {
    expect(sheet.rect('hero')).toEqual({ x: 0, y: 0, w: 16, h: 24 })
  })

  it('rect() returns null for an unknown sprite', () => {
    expect(sheet.rect('missing')).toBeNull()
  })
})
