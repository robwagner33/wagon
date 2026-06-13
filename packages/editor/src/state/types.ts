// The canonical map schema lives in @wagon/core (consumed by every game too). Re-exported here so the
// editor's `../state/types` imports keep working against one local module.
export type {
  Layer,
  LayerType,
  MapDoc,
  MapObject,
  ObjectLayer,
  PlacedTile,
  TileId,
  TileLayer,
  Wall,
  WallArc,
  WallSegment,
} from '@wagon/core'
