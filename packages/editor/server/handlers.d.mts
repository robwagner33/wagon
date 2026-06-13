import type { IncomingMessage, ServerResponse } from 'node:http'

/** Route a wagon API/asset request against `wagonDir`. Returns true if handled, false to fall through. */
export function handleWagon(req: IncomingMessage, res: ServerResponse, wagonDir: string): boolean
