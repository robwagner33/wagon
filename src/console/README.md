# wagon/console

A framework-agnostic, Quake-style dev console overlay. Backtick toggles it, Escape closes it; a game
registers commands and the player runs them by name.

## Intent

- **Dev tooling, not shipped UI.** Games construct it only in dev builds (e.g. gated on `import.meta.env.DEV`);
  it is never part of the production game UI.
- **Game owns the commands.** The console is just the overlay + dispatch; each game calls `register(name,
  …, handler)` for its own commands (hockey's `reset`, etc.). Engine-general commands can be registered too.
- **Depends on nothing but the DOM.** No game types, no networking — a command handler that needs the host
  (e.g. `reset`) is supplied by the game and reaches the host through `wagon/net`, not from here.

## Files

- `index.ts` — `createDevConsole`: command registration, parsing, dispatch, key handling.
- `overlay.ts` — the DOM overlay (log + input) and styling.
