/**
 * DOM and styling for the dev console overlay. Kept separate from the command/dispatch logic so the view
 * lives in one place. Styles are an injected stylesheet string (not a .css file) so wagon stays dep-free and
 * needs no bundler — consumers import the raw TS.
 */

/** Parts of the overlay the console logic drives. */
export interface Overlay {
  root: HTMLDivElement
  log: HTMLDivElement
  input: HTMLInputElement
}

/** Stylesheet for the overlay — translucent dark bar pinned to the top, above the game canvas. */
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

/** Inject the stylesheet once, keyed by id so repeated console creation doesn't duplicate it. */
function injectStyle(): void {
  if (document.getElementById('wagon-console-style')) return
  const style = document.createElement('style')
  style.id = 'wagon-console-style'
  style.textContent = STYLE
  document.head.appendChild(style)
}

/** Create the overlay DOM (style injected once), append it to the body, and return its parts. */
export function buildOverlay(): Overlay {
  injectStyle()

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
