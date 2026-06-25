/**
 * A generic in-memory room registry: many independent games in one process, each keyed by a short join code
 * and owning its own authoritative world. This is the engine-general *box and bookkeeping* — code generation,
 * membership, and host/empty cleanup — with no notion of what a game's world holds or what a member means
 * beyond an id + display name. A game layers its policy (teams, seats, balancing) on top by extending
 * {@link Member} and wrapping `register`.
 *
 * The registry holds no clock and never activates a world: callers build a room (with its world already
 * constructed) and `register` it; the host loop ({@link runRoomHost}) is what swaps the active world per tick.
 */

/** The engine-level identity of someone in a room — an opaque id plus a display name. Games extend this. */
export interface Member {
  id: string
  name: string
}

/** A room's lifecycle phase: gathering in the lobby, or live in play. The game advances it. */
export type RoomPhase = 'lobby' | 'playing'

/** A live game: its join code, host, phase, authoritative world, tick clock, and roster of members. */
export interface Room<TWorld, TMember extends Member = Member> {
  code: string
  hostId: string
  phase: RoomPhase
  world: TWorld
  /** Monotonic tick counter for this room's snapshots (each room runs its own clock). */
  tick: number
  createdAt: number
  members: TMember[]
}

/**
 * The registry surface: code generation, lookups, the tick/cleanup work-lists, and member removal. Generic
 * over the *full* room type so a game that extends {@link Room} (e.g. with a per-room map) gets that exact
 * type back from every lookup.
 */
export interface RoomRegistry<TRoom extends Room<unknown, Member>> {
  /** A fresh, collision-free join code. */
  genCode(): string
  /** Store a fully-built room under its code. */
  register(room: TRoom): void
  /** The room with the given code, or undefined. */
  get(code: string): TRoom | undefined
  /** The room a player currently belongs to (by membership), or undefined. */
  roomOf(playerId: string): TRoom | undefined
  /** Every room in the playing phase — the tick loop's work-list. */
  playing(): TRoom[]
  /** Every room — e.g. for a dev map hot-reload sweep. */
  all(): TRoom[]
  /**
   * Remove a player from whatever room they're in, returning that room (or null if in none). Deletes the room
   * outright if the host leaves (no host migration yet) or if it empties. Touches only the roster + registry —
   * pulling the player out of a *playing* world is the caller's job first.
   */
  removeMember(id: string): { room: TRoom; deleted: boolean } | null
  /** Drop every room — test isolation. */
  clear(): void
}

/** Default code alphabet — uppercase minus I and O, so a code never reads ambiguously against 1/0. */
const DEFAULT_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
const DEFAULT_CODE_LENGTH = 4

/** A fresh registry. `alphabet`/`codeLength` tune the join codes; the type arg fixes the (possibly extended) room shape. */
export function createRoomRegistry<TRoom extends Room<unknown, Member>>(opts?: {
  alphabet?: string
  codeLength?: number
}): RoomRegistry<TRoom> {
  const alphabet = opts?.alphabet ?? DEFAULT_ALPHABET
  const codeLength = opts?.codeLength ?? DEFAULT_CODE_LENGTH
  const rooms = new Map<string, TRoom>()

  function genCode(): string {
    for (;;) {
      let code = ''
      for (let i = 0; i < codeLength; i++) code += alphabet[Math.floor(Math.random() * alphabet.length)]
      if (!rooms.has(code)) return code
    }
  }

  function roomOf(playerId: string): TRoom | undefined {
    for (const room of rooms.values()) if (room.members.some((m) => m.id === playerId)) return room
    return undefined
  }

  function removeMember(id: string): { room: TRoom; deleted: boolean } | null {
    const room = roomOf(id)
    if (!room) return null
    room.members = room.members.filter((m) => m.id !== id)
    const deleted = id === room.hostId || room.members.length === 0
    if (deleted) rooms.delete(room.code)
    return { room, deleted }
  }

  return {
    genCode,
    register: (room) => {
      rooms.set(room.code, room)
    },
    get: (code) => rooms.get(code),
    roomOf,
    playing: () => [...rooms.values()].filter((r) => r.phase === 'playing'),
    all: () => [...rooms.values()],
    removeMember,
    clear: () => rooms.clear(),
  }
}
