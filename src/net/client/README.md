# wagon/net/client

Client-side reconstruction of authoritative state: turning delayed snapshots + local input into smooth,
responsive motion. Runs on the consumer, off the host's broadcast.

## What belongs here

Prediction/reconciliation, remote interpolation, error smoothing, and clock sync. All game-agnostic — the
game supplies its deterministic step function and payload shapes via type parameters.

## Files

- `predict.ts` — `createPredictor`/`createSelfPredictor` + un-acked-input replay and the remote sample buffer.
- `interpolate.ts` — Catmull-Rom sampling of a snapshot buffer into smooth remote motion.
- `remotes.ts` — `createRemoteSet`: per-entity remote sample sets with attached metadata.
- `smooth.ts` — `createErrorSmoother`: eases a reconcile correction onto the render position.
- `clock.ts` — local↔server clock offset + adaptive jitter/playout delay.
