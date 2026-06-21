/**
 * Dev console: a Quake-style overlay for local builds. A game creates one, registers its commands, and the
 * player toggles it with the backtick key to run them. Framework-agnostic (plain DOM, no deps) so any wagon
 * game can reuse it — the game decides whether to construct it (e.g. only in dev builds) and what commands
 * exist. Engine-general commands can be registered here too as the engine grows. The overlay DOM and styling
 * live in ./overlay; this file holds command registration and dispatch.
 */

import { buildOverlay } from './overlay'

/** A command body. Receives the whitespace-split args after the name; a returned string is logged. */
export type CommandHandler = (args: string[]) => void | string | Promise<void | string>

interface Command {
  description: string
  handler: CommandHandler
}

export interface DevConsole {
  /** Register a command by name (re-registering a name replaces it). */
  register(name: string, opts: { description: string }, handler: CommandHandler): void
  open(): void
  close(): void
  toggle(): void
  /** Remove the overlay and key listener. */
  destroy(): void
}

/** The key that toggles the console. Backtick is the convention and sits out of the movement keys. */
const TOGGLE_KEY = '`'

/** Build the dev console overlay and wire its key handling. Call once; the game keeps the returned handle. */
export function createDevConsole(): DevConsole {
  const commands = new Map<string, Command>()
  const { root, log, input } = buildOverlay()
  let lastCommand = ''

  function open(): void {
    root.classList.add('open')
    input.focus()
  }

  function close(): void {
    root.classList.remove('open')
    input.blur()
  }

  function toggle(): void {
    if (root.classList.contains('open')) close()
    else open()
  }

  /** Append one line to the scrolling log, tagged for colour, and keep the newest line in view. */
  function print(text: string, kind: 'line' | 'echo' | 'error' = 'line'): void {
    const line = document.createElement('div')
    line.className = `wagon-console-${kind}`
    line.textContent = text
    log.appendChild(line)
    log.scrollTop = log.scrollHeight
  }

  /** Parse and run one entered line: echo it, dispatch by command name, log the result or error. */
  async function run(line: string): Promise<void> {
    let trimmed = line.trim()
    if (!trimmed) return
    if (trimmed === '!!') {
      if (!lastCommand) {
        print(`> !!`, 'echo')
        print('no previous command', 'error')
        return
      }
      trimmed = lastCommand
    }
    lastCommand = trimmed
    print(`> ${trimmed}`, 'echo')
    const [name, ...args] = trimmed.split(/\s+/)
    const command = commands.get(name)
    if (!command) {
      print(`unknown command: ${name}`, 'error')
      return
    }
    try {
      const result = await command.handler(args)
      if (typeof result === 'string') print(result)
    } catch (err) {
      print(`error: ${err instanceof Error ? err.message : String(err)}`, 'error')
    }
  }

  input.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return
    e.preventDefault()
    const line = input.value
    input.value = ''
    void run(line)
  })

  function onKey(e: KeyboardEvent): void {
    if (e.key === TOGGLE_KEY) {
      e.preventDefault()
      toggle()
    } else if (e.key === 'Escape' && root.classList.contains('open')) {
      close()
    }
  }
  window.addEventListener('keydown', onKey)

  function register(name: string, opts: { description: string }, handler: CommandHandler): void {
    commands.set(name, { description: opts.description, handler })
  }

  // Built-in: list every registered command so the player can discover what's available.
  register('help', { description: 'List available commands' }, () => {
    const names = [...commands.keys()].sort()
    return names.map((name) => `${name} — ${commands.get(name)!.description}`).join('\n')
  })

  return {
    register,
    open,
    close,
    toggle,
    destroy: () => {
      window.removeEventListener('keydown', onKey)
      root.remove()
    },
  }
}
