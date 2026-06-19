/** A host-side command body. Receives the whitespace-split args after the name. */
export type CommandFn = (args: string[]) => void

export interface CommandRegistry {
  /** Register (or replace) a command by name. */
  register(name: string, fn: CommandFn): void
  /** Run a registered command; a no-op if the name is unknown. */
  run(name: string, args: string[]): void
}

/**
 * A name → handler map for host-side commands — the authority-side mirror of the dev console's client-side
 * registry. A game routes its `{ t: 'cmd' }` messages here, and engine-general commands can register too as
 * the engine grows. Unknown names are ignored so a stale client can't crash the host.
 */
export function createCommandRegistry(): CommandRegistry {
  const commands = new Map<string, CommandFn>()
  return {
    register: (name, fn) => {
      commands.set(name, fn)
    },
    run: (name, args) => commands.get(name)?.(args),
  }
}
