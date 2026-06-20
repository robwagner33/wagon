import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createDevConsole } from '../index'

// wagon stays dep-free, so there's no jsdom in tests. The console only touches a tiny slice of the DOM, so
// we stub exactly that slice: enough to build the overlay, dispatch keydowns, and read back the log lines.

interface FakeEl {
  tagName: string
  id: string
  className: string
  textContent: string
  value: string
  spellcheck: boolean
  autocomplete: string
  children: FakeEl[]
  classList: { add(c: string): void; remove(c: string): void; contains(c: string): boolean }
  appendChild(c: FakeEl): FakeEl
  remove(): void
  focus(): void
  blur(): void
  setAttribute(k: string, v: string): void
  addEventListener(type: string, fn: (e: unknown) => void): void
  dispatch(type: string, e: unknown): void
  scrollTop: number
  scrollHeight: number
  removed: boolean
}

function makeEl(tagName: string): FakeEl {
  const classes = new Set<string>()
  const listeners: Record<string, (e: unknown) => void> = {}
  const el: FakeEl = {
    tagName,
    id: '',
    className: '',
    textContent: '',
    value: '',
    spellcheck: true,
    autocomplete: '',
    children: [],
    scrollTop: 0,
    scrollHeight: 100,
    removed: false,
    classList: {
      add: (c) => void classes.add(c),
      remove: (c) => void classes.delete(c),
      contains: (c) => classes.has(c),
    },
    appendChild(c) {
      el.children.push(c)
      return c
    },
    remove() {
      el.removed = true
    },
    focus() {},
    blur() {},
    setAttribute() {},
    addEventListener(type, fn) {
      listeners[type] = fn
    },
    dispatch(type, e) {
      listeners[type]?.(e)
    },
  }
  return el
}

let allEls: FakeEl[]
let windowListeners: Record<string, (e: unknown) => void>

function installFakeDom() {
  allEls = []
  windowListeners = {}
  const head = makeEl('head')
  const body = makeEl('body')
  const doc = {
    head,
    body,
    createElement: (tag: string) => {
      const el = makeEl(tag)
      allEls.push(el)
      return el
    },
    getElementById: (id: string) => allEls.find((e) => e.id === id && !e.removed) ?? null,
  }
  const win = {
    addEventListener: (type: string, fn: (e: unknown) => void) => void (windowListeners[type] = fn),
    removeEventListener: (type: string) => void delete windowListeners[type],
  }
  globalThis.document = doc as unknown as Document
  globalThis.window = win as unknown as Window & typeof globalThis
  return { doc, win, body }
}

/** Let the async `run()` settle so its log output is observable. */
const flush = () => new Promise<void>((r) => setTimeout(r, 0))

const keydown = (key: string) => ({ key, preventDefault() {} })

describe('createDevConsole', () => {
  let body: FakeEl
  let root: FakeEl
  let logEl: FakeEl
  let inputEl: FakeEl

  beforeEach(() => {
    body = installFakeDom().body
    createDevConsole()
    root = body.children[0]
    logEl = root.children.find((c) => c.className === 'wagon-console-log')!
    inputEl = root.children.find((c) => c.className === 'wagon-console-input')!
  })

  afterEach(() => {
    delete (globalThis as { document?: unknown }).document
    delete (globalThis as { window?: unknown }).window
  })

  const lines = () => logEl.children.map((c) => c.textContent)

  async function enter(line: string) {
    inputEl.value = line
    inputEl.dispatch('keydown', keydown('Enter'))
    await flush()
  }

  it('ignores a blank line without echoing or logging', async () => {
    await enter('   ')
    expect(lines()).toEqual([])
  })

  it('echoes the entry and reports an unknown command', async () => {
    await enter('nope')
    expect(lines()).toEqual(['> nope', 'unknown command: nope'])
  })

  it('logs a string returned by a command handler', async () => {
    const console = createDevConsole()
    // Rebind to the freshly built overlay so we read the right log.
    root = body.children[1]
    logEl = root.children.find((c) => c.className === 'wagon-console-log')!
    inputEl = root.children.find((c) => c.className === 'wagon-console-input')!
    console.register('ping', { description: 'pong it' }, () => 'pong')
    await enter('ping')
    expect(lines()).toEqual(['> ping', 'pong'])
  })

  it('catches a thrown error and logs its message', async () => {
    const console = createDevConsole()
    root = body.children[1]
    logEl = root.children.find((c) => c.className === 'wagon-console-log')!
    inputEl = root.children.find((c) => c.className === 'wagon-console-input')!
    console.register('boom', { description: 'throws' }, () => {
      throw new Error('kaboom')
    })
    await enter('boom')
    expect(lines()).toEqual(['> boom', 'error: kaboom'])
  })

  it('lists registered commands via the built-in help', async () => {
    const console = createDevConsole()
    root = body.children[1]
    logEl = root.children.find((c) => c.className === 'wagon-console-log')!
    inputEl = root.children.find((c) => c.className === 'wagon-console-input')!
    console.register('aaa', { description: 'first' }, () => {})
    await enter('help')
    expect(lines()[1]).toContain('aaa — first')
    expect(lines()[1]).toContain('help — List available commands')
  })

  it('toggles the open class on the backtick key', () => {
    expect(root.classList.contains('open')).toBe(false)
    windowListeners.keydown(keydown('`'))
    expect(root.classList.contains('open')).toBe(true)
    windowListeners.keydown(keydown('`'))
    expect(root.classList.contains('open')).toBe(false)
  })

  it('removes the key listener and overlay on destroy', () => {
    const console = createDevConsole()
    const freshRoot = body.children[1]
    console.destroy()
    expect(freshRoot.removed).toBe(true)
    expect(windowListeners.keydown).toBeUndefined()
  })
})
