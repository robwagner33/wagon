/**
 * Device controls: keyboard + mouse bindings behind a small factory, the client counterpart to the server's
 * input handling. The game passes a binding map (which keys move, which button/keys fire) and gets back
 * `direction`/`pointer`/`primary`/`alt` polls plus rising-edge named `actions`. Listeners attach on create
 * against an injected `target` (default `window`), not at import time — so it's testable and disposable, and a
 * rebind is just a different binding map. Game-agnostic: no action names or keys are baked in.
 */

/** How a boolean control (primary/alt) is bound: mouse buttons and/or keys, either of which activates it. */
export interface KeyBinding {
  keys?: string[]
  buttons?: number[]
}

/** The full binding map for a {@link Controls} instance. */
export interface ControlBindings {
  /** Movement keys per direction — each axis is (positive keys held) minus (negative keys held). */
  move: { up: string[]; down: string[]; left: string[]; right: string[] }
  primary: KeyBinding
  alt: KeyBinding
  /** Rising-edge named actions (key → action name); each press fires the action once. */
  actions?: Record<string, string[]>
  /** Suppress the browser context menu, so a right-click button binding is free to fire. */
  suppressContextMenu?: boolean
}

/** The minimum event surface controls need — `window` satisfies it; a fake can be injected for tests. */
export interface InputTarget {
  addEventListener(type: string, listener: (e: any) => void): void
  removeEventListener(type: string, listener: (e: any) => void): void
  innerWidth: number
  innerHeight: number
}

/** A live controls instance bound to one target + binding map. */
export interface Controls {
  /** Current move direction, each axis in [-1, 1]. */
  direction(): { dx: number; dy: number }
  /** Current aim position in the target's client pixels (starts centered). */
  pointer(): { x: number; y: number }
  /** Whether the primary control is held. */
  primary(): boolean
  /** Whether the alt control is held. */
  alt(): boolean
  /** Register a callback fired on each press of a named action's key(s). */
  onAction(name: string, cb: () => void): void
  /** Detach every listener from the target. */
  dispose(): void
}

/** Create a {@link Controls} instance, attaching listeners to `target` (default `window`) immediately. */
export function createControls(bindings: ControlBindings, target: InputTarget = window): Controls {
  const held = new Set<string>()
  const pointerPos = { x: target.innerWidth / 2, y: target.innerHeight / 2 }
  let primaryMouse = false
  let altMouse = false
  const actionHandlers = new Map<string, Set<() => void>>()

  const anyHeld = (keys?: string[]): boolean => !!keys && keys.some((k) => held.has(k))
  const fireAction = (name: string): void => {
    const handlers = actionHandlers.get(name)
    if (handlers) for (const cb of handlers) cb()
  }

  const onKeyDown = (e: KeyboardEvent): void => {
    held.add(e.key)
    if (e.repeat || !bindings.actions) return
    for (const name in bindings.actions) if (bindings.actions[name].includes(e.key)) fireAction(name)
  }
  const onKeyUp = (e: KeyboardEvent): void => void held.delete(e.key)
  const onMouseMove = (e: MouseEvent): void => {
    pointerPos.x = e.clientX
    pointerPos.y = e.clientY
  }
  const onMouseDown = (e: MouseEvent): void => {
    if (bindings.primary.buttons?.includes(e.button)) primaryMouse = true
    if (bindings.alt.buttons?.includes(e.button)) altMouse = true
  }
  const onMouseUp = (e: MouseEvent): void => {
    if (bindings.primary.buttons?.includes(e.button)) primaryMouse = false
    if (bindings.alt.buttons?.includes(e.button)) altMouse = false
  }
  const onContextMenu = (e: Event): void => e.preventDefault()

  target.addEventListener('keydown', onKeyDown)
  target.addEventListener('keyup', onKeyUp)
  target.addEventListener('mousemove', onMouseMove)
  target.addEventListener('mousedown', onMouseDown)
  target.addEventListener('mouseup', onMouseUp)
  if (bindings.suppressContextMenu) target.addEventListener('contextmenu', onContextMenu)

  return {
    direction() {
      const dx = Number(anyHeld(bindings.move.right)) - Number(anyHeld(bindings.move.left))
      const dy = Number(anyHeld(bindings.move.down)) - Number(anyHeld(bindings.move.up))
      return { dx, dy }
    },
    pointer() {
      return pointerPos
    },
    primary() {
      return primaryMouse || anyHeld(bindings.primary.keys)
    },
    alt() {
      return altMouse || anyHeld(bindings.alt.keys)
    },
    onAction(name, cb) {
      let handlers = actionHandlers.get(name)
      if (!handlers) actionHandlers.set(name, (handlers = new Set()))
      handlers.add(cb)
    },
    dispose() {
      target.removeEventListener('keydown', onKeyDown)
      target.removeEventListener('keyup', onKeyUp)
      target.removeEventListener('mousemove', onMouseMove)
      target.removeEventListener('mousedown', onMouseDown)
      target.removeEventListener('mouseup', onMouseUp)
      if (bindings.suppressContextMenu) target.removeEventListener('contextmenu', onContextMenu)
    },
  }
}
