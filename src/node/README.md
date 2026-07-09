# wagon/node

Node-only server/dev helpers that import Node builtins (`node:fs`, etc.). Kept in their own subpath so the
Node boundary is explicit — a browser bundle that pulls `wagon/net` (isomorphic) never drags a Node builtin in,
which breaks the build. Import `wagon/node` only from server/dev code.

## What belongs here

Small, game-agnostic Node infrastructure: file watching, and future server-side dev tooling that touches the
filesystem or process. If it must run in the browser, it does not belong here.

## Files

- `watch.ts` — `watchFileDebounced(path, debounceMs, onChange)`: a trailing-debounced `fs.watch`, returning a disposer.
