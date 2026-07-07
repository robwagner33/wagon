# wagon/map

The map/tilemap **schema + static tile data** — what a map *is*, not how it's simulated or drawn. Pure data
shapes plus queries derived directly from them; no per-tick logic.

## What belongs here

The `MapDoc` shape and everything computed purely from it — tile layers, placed objects, atlas-cell ids,
per-tile collision and bounds queries, the wall schema. No motion, no physics, no rendering.

## Files

- `map.ts` — `MapDoc` + layer/wall schema and read queries (`collisionAt`, `inBounds`, `tileLayers`, `mapObjects`, `objectsWithDefPrefix`, `objectCenter`).
- `objects.ts` — `MapObjectDef`: the editor palette definition for a placeable object.
- `atlas.ts` — atlas-cell id parse/format + source-rect math (`parseCell`, `formatCell`, `atlasRect`).
