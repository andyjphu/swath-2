# Swath — Claude Code Instructions

## What is Swath?
A single-player browser-based territory conquest game. Start from medieval Europe, expand to world conquest. OpenFront-inspired tile expansion, citizen-driven economy, mission-based tech progression, front-based war system.

## Tech Stack
- **Vite + TypeScript** (strict mode)
- **HTML5 Canvas 2D** with pixel-buffer rendering (OffscreenCanvas at 1px/tile, scaled up with `imageSmoothingEnabled = false`)
- **Typed arrays** (Uint8Array, Uint16Array) for tile data
- requestAnimationFrame game loop with accumulator pattern

## Project Layout
- `/` — Game entry point, loads map from `public/world-1.0.5.png`
- `/editor/` — Map editor (separate Vite page), generates from heightmap/DEM source images
- `src/main.ts` — Game entry
- `src/editor.ts` — Editor entry
- `src/map/MapLoader.ts` — Loads terrain from saved PNG
- `src/map/WorldMapGen.ts` — Generates terrain from heightmap.png + earthbump.jpg (editor only)
- `src/map/MapFilters.ts` — Terrain filters (smooth coast, remove islands, etc.)
- `src/ui/MapEditor.ts` — Full editor UI (paint, filters, crop, save/load)
- Editor source images live in `editor/assets/` (not `public/`)

## Key Patterns
- **Config.MAP_WIDTH/MAP_HEIGHT are mutable** — they change on map crop/load. Always read from `tileMap.width`/`tileMap.height` for current dimensions, not Config globals.
- **TerrainLayer** uses a dirty flag — call `markDirty()` after terrain changes.
- **RiverSystem** indexes by `y * Config.MAP_WIDTH + x` — breaks after crop if not cleared.
- Terrain types: WATER=0, PLAINS=1, FOREST=2, HILLS=3, MOUNTAINS=4, FARMLAND=5, URBAN=6

## Current State
- Prompts 1A and 1B are complete (scaffold, map, terrain rendering)
- Map editor is complete and available at `/editor/`
- Base world map is `public/world-1.0.5.png` (2160x784 tiles)
- Next: Prompt 2A — Countries, Cities & Territory System

## Build & Run
```bash
npm run dev     # Start dev server
npx tsc --noEmit  # Type-check without emitting
npm run build   # Production build
```
