/** Transport event names shared by host and client — single source of truth so the two never desync. */
export const Events = {
  /** Host → clients: the authoritative world snapshot, once per tick. */
  StateUpdate: 'state:update',
  /** Client → host: one sequenced movement input. */
  Input: 'input',
  /** Client → host: a typed, non-input action (commands, gameplay actions). See the game's `TMsg`. */
  Message: 'message',
  /** Host → clients: a typed one-shot event outside the state stream (results, kill feed). See the game's `TEvent`. */
  Event: 'event',
} as const
