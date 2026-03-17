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

## 6. Country placement using theoretical lat/lon math instead of empirical map data
**What happened:** Placed European countries at tile coordinates calculated from latitude/longitude formulas: `y = (90 - lat) * (1080/180)`. This assumed (a) the original 2160×1080 map covered exactly 90°N to 90°S, and (b) the user's crop only removed rows from the bottom. Both assumptions were wrong — the crop also trimmed the Arctic from the top, shifting all y coordinates. The PIL verification only checked if coordinates landed on "plains" terrain, which they did — but on African plains, not European ones.
**Fix:** Scanned the map empirically for known geographic features (British Isles as isolated land mass, Mediterranean as water gap, vertical terrain profiles) to determine actual tile positions.
**Lesson:** When working with a cropped/transformed map of unknown provenance, never rely on theoretical coordinate math. Always verify positions empirically by identifying recognizable geographic features in the actual image data. When verifying coordinates, check geographic *context* (what's nearby), not just terrain type.

## 7. Rebuilding pixel buffers every frame instead of on change
**What happened:** TerritoryLayer, BorderLayer, and CityLayer all rebuilt their entire 2160×784 pixel buffers (1.7M tiles + BFS) on every render frame at 60fps. This caused visible jitter and frame drops.
**Fix:** Added dirty flag pattern to all three layers — only rebuild when `markDirty()` is called (once per game tick). Later moved simulation entirely to a Web Worker so even the tick computation doesn't block rendering.
**Lesson:** Expensive buffer rebuilds should be gated by dirty flags, not run every frame. For tile-based games, consider Web Workers for simulation early — the main thread should only handle rendering and input.

## 8. Smoothing-based camera panning felt sluggish
**What happened:** First attempt at fixing arrow key panning used a fixed pixel step (12px/frame). Second attempt added velocity smoothing with low acceleration (8) and friction (6), which felt floaty and laggy.
**Fix:** Increased acceleration to 25 and friction to 20 for near-instant response. Also scaled speed by camera zoom so panning feels consistent at all zoom levels.
**Lesson:** For direct-input camera controls, minimize smoothing. High accel/friction values (snappy response) feel better than low values (floaty). Always scale pan speed by zoom.
