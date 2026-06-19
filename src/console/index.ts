/**
 * Dev console: a Quake-style overlay for local builds. A game creates one, registers its commands, and the
 * player toggles it with the backtick key to run them. Framework-agnostic (plain DOM, no deps) so any wagon
 * game can reuse it — the game decides whether to construct it (e.g. only in dev builds) and what commands
 * exist. Engine-general commands can be registered here too as the engine grows.
 */

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

/** One-time stylesheet for the overlay — translucent dark bar pinned to the top, above the game canvas. */
const STYLE = `
.wagon-console { position: fixed; top: 0; left: 0; right: 0; z-index: 99999; display: none;
  flex-direction: column; max-height: 40vh; font: 13px/1.4 ui-monospace, Menlo, Consolas, monospace;
  background: rgba(12, 14, 20, 0.92); color: #d8dee9; border-bottom: 1px solid #3b4252; }
.wagon-console.open { display: flex; }
.wagon-console-log { overflow-y: auto; padding: 6px 8px; white-space: pre-wrap; }
.wagon-console-line { color: #d8dee9; }
.wagon-console-echo { color: #81a1c1; }
.wagon-console-error { color: #bf616a; }
.wagon-console-input { border: 0; outline: 0; padding: 6px 8px; background: rgba(0, 0, 0, 0.3);
  color: #eceff4; font: inherit; border-top: 1px solid #3b4252; }
`

/** Build the dev console overlay and wire its key handling. Call once; the game keeps the returned handle. */
export function createDevConsole(): DevConsole {
  const commands = new Map<string, Command>()
  const { root, log, input } = buildOverlay()

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
    const trimmed = line.trim()
    if (!trimmed) return
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

/** Create the overlay DOM (style injected once) and return its parts. */
function buildOverlay(): { root: HTMLDivElement; log: HTMLDivElement; input: HTMLInputElement } {
  if (!document.getElementById('wagon-console-style')) {
    const style = document.createElement('style')
    style.id = 'wagon-console-style'
    style.textContent = STYLE
    document.head.appendChild(style)
  }

  const root = document.createElement('div')
  root.className = 'wagon-console'

  const log = document.createElement('div')
  log.className = 'wagon-console-log'

  const input = document.createElement('input')
  input.className = 'wagon-console-input'
  input.spellcheck = false
  input.autocomplete = 'off'
  input.setAttribute('aria-label', 'dev console')

  root.appendChild(log)
  root.appendChild(input)
  document.body.appendChild(root)
  return { root, log, input }
}
