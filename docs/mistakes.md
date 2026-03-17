# Mistakes Log

Track mistakes made during development to avoid repeating them.

---

## 1. River color too close to water color in save/load
**What happened:** The save function encoded rivers as `#2a509a` and the load function detected rivers with a ±15 tolerance. The actual water terrain color `#2d5a8e` fell within that tolerance (diffs: 3, 10, 12). Loading any saved map flagged every water pixel as a river — 1.1M false river tiles.
**Fix:** Use exact color match for river detection in loadMap. Also add `terrain !== TerrainType.WATER` check in saveMap (matching what TerrainLayer already does).
**Lesson:** When using color-based encoding/decoding, ensure distinct colors have sufficient distance. Prefer exact matching over tolerance-based matching for discrete categories.

## 2. imageSmoothingEnabled defaulting to true in sampleImage
**What happened:** When downscaling heightmap.png and earthbump.jpg to tile resolution, the canvas context used default bilinear interpolation. This created anti-aliased coastline pixels with intermediate brightness values, causing misclassified terrain at coast edges (fringes of plains around every coastline).
**Fix:** Set `ctx.imageSmoothingEnabled = false` before `drawImage` in the `sampleImage` function.
**Lesson:** Always set `imageSmoothingEnabled = false` when doing pixel-accurate image sampling for terrain/data purposes.

## 3. RiverSystem.index() uses Config.MAP_WIDTH
**What happened:** RiverSystem computes tile indices as `y * Config.MAP_WIDTH + x`. After a crop changes MAP_WIDTH, old indices in the Set become invalid — `isRiver()` returns incorrect results for the new grid.
**Fix:** Clear rivers after crop. Long-term: store river data relative to tileMap dimensions, not Config globals.
**Lesson:** Avoid using mutable globals (Config.MAP_WIDTH) for index computation in persistent data structures. Prefer reading from the data source (tileMap.width).

## 4. Crop overlay clearRect not covering full DPR-scaled canvas
**What happened:** `clearCropOverlay()` used `this.canvas.clientWidth/Height` but the overlay canvas had DPR-scaled pixel dimensions. With the DPR transform active the clear nominally worked, but edge cases could leave ghost pixels.
**Fix:** Reset transform to identity, clear using actual `canvas.width/height` pixel dimensions, then restore. Also hide the overlay entirely (`display:none`) when not in crop mode.
**Lesson:** When clearing canvases with DPR scaling, reset the transform first and use the actual pixel buffer dimensions.

## 5. MapFilters reading module-level W/H constants
**What happened:** Early filter implementations captured `Config.MAP_WIDTH/HEIGHT` at module scope. After a crop changed these values, the filters used stale dimensions, corrupting terrain data.
**Fix:** All filters now read `tileMap.width` and `tileMap.height` from the tileMap instance parameter.
**Lesson:** Never cache mutable config values at module scope. Always read from the authoritative source at call time.
