# wagon/input

Client-side device controls — keyboard + mouse behind a rebindable factory. The browser-facing counterpart to
the server's input jitter buffer in `net`. No game concepts: the game supplies the binding map and action
names; nothing here is baked in.

## What belongs here

Input-device reading that any top-down game needs: directional movement, an aim pointer, held primary/alt
controls, and rising-edge named actions — all bound through an injected event target so it's testable and
disposable, never a module-load side-effect. Gamepad/controller support, when added, belongs here alongside
`createControls`.

## Files

- `controls.ts` — `createControls(bindings, target?)` → `{ direction, pointer, primary, alt, onAction, dispose }`.
