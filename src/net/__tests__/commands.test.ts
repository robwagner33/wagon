import { describe, expect, it, vi } from 'vitest'
import { createCommandRegistry } from '../commands'

describe('createCommandRegistry', () => {
  it('runs a registered command with its args', () => {
    const reg = createCommandRegistry()
    const fn = vi.fn()
    reg.register('tp', fn)
    reg.run('tp', ['3', '4'])
    expect(fn).toHaveBeenCalledWith(['3', '4'])
  })

  it('ignores an unknown command (no throw)', () => {
    const reg = createCommandRegistry()
    expect(() => reg.run('nope', [])).not.toThrow()
  })

  it('replaces a command when the name is re-registered', () => {
    const reg = createCommandRegistry()
    const first = vi.fn()
    const second = vi.fn()
    reg.register('x', first)
    reg.register('x', second)
    reg.run('x', [])
    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledOnce()
  })
})
