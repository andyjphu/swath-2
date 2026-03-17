# SWATH — Build Plan & Prompt Sequence

## Game Summary

**Swath** is a single-player browser-based territory conquest game starting in medieval Europe and expanding to world conquest. Players expand from a small settlement through OpenFront-style tile expansion, citizen-driven economic growth, mission-based technological progression (peasant huts → mercantile hubs → industrial powerhouses with musketeers), and a front-based war system with stability-limited annexation. The game uses a real-world map derived from heightmap/DEM data. AI European countries are the initial opponents; world expansion comes later. Target session length: ~30 minutes. Target platform: itch.io / Steam (via Electron wrapper later).

---

## Technical Foundation

- **Stack**: Vite + TypeScript, multi-file project
- **Rendering**: HTML5 Canvas 2D, layered renderer (OpenFront pattern)
- **Simulation**: Client-side tick-based (200ms ticks), speed controls (pause/1×/2×/5×)
- **Map**: World map (2160×784 tiles from heightmap/DEM), loaded from PNG bitmap at runtime
- **Map Editor**: Separate page at `/editor/` for terrain painting, filters, crop, save/load
- **Save**: localStorage + JSON file export/import
- **Performance**: Dirty-flag rendering (rebuild buffers on tick, not per frame), velocity-based camera panning. Future: incremental tile updates, viewport-culled putImageData, Web Worker simulation (see 7A, 8B)

---

## Project Structure

```
swath/
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── src/
│   ├── main.ts                      # Entry point
│   ├── core/
│   │   ├── GameLoop.ts              # requestAnimationFrame + fixed tick
│   │   ├── GameState.ts             # Central state container
│   │   ├── Config.ts                # Game constants, balance values
│   │   ├── EventBus.ts              # Pub/sub for decoupled systems
│   │   └── SaveManager.ts           # Serialize/deserialize game state
│   ├── map/
│   │   ├── TileMap.ts               # Typed arrays for tile data (with crop support)
│   │   ├── Terrain.ts               # Terrain types, costs, fertility
│   │   ├── ProvinceMap.ts           # Historical province overlay
│   │   ├── RiverSystem.ts           # River tiles + fertility bonus
│   │   ├── WorldMapGen.ts           # Generate terrain from heightmap + DEM (editor only)
│   │   ├── MapLoader.ts             # Load terrain from saved PNG bitmap
│   │   └── MapFilters.ts            # Terrain smoothing, island removal, etc.
│   ├── entities/
│   │   ├── Country.ts               # Player/AI nation state
│   │   ├── City.ts                  # Village/Town/Metropolis + buildings
│   │   ├── Building.ts              # Building types, costs, effects
│   │   └── Population.ts            # Pop growth, manpower, food
│   ├── systems/
│   │   ├── TerritorySystem.ts       # Border expansion, tile claiming
│   │   ├── CombatSystem.ts          # Attrition + siege at borders
│   │   ├── FrontSystem.ts           # War front detection + troop distribution
│   │   ├── EconomySystem.ts         # Gold, food, production, trade
│   │   ├── CityGrowthSystem.ts      # Auto-spread, upgrades, farmland
│   │   ├── StabilitySystem.ts       # Conquest penalty, tech bonus
│   │   ├── DiplomacySystem.ts       # War, peace, trade agreements
│   │   ├── ProgressionSystem.ts     # Mission checks, advancement unlocks
│   │   └── AISystem.ts              # AI decision-making per country
│   ├── rendering/
│   │   ├── GameRenderer.ts          # Layer orchestrator + render loop
│   │   ├── Camera.ts                # Pan, zoom, screen↔world coords
│   │   ├── layers/
│   │   │   ├── TerrainLayer.ts      # Base terrain (flat at zoom-out)
│   │   │   ├── TerritoryLayer.ts    # Player color overlay (pixel buffer)
│   │   │   ├── CityLayer.ts         # Urban tiles (gray) + farm tiles (green patchwork)
│   │   │   ├── BuildingLayer.ts     # Sprite icons at zoom-in
│   │   │   ├── FrontLayer.ts        # War front lines visualization
│   │   │   ├── BorderLayer.ts       # Country borders
│   │   │   └── UIOverlayLayer.ts    # Selection highlights, hover info
│   │   └── SpriteSheet.ts           # Simple sprite atlas for buildings
│   ├── ui/
│   │   ├── TopBar.ts                # Resources, time controls (DOM overlay)
│   │   ├── BottomBar.ts             # Context actions
│   │   ├── CityPanel.ts             # Building, tax, investment projects
│   │   ├── WarGoalView.ts           # Province selection (lasso/click/province)
│   │   ├── DiplomacyPanel.ts        # War/peace/trade UI
│   │   ├── PauseMenu.ts            # Pause, settings, key rebinds
│   │   ├── Minimap.ts               # Bottom-corner minimap
│   │   └── Notifications.ts         # Event toasts
│   └── input/
│       ├── InputHandler.ts          # Mouse/keyboard event routing
│       ├── KeyBindings.ts           # Rebindable key config
│       └── LassoTool.ts             # Freehand selection for war goals
├── assets/
│   ├── europe-terrain.json          # Heightmap / terrain data
│   ├── europe-provinces.json        # Historical province boundaries
│   └── europe-rivers.json           # River tile positions
└── public/
    └── sprites/                     # Building/city icon sprites
```

---

## Prompt Sequence

Each prompt below is designed to be given to Claude Code (or a Claude chat session with computer use) as a self-contained build step. Prompts are ordered by dependency — each builds on the output of the previous ones. The prompt text is inside the fenced code block.

---

### Prompt 1A: Project Scaffold + Core Loop ✅ COMPLETE

**Goal**: Vite + TS project, game loop, event bus, config. Opens in browser with a blank canvas and working camera.

```
You are building "Swath", a single-player browser-based territory conquest game. This is prompt 1A of a multi-prompt build plan.

TASK: Set up the project scaffold and core game loop.

PROJECT SETUP:
- Vite + TypeScript, strict mode
- Create the directory structure under src/ with folders: core/, map/, entities/, systems/, rendering/, ui/, input/
- index.html with a single <canvas id="game"> and a <div id="ui-root"> overlay
- Minimal CSS: canvas fills viewport, ui-root is absolute overlay with pointer-events: none (children opt in)

CORE FILES TO IMPLEMENT:

1. src/core/Config.ts
   - Export a frozen Config object with:
     - TICK_MS: 200
     - TILE_SIZE: 4 (pixels per tile at zoom 1)
     - MAP_WIDTH: 800 (tiles)
     - MAP_HEIGHT: 600 (tiles)
     - SPEED_OPTIONS: [0, 1, 2, 5] (0 = paused)
   - All balance values will be added in later prompts

2. src/core/EventBus.ts
   - Typed pub/sub: on<T>(event: string, handler: (data: T) => void), emit<T>(event: string, data: T), off()
   - Single global instance export

3. src/core/GameState.ts
   - Central state container class
   - Holds: currentTick (number), speedMultiplier (number), isPaused (boolean)
   - Methods: getState(), reset()
   - Will be extended in later prompts to hold countries, cities, etc.

4. src/core/GameLoop.ts
   - requestAnimationFrame loop
   - Accumulator pattern: track elapsed time, consume in TICK_MS chunks (scaled by speedMultiplier)
   - Each tick: emit 'tick' event on EventBus
   - Each frame: emit 'render' event with delta time
   - Expose: start(), stop(), setSpeed(multiplier: number)

5. src/rendering/Camera.ts
   - Properties: panX, panY, zoom (default 1, range 0.15 to 6)
   - screenToWorld(sx, sy) → {x, y}
   - worldToScreen(wx, wy) → {x, y}
   - getTransform() → {panX, panY, zoom}
   - Zoom toward cursor (adjust pan so world point under cursor stays fixed)

6. src/rendering/GameRenderer.ts
   - Layer interface: { init(ctx), tick(state), render(ctx, camera), isWorldSpace: boolean }
   - Holds ordered Layer array
   - On 'render' event: clearRect, iterate layers, save/restore, apply camera transform for world-space layers
   - On 'tick' event: call layer.tick(state) on each layer
   - Handle canvas resize on window resize (set canvas.width/height to devicePixelRatio * clientWidth/Height, scale context)

7. src/input/InputHandler.ts
   - Attach to canvas: mousedown, mousemove, mouseup, wheel, contextmenu (prevent default)
   - Drag detection: track isDragging, feed dx/dy to Camera.onDrag()
   - Scroll: feed to Camera.onWheel()
   - Click (non-drag mouseup): emit 'tile-click' on EventBus with world tile coordinates
   - Right-click: emit 'tile-right-click'

8. src/main.ts
   - Create canvas context
   - Instantiate GameState, Camera, GameRenderer, InputHandler
   - Wire up EventBus listeners
   - Start game loop
   - For now, add a single placeholder layer that draws a checkerboard pattern so we can verify rendering + camera work

IMPORTANT:
- Every file should have proper TypeScript types, no 'any'
- Use ES module imports throughout
- Do NOT implement any game systems yet — just the scaffold
- The result should be: open in browser, see a checkerboard, pan with drag, zoom with scroll wheel, speed controls logged to console
```

---

### Prompt 1B: Tile Map + World Terrain ✅ COMPLETE

**Goal**: Tile data structure with typed arrays, Europe heightmap generation, terrain rendering layer.

```
You are continuing to build "Swath". This is prompt 1B. The project scaffold from 1A is complete.

TASK: Implement the tile map data structure and Europe terrain with a rendering layer.

FILES TO IMPLEMENT:

1. src/map/Terrain.ts
   - Enum TerrainType: WATER = 0, PLAINS = 1, FOREST = 2, HILLS = 3, MOUNTAINS = 4, FARMLAND = 5, URBAN = 6
   - TerrainConfig map: for each type, define { color: string, moveCost: number, fertility: number, passable: boolean }
     - WATER: #2d5a8e, cost 999, fertility 0, impassable
     - PLAINS: #7cad3e, cost 1, fertility 1.0
     - FOREST: #3d7a2a, cost 2, fertility 0.4
     - HILLS: #a89060, cost 3, fertility 0.3
     - MOUNTAINS: #8a8a8a, cost 999, fertility 0, impassable
     - FARMLAND: varies (patchwork greens), cost 1, fertility 2.0
     - URBAN: #6b6b6b, cost 1, fertility 0

2. src/map/TileMap.ts
   - Class TileMap with typed arrays:
     - terrain: Uint8Array (MAP_WIDTH * MAP_HEIGHT)
     - owner: Uint16Array (0 = unclaimed, player IDs start at 1)
     - building: Uint8Array (0 = none, building type IDs)
     - population: Uint16Array (per-tile pop for city tiles)
     - cityId: Uint16Array (which city this tile belongs to, 0 = none)
   - Methods: index(x,y), getTerrainAt(x,y), setOwner(x,y,id), isPassable(x,y), getTilesInRadius(x,y,r)
   - Neighbor iteration: getNeighbors(x,y) → array of {x,y} (4-directional)

3. src/map/RiverSystem.ts
   - Rivers stored as a Set of tile indices
   - isRiver(x,y): boolean
   - getRiverFertilityBonus(x,y): returns bonus based on distance to nearest river (1.5x adjacent, 1.2x 2 tiles away, 1.0x otherwise)
   - River data loaded from asset file

4. src/map/EuropeMapData.ts
   - Generate a Europe-shaped landmass on an 800x600 tile grid
   - Use a combination of:
     a. A hardcoded outline/silhouette of Europe (simplified polygon that defines land vs water)
     b. Simplex noise for terrain variation within the landmass
     c. Elevation thresholds: low = plains, medium-low + noise = forest, medium-high = hills, high = mountains
   - Key geographic features to approximate:
     - Iberian peninsula, Italian boot, Scandinavian peninsula, British Isles, Balkans
     - Alps, Pyrenees, Carpathians as mountain ranges
     - Major rivers: Rhine, Danube, Seine, Thames, Vistula (as river tiles)
   - Export a function generateEuropeMap(tileMap: TileMap, rivers: RiverSystem): void
   - The map should look recognizably like Europe from a distance
   - Use the 'simplex-noise' npm package for noise generation

5. src/map/ProvinceMap.ts
   - Provinces are named regions overlaid on tiles (like EU4 provinces)
   - Province interface: { id: number, name: string, tiles: Set<number>, center: {x,y} }
   - Load from a JSON asset that defines ~80-120 provinces covering all of Europe
   - Each province has a center tile and a rough boundary
   - getProvinceAt(x,y): Province | null
   - getProvincesForCountry(countryId): Province[]
   - For MVP: generate provinces procedurally by subdividing the landmass into Voronoi-ish regions using random seed points, then name them from a list of historical European region names

6. src/rendering/layers/TerrainLayer.ts
   - Implements the Layer interface from GameRenderer
   - Uses the pixel-buffer technique:
     - Offscreen canvas at MAP_WIDTH × MAP_HEIGHT (1 pixel per tile)
     - On init: write terrain colors to ImageData
     - On render: drawImage scaled up with imageSmoothingEnabled = false
   - Rivers drawn as darker blue pixels on the terrain buffer
   - Only re-renders the buffer when terrain changes (dirty flag)

7. Update src/main.ts:
   - Replace checkerboard with TerrainLayer
   - Generate Europe map on startup
   - Should see a recognizable Europe map with terrain colors, zoomable and pannable

IMPORTANT:
- The simplex-noise package must be installed (npm install simplex-noise)
- Europe outline can be a simplified polygon — it doesn't need to be pixel-perfect, just recognizable
- Provinces are for war goals later — they just need to exist as data, no rendering yet
- Test: open browser, see colored Europe map, pan and zoom works, terrain types visible
```

---

### Prompt 2A: Countries, Cities & Territory System ← NEXT

**Goal**: Country entities, city placement, territory expansion, territory color overlay.

```
You are continuing to build "Swath". This is prompt 2A. Map and terrain from 1B are complete.

TASK: Implement countries, cities, and the core territory expansion system.

FILES TO IMPLEMENT:

1. src/entities/Country.ts
   - Class Country:
     - id: number, name: string, color: string (hex), isPlayer: boolean
     - resources: { gold: number, food: number, manpower: number, iron: number, wood: number, cloth: number }
     - stability: number (0-100, starts at 70)
     - taxRate: 'low' | 'normal' | 'exorbitant'
     - cities: City[]
     - totalPopulation: number (computed from cities)
     - ownedTileCount: number
     - wars: Set<number> (country IDs at war with)
     - tradePartners: Set<number>
     - advancements: Set<string> (unlocked advancement IDs)
   - Methods: canEstablishCity(): boolean (limited by stability), getManpowerPool(): number

2. src/entities/City.ts
   - Enum CityTier: VILLAGE = 1, TOWN = 2, METROPOLIS = 3
   - Class City:
     - id: number, name: string, countryId: number
     - tier: CityTier
     - centerTile: {x, y}
     - population: number
     - urbanTiles: Set<number> (tile indices)
     - farmTiles: Set<number> (tile indices)
     - buildings: Building[]
     - investmentProjects: InvestmentProject[] (citizen-funded or player-funded)
   - Methods: getTotalTiles(), getFootprintRadius()

3. src/entities/Building.ts
   - Enum BuildingType: CASTLE, MARKET, FARM, WORKSHOP, WALLS, PORT
   - BuildingConfig for each: { name, cost: {gold, wood?, iron?}, effects, prerequisite?: string }
     - CASTLE: defense +5 radius 3, troop recruitment +2/tick, costs 100 gold 20 wood
     - MARKET: gold +3/tick, costs 60 gold
     - FARM: food +2/tick, converts 4 nearby plains→farmland, costs 30 gold 10 wood
     - WORKSHOP: production +1 (iron/wood/cloth based on local terrain), costs 50 gold
     - WALLS: defense +3 on city border tiles, costs 80 gold 30 iron
     - PORT: enables coastal trade, trade income +2/tick, costs 100 gold 20 wood. Only on coastal city tiles.

4. src/entities/Population.ts
   - Population growth per city per tick:
     - baseGrowth = city.population * 0.001
     - foodBonus = surplus food * 0.5
     - growth reduced if population near cap (cap = city urbanTiles * 200 + farmTiles * 50)
   - When not at war: free manpower assigned to farming automatically
   - When at war: manpower drafted proportionally from all cities

5. src/systems/TerritorySystem.ts
   - Core expansion logic, runs each tick
   - For each country:
     - Find border tiles (owned tiles adjacent to unowned or enemy tiles)
     - For each border tile, attempt expansion into passable neighbors:
       - Unclaimed: claim if manpower > terrain moveCost. Deduct manpower.
       - Enemy: handled by CombatSystem (prompt 3A)
     - Expansion direction influenced by attack targets (war goals set by player/AI)
   - Expansion rate scales with available manpower and country size (diminishing returns for large countries)
   - Method: getBorderTiles(countryId): Set<number>

6. src/systems/CityGrowthSystem.ts
   - Each tick per city:
     - Population grows per Population.ts formula
     - If population > threshold AND adjacent tiles available:
       - Auto-spread: claim nearest unclaimed passable tile as urban or farm
       - Alternate: ~70% farm, ~30% urban for villages; flip ratio for towns
     - Farm placement prefers tiles with high fertility (near rivers)
     - Urban tiles: change terrain to URBAN, update TileMap
     - Farm tiles: change terrain to FARMLAND, update TileMap
   - Tier upgrade:
     - Village→Town: population > 500, country has 'town_charter' advancement, costs 200 gold
     - Town→Metropolis: population > 2000, country has 'metropolitan_rights' advancement, costs 800 gold
     - Upgrades appear as investment projects that player can fund (immediate) or let citizens fund over time (slower, depends on tax rate)
   - Tax rate effect on citizen investment speed:
     - Low tax: citizen projects complete 2x faster, player gets 0.5x tax income
     - Normal: 1x speed, 1x income
     - Exorbitant: citizen projects 0.25x speed, player gets 2x tax income but stability -0.1/tick

7. src/rendering/layers/TerritoryLayer.ts
   - Pixel buffer technique (like TerrainLayer):
     - Offscreen canvas MAP_WIDTH × MAP_HEIGHT
     - Each pixel = semi-transparent player color if owned, transparent if not
   - Re-render buffer each tick (territory changes every tick)
   - Drawn on top of terrain layer

8. src/rendering/layers/CityLayer.ts
   - At zoom < 1.5: cities are just colored dots (urban=gray cluster, farms=green patchwork visible in territory)
   - At zoom >= 1.5: draw simple icons per tile
     - Urban tiles: small gray squares with slight variation
     - Farm tiles: patchwork of 3-4 shades of green/yellow in a grid pattern within each tile
     - City center: larger icon based on tier (small house / cluster / castle silhouette)
   - City center tile is clickable (handled by input system)

9. src/rendering/layers/BorderLayer.ts
   - Draw country borders as 1px lines between owned tiles of different countries
   - Color: slightly darker version of the country's color
   - Only draw at edges where ownership changes

10. Update src/main.ts:
    - Map is loaded from public/world-1.0.5.png via MapLoader (already done)
    - Create 1 player country + 4 AI countries
    - Place each with a starting village in the European region of the world map (on plains, away from water)
    - Country names: pick from historical European nations
    - Player colors: #c0392b (player), #2980b9, #27ae60, #f39c12, #8e44ad
    - Territory expansion should be visibly happening each tick
    - Add all new layers to renderer in order: Terrain, Territory, City, Border

IMPORTANT:
- Territory expansion should be VISIBLE — open the browser and watch countries grow
- Farmland tiles should look distinctly different from plains (patchwork pattern)
- The player country does nothing special yet (no input) — just expands like AI
- All countries expand at the same rate for now
- No combat yet — countries that meet just stop expanding into each other
```

---

### Prompt 2B: Economy, Tax System & Resource UI

**Goal**: Working economy with gold/food/manpower/production, tax rate control, top bar UI.

```
You are continuing to build "Swath". This is prompt 2B. Countries and territory from 2A are complete.

TASK: Implement the economy system and the top resource bar UI.

FILES TO IMPLEMENT:

1. src/systems/EconomySystem.ts
   - Runs each tick per country:
   - GOLD:
     - Income: base 1/tick + (each MARKET building × 3) + (trade agreements × 2 per partner)
     - Tax income: total city population × taxRateMultiplier / 1000
       - taxRateMultiplier: low=0.5, normal=1.0, exorbitant=2.0
     - Expenses: troop maintenance = active troops × 0.01/tick
   - FOOD:
     - Income: each FARM building × 2 + farmland tiles × 0.1 (fertility-adjusted, river bonus applied)
     - Consumption: total population × 0.002/tick
     - Surplus food → population growth bonus (handled by CityGrowthSystem)
     - Deficit food → population shrinks, stability -0.2/tick
   - MANPOWER:
     - Pool: sum of (each city population × 0.1) — represents available people
     - At peace: manpower auto-assigned to farming (increases food output by 0.01 per manpower)
     - At war: manpower becomes troops (1 manpower = 1 troop)
     - Troops lost in combat are permanently lost (reduce city populations proportionally)
   - PRODUCTION GOODS:
     - Each WORKSHOP produces based on local terrain:
       - Adjacent to forest tiles: +1 wood/tick
       - Adjacent to hill tiles: +1 iron/tick
       - Adjacent to plains/farmland with population: +1 cloth/tick
     - Used for building construction (deducted on build)

2. src/ui/TopBar.ts
   - DOM element positioned at top center of viewport
   - Floating, rounded container with slight transparency (backdrop-filter: blur)
   - Displays:
     - Country name + colored circle
     - Gold (coin icon) + per-tick income in parentheses
     - Food (wheat icon) + surplus/deficit indicator
     - Manpower (person icon) + total available
     - Production: iron / wood / cloth counts
     - Stability: percentage with color (green >60, yellow 30-60, red <30)
     - Separator
     - Speed controls: pause button (⏸), speed buttons (1× 2× 5×), current tick number
   - All icons are simple Unicode or CSS-drawn (no image assets)
   - Updates every tick via EventBus 'tick' subscription
   - Style: dark semi-transparent background (#1a1a2e CC), white text, rounded-lg, subtle border
   - Must be responsive — shrink gracefully on narrow viewports

3. src/ui/CityPanel.ts
   - Slides in from the right when a city is selected (EventBus 'city-selected' event)
   - Shows:
     - City name, tier badge (Village/Town/Metropolis)
     - Population: current / cap
     - Tax rate picker: three buttons [Low | Normal | Exorbitant] — changes country-wide tax rate
     - Buildings list: name, effect description, and status
     - Build menu: available buildings with costs. Grayed out if insufficient resources. Click to build.
     - Investment projects: active citizen or player-funded projects with progress bars
     - "Fund Project" button on citizen projects (player pays gold to complete instantly)
   - Close button / click outside to dismiss
   - Style: same dark theme as TopBar

4. Update src/input/InputHandler.ts:
   - On tile click: check if tile belongs to a city (via TileMap.cityId)
   - If city tile: emit 'city-selected' with city data
   - If non-city owned tile: emit 'tile-selected' with tile info
   - Right-click on owned tile: context menu (placeholder for now)

5. Wire up in main.ts:
   - TopBar listens to tick events and reads player country state
   - CityPanel listens to city-selected events
   - Speed controls in TopBar call GameLoop.setSpeed()
   - Player starts with 100 gold, 50 food, and their starting village

TEST EXPECTATIONS:
- Top bar shows live-updating resources as the game ticks
- Speed controls work (pause, 1x, 2x, 5x)
- Click on a player city tile → city panel slides in with correct data
- Can change tax rate, see the effect on gold income next tick
- Can build a Farm if resources sufficient → nearby tiles convert to farmland
- Economy numbers should feel reasonable at 1x speed over 30 seconds of gameplay
```

---

### Prompt 3A: Combat, Sieges & War Declaration

**Goal**: Attrition combat at borders, siege mechanics, war declaration flow.

```
You are continuing to build "Swath". This is prompt 3A. Economy from 2B is complete.

TASK: Implement combat, siege mechanics, and the war declaration system.

FILES TO IMPLEMENT:

1. src/systems/CombatSystem.ts
   - Runs each tick for all pairs of countries at war
   - ATTRITION COMBAT:
     - At border tiles where two warring countries meet:
       - Attacker strength = troops allocated to this front × terrain modifier
       - Defender strength = troops on tile + building defense bonuses
       - Each tick: attacker loses (defender strength × 0.1) troops, defender loses (attacker strength × 0.1) troops
       - If defender troops on a tile reach 0: tile flips to attacker
     - Terrain defense modifiers:
       - PLAINS: 1.0× (no bonus)
       - FOREST: 1.3× defender bonus
       - HILLS: 1.5× defender bonus
       - URBAN: 1.2× defender bonus
   - SIEGE:
     - Tiles with CASTLE or WALLS cannot be captured by normal attrition
     - Siege: attacker must maintain presence on adjacent tiles for N ticks
       - WALLS: 15 ticks to breach
       - CASTLE: 30 ticks to breach
     - During siege: defender loses 0.5 troops/tick (starvation), attacker loses 0.2 troops/tick
     - Once breached: tile can be captured normally
     - Siege progress resets if attacker is pushed back from adjacent tiles

2. src/systems/FrontSystem.ts
   - Detects and manages war fronts between warring countries
   - FRONT DETECTION:
     - A "front" is a contiguous line of border tiles between two warring countries
     - Use flood-fill on border tiles to group them into distinct fronts
     - Each front has: frontId, tiles (Set), length, direction (toward nearest war goal province)
   - TROOP DISTRIBUTION:
     - Country's total wartime manpower distributed across fronts
     - Distribution weighted by: front length, proximity to war goals, player reinforcement commands
     - Default: proportional to front length
     - Player can click a front to allocate more troops (shift weight)
   - FRONT MOVEMENT:
     - Each front pushes in the direction of its nearest war goal
     - Push rate = (attacker troops on front - defender troops) × speed factor
     - Fronts naturally straighten over time (concave sections fill in)
   - Update each tick: recalculate front boundaries as territory changes

3. src/systems/DiplomacySystem.ts
   - DECLARE WAR:
     - Requires: not already at war with target, stability > 20
     - On declaration: stability -10, enter war goal selection mode
     - Both countries switch manpower to military
   - MAKE PEACE:
     - Either side can propose peace after 50 ticks of war
     - Attacker gets: min(tiles currently occupied beyond original border, stability-allowed annexation)
     - Stability-allowed annexation = floor(stability / 10) provinces worth of tiles
     - After peace: 100-tick truce (cannot declare war again)
     - Annexed tiles reduce stability by (annexed tile count / total tiles × 50)
   - TRADE AGREEMENT:
     - Propose trade with any non-enemy country
     - Both sides get +2 gold/tick
     - Automatically broken when war declared
   - Country relations: -100 to +100. War = -100, trade = +20, truce = sets to 0

4. src/ui/WarGoalView.ts
   - Activated when player declares war
   - Map view changes: all countries slightly grayed out except target
   - Province overlay becomes visible (borders of historical provinces drawn)
   - Selection tools (toggle between modes):
     a. "Select Country" — selects ALL provinces of target (full conquest goal)
     b. "Select Province" — click individual provinces to add/remove from war goals
     c. "Lasso" — freehand draw to select area. Operations:
        - Default: union (add to selection)
        - Hold Shift: intersect
        - Hold Alt: subtract from selection
   - Selected provinces highlighted in red overlay
   - "Confirm War Goals" button → starts the war, creates fronts toward selected provinces
   - "Cancel" → cancels war declaration
   - Show estimated stability cost of conquering selected provinces

5. src/input/LassoTool.ts
   - Activated during war goal selection when lasso mode is on
   - On mousedown: start recording path points
   - On mousemove (while down): add points, draw lasso line on overlay canvas
   - On mouseup: close polygon, determine which tiles/provinces fall inside
   - Point-in-polygon test for each province center
   - Support union (default), intersect (Shift), subtract (Alt)
   - Visual: semi-transparent red fill inside lasso while drawing

6. src/rendering/layers/FrontLayer.ts
   - Draws active war fronts on the map
   - Front line: thick colored line (attacker's color, 2-3px) along border tiles
   - Direction arrows: small arrows along the front pointing toward war goals
   - Contested tiles: pulsing/flashing effect
   - Only visible during active wars

7. src/ui/DiplomacyPanel.ts
   - Accessible from bottom bar or keyboard shortcut (D)
   - Shows list of all countries with:
     - Name, color, relation score, status (at peace / at war / truce / trade partner)
     - Available actions per country (declare war, propose trade, make peace)
   - War status section: if at war, shows fronts, troop allocation, war duration, "Propose Peace" button

8. Update src/ui/BottomBar.ts:
   - Create bottom action bar
   - Context-sensitive: shows relevant actions
   - Default state: Diplomacy (D), Settle City (S) — only if stability allows
   - During war: shows front overview, troop allocation slider

9. Wire everything up:
   - Player can right-click an enemy country → option to "Declare War"
   - War goal view appears, player selects provinces, confirms
   - Fronts appear and troops auto-engage
   - Border tiles contested with combat animations (flashing)
   - Peace can be proposed from diplomacy panel
   - AI countries should also declare war on each other after ~100 ticks

TEST EXPECTATIONS:
- Can declare war on neighboring AI country
- War goal selection view works with province click and lasso tool
- Fronts form and push toward war goals
- Territory changes hands visibly during combat
- Can make peace, conquered tiles stay, stability drops
- AI countries fight each other
```

---

### Prompt 3B: Stability & Peace System Polish

**Goal**: Full stability mechanics, peace deal resolution, post-war effects.

```
You are continuing to build "Swath". This is prompt 3B. Combat and war from 3A are complete.

TASK: Implement the stability system and polish the peace/annexation flow.

FILES TO IMPLEMENT:

1. src/systems/StabilitySystem.ts
   - Stability is a 0-100 value per country, starts at 70
   - FACTORS (calculated each tick):
     - Base recovery: +0.05/tick (always trending toward equilibrium)
     - Equilibrium is NOT 100 — it's based on country state:
       - Base equilibrium: 70
       - Overextension penalty: -1 per province conquered in last 200 ticks (decays over time)
       - Tech bonus: +5 for each stability-related advancement unlocked
       - Tax penalty: exorbitant tax → equilibrium -10
       - War penalty: -5 per active war
       - Food deficit: -10 while food is negative
       - Large empire penalty: -(ownedTiles / 5000) — scales with size, encourages progression before expansion
     - Stability trends toward equilibrium at 0.05/tick
   - EFFECTS OF LOW STABILITY:
     - Below 50: expansion speed -25%
     - Below 30: cannot declare war, random tiles may rebel (flip to unclaimed) at 0.1% chance/tick
     - Below 15: cities stop growing, troops desert at 1%/tick
   - CONQUEST STABILITY COST:
     - When peace deal finalizes: stability -= (annexed provinces count × 5)
     - This is what limits how much you can take — you can occupy a lot but only keep what stability allows
   - Track: recentConquests[] with { tick, provinceCount } for decay calculation

2. Update src/systems/DiplomacySystem.ts:
   - Peace deal screen:
     - Show provinces currently occupied by attacker
     - Show max provinces annexable based on stability (floor(stability / 10))
     - Player selects which occupied provinces to annex (up to the max)
     - Remaining occupied provinces returned to defender
     - Show projected stability after annexation
   - AI peace logic:
     - AI proposes peace when losing (< 60% of original territory)
     - AI accepts peace when war is a stalemate (< 5 tiles changing per 50 ticks)

3. src/ui/PeaceDealPanel.ts
   - Full-screen overlay when peace is being negotiated
   - Left side: map zoomed to war zone, occupied provinces highlighted
   - Right side: list of occupiable provinces, checkboxes to select
   - Stability bar: shows current stability and projected after deal
   - "Accept Peace" / "Continue War" buttons
   - AI peace deals auto-resolve (AI takes max it can)

4. Update TopBar to show stability with tooltip explaining contributing factors
5. Update BottomBar to show "Settle City" only when stability > 40
6. Update Country.canEstablishCity() — requires stability > 40, max cities = floor(stability / 15)

TEST EXPECTATIONS:
- Stability visibly drops after conquering territory
- Stability recovers slowly over time
- At low stability, expansion slows noticeably
- Peace deal correctly limits annexation
- Player can choose which provinces to keep
- AI proposes peace when losing badly
- Settling new cities requires sufficient stability
```

---

### Prompt 4A: Progression System (Missions & Advancements)

**Goal**: Mission-based advancement unlocks that gate city upgrades and enable new capabilities.

```
You are continuing to build "Swath". This is prompt 4A. Stability from 3B is complete.

TASK: Implement the mission/advancement system that drives feudal → mercantile → industrial progression.

FILES TO IMPLEMENT:

1. src/systems/ProgressionSystem.ts
   - Advancements are unlocked by completing missions (condition checks each tick)
   - Each advancement has: id, name, description, prerequisites (other advancement IDs), mission condition, effects
   - Advancement categories:
     - GOVERNANCE: enables city upgrades, increases stability equilibrium
     - MILITARY: unlocks better troops, siege bonuses, defense bonuses
     - ECONOMY: unlocks buildings, trade routes, better production
     - TECHNOLOGY: unlocks later-era capabilities
   
   - INITIAL ADVANCEMENTS (MVP set — ~20 total, representing the progression arc):

   Governance:
   - 'town_charter': "Establish a town" — requires any city pop > 500. Unlocks Village→Town upgrade.
   - 'metropolitan_rights': "Metropolitan Rights" — requires any city pop > 2000 + 'town_charter'. Unlocks Town→Metropolis.
   - 'centralized_bureaucracy': "Centralized Bureaucracy" — requires 5+ cities + 'town_charter'. Stability equilibrium +10.
   - 'national_identity': "National Identity" — requires 30% of map controlled + 'centralized_bureaucracy'. Stability equilibrium +10, large empire penalty halved.

   Economy:
   - 'basic_trade': "Open Markets" — requires 2+ markets built. Unlocks trade agreements.
   - 'guilds': "Merchant Guilds" — requires 500+ gold stockpile + 'basic_trade'. Workshops produce +50%.
   - 'banking': "Banking Houses" — requires any metropolis + 'guilds'. Gold income +25%.
   - 'joint_stock': "Joint Stock Companies" — requires 'banking' + 3 ports. Unlocks citizen-funded ports and trade routes.
   - 'mercantilism': "Mercantilist Policy" — requires 5+ trade partners + 'banking'. Trade income doubled.

   Military:
   - 'standing_army': "Standing Army" — requires castle built + pop > 1000. Troops +20% effective strength.
   - 'metallurgy': "Metallurgy" — requires city pop > 1000 + workshop adjacent to hills. Siege speed +50%.
   - 'gunpowder': "Gunpowder" — requires 'metallurgy' + 1000 iron stockpile. Unlocks musketeers (troops 2x strength).
   - 'professional_officer_corps': "Professional Officers" — requires 'standing_army' + 'gunpowder'. Front system efficiency +30%.

   Technology:
   - 'printing_press': "Printing Press" — requires 'guilds' + metropolis. Advancement unlock speed +25%.
   - 'early_industry': "Early Industry" — requires 'printing_press' + 10 workshops. Production output doubled.
   - 'mass_production': "Mass Production" — requires 'early_industry' + city pop > 5000. Unlocks factories (super-workshops).

2. src/ui/AdvancementPanel.ts
   - Accessible via keyboard shortcut (T for Tech) or bottom bar button
   - Tree visualization: nodes connected by dependency lines
   - Each node shows:
     - Name, icon (simple Unicode/emoji), locked/unlocked/available state
     - Hover: mission condition + effects description
     - Color: gray (locked prerequisites not met), amber (prerequisites met, mission not yet complete), green (unlocked)
   - Current missions highlighted with progress indicator where applicable (e.g., "Population: 350/500")

3. src/ui/Notifications.ts
   - Toast notifications appear at top-right
   - "Advancement Unlocked: [name]" with brief effect description
   - Auto-dismiss after 5 seconds
   - Queue system: max 3 visible at once
   - Also used for: war declarations, peace deals, city tier upgrades, low stability warnings

4. Update all systems to check advancements:
   - CityGrowthSystem: check 'town_charter' / 'metropolitan_rights' before allowing upgrades
   - EconomySystem: apply bonuses from 'guilds', 'banking', 'mercantilism'
   - CombatSystem: apply 'standing_army', 'gunpowder' combat bonuses
   - FrontSystem: apply 'professional_officer_corps' efficiency bonus
   - DiplomacySystem: require 'basic_trade' for trade agreements

5. Wire up: ProgressionSystem runs each tick, checks all advancement conditions, emits 'advancement-unlocked' events

TEST EXPECTATIONS:
- Start game: most advancements are locked (gray)
- As first city grows to 500 pop, 'town_charter' unlocks with a notification
- Advancement tree panel shows correct state for all nodes
- Unlocking advancements has visible gameplay effects
- Progression feels natural over a 30-minute session — player should unlock 5-8 advancements
- Late-game advancements (gunpowder, mass production) should only be reachable near end of a session
```

---

### Prompt 5A: AI System

**Goal**: AI opponents that manage economy, declare wars, expand, and build cities.

```
You are continuing to build "Swath". This is prompt 5A. Progression from 4A is complete.

TASK: Implement AI that plays the game competently.

FILES TO IMPLEMENT:

1. src/systems/AISystem.ts
   - Runs each tick for every non-player country
   - AI PERSONALITY (randomized per AI at game start):
     - aggression: 0.0-1.0 (likelihood to declare war)
     - expansion: 0.0-1.0 (priority of territorial growth vs internal development)
     - economicFocus: 0.0-1.0 (priority of economy vs military)
   
   - DECISION LOOP (each tick, prioritized):
     a. SURVIVAL: if stability < 25 or losing a war badly → sue for peace, stop expanding
     b. ECONOMY: 
        - If food deficit → build farms in cities with available slots
        - If gold > building cost threshold → build highest-priority building
        - Building priority: Farm (if food low) > Market (if gold income low) > Workshop > Castle (if at war or aggression high) > Walls (if border under threat)
        - Tax rate: set to 'exorbitant' if at war and gold low, 'normal' default, 'low' if stability high and not at war
     c. CITY MANAGEMENT:
        - If can establish new city (stability allows) and good location available → place village
        - Good location = plains tile with high fertility (near river), far from existing cities (>30 tiles), within own territory
        - Fund city upgrades if gold > 500
     d. WARFARE:
        - If aggression > 0.6 and stability > 40 and not in active war:
          - Evaluate neighbors: pick weakest neighbor (fewest tiles) or neighbor with desirable provinces
          - Declare war with war goals = 1-3 closest provinces of target
        - During war: reinforce fronts that are losing, shift troops from stable fronts
     e. DIPLOMACY:
        - Propose trade with non-hostile neighbors (if 'basic_trade' unlocked)
        - Accept peace if war is going badly (lost >30% of pre-war territory)
        - Propose peace if war goals achieved
     f. EXPANSION: auto-expansion toward unclaimed territory (handled by TerritorySystem, AI just ensures it keeps happening)

   - AI runs same systems as player — no cheating, no resource bonuses
   - AI decisions made once every 10 ticks (not every tick) to reduce computation

2. Update main.ts:
   - AI countries now actively managed
   - Configurable AI count at game start (2-8, default 5)
   - AI names from pool: Kingdom of Castile, Republic of Venice, Kingdom of France, Duchy of Burgundy, Kingdom of England, Holy Roman Empire, Kingdom of Poland, Kingdom of Denmark, Ottoman Empire, Kingdom of Hungary
   - Each AI gets a randomized personality

3. Add game start screen (simple):
   - Before game starts: show a basic setup screen
   - Options: number of AI opponents (2-8), game speed default
   - "Start Game" button → initializes map, places countries, begins loop

TEST EXPECTATIONS:
- AI countries expand, build cities, develop economy
- AI declares wars after ~100-150 ticks, fights, makes peace
- Different AI personalities lead to different behaviors (aggressive AI wars early, economic AI builds more)
- Game feels competitive — player must actively manage to keep up
- No AI crashes or infinite loops
- A full 30-minute game should have 3-5 wars between various AI nations
```

---

### Prompt 6A: Save/Load & Pause Menu

**Goal**: Save game state to localStorage/file, load it back, pause menu with settings.

```
You are continuing to build "Swath". This is prompt 6A. AI from 5A is complete.

TASK: Implement save/load system and pause menu.

FILES TO IMPLEMENT:

1. src/core/SaveManager.ts
   - Serialize entire game state to JSON:
     - GameState (tick, speed)
     - TileMap (typed arrays → base64 encoded strings)
     - All countries with their cities, buildings, resources, advancements
     - Province ownership
     - Active wars, fronts, truces
     - AI personalities
   - Deserialize: reconstruct all objects from JSON
   - Save to localStorage under key 'swath_save_[slot]' (3 slots)
   - Export to .json file download
   - Import from .json file upload
   - Auto-save every 60 seconds to slot 0

2. src/ui/PauseMenu.ts
   - Triggered by Escape key or pause button
   - Game loop pauses immediately
   - Overlay with options:
     - Resume
     - Save Game (shows 3 slots with timestamps, or "Empty")
     - Load Game (shows 3 slots, grayed if empty)
     - Export Save (downloads .json file)
     - Import Save (file picker)
     - Settings (sub-panel):
       - Key rebinds: show current bindings, click to rebind, press new key
       - UI scale slider (affects top bar / panels)
       - Show/hide minimap toggle
       - Show/hide province borders toggle
     - Return to Main Menu (confirms discard unsaved progress)
   - Style: centered modal, dark backdrop, same theme as other UI

3. src/input/KeyBindings.ts
   - Default bindings:
     - Escape: pause menu
     - Space: toggle pause
     - 1/2/3: speed 1x/2x/5x
     - D: diplomacy panel
     - T: advancement tree
     - S: settle city mode
     - B: open build menu (when city selected)
     - M: toggle minimap
   - Rebindable: store in localStorage, loaded on startup
   - Conflict detection: warn if key already bound

4. src/ui/Minimap.ts
   - Small canvas in bottom-left corner (150×100px)
   - Shows entire map at 1 pixel per ~5 tiles
   - Color = territory owner color, or terrain color if unclaimed
   - White rectangle shows current camera viewport
   - Click on minimap → pan camera to that location
   - Toggle visibility with M key

5. Wire up:
   - Auto-save running in background
   - Pause menu fully functional
   - Key bindings saved to localStorage
   - Minimap updates each tick

TEST EXPECTATIONS:
- Escape opens pause menu, game freezes
- Can save to slot, close browser, reopen, load — game state is identical
- Export/import .json works
- Key rebinding works and persists across sessions
- Minimap accurately reflects map state, clicking it pans camera
- Settings changes apply immediately
```

---

### Prompt 7A: Win Condition, Polish & Game Feel

**Goal**: Victory screen, balance tuning, visual polish, game start flow.

```
You are continuing to build "Swath". This is prompt 7A. Save/load from 6A is complete.

TASK: Add win/loss conditions, polish the game start, and improve game feel.

FILES TO IMPLEMENT:

1. src/systems/VictorySystem.ts
   - Check each tick:
     - WIN: player owns >= 90% of non-water (livable) tiles → victory screen
     - LOSS: player owns 0 tiles → defeat screen
   - Count livable tiles at game start, cache the number
   - Show progress in TopBar as "Territory: X% of 90% needed"

2. src/ui/VictoryScreen.ts
   - Full overlay on win or loss
   - Shows: outcome (Victory/Defeat), game duration (ticks → minutes), stats:
     - Tiles controlled, cities built, wars won/lost, advancements unlocked
     - Largest city name and population
   - Buttons: "Play Again" (return to start screen), "Continue Playing" (sandbox mode, disable victory check)

3. src/ui/StartScreen.ts (expand from basic version in 5A)
   - Title: "SWATH" in large serif/medieval-style CSS text
   - Subtitle: "A Swath of Land" or similar
   - Menu options:
     - New Game → setup screen (AI count: 2-8, starting position: random or choose on map)
     - Load Game → save slot picker
     - Settings → key rebinds, UI scale
   - Background: slowly panning camera over a pre-generated Europe map (visual flair)
   - Choose starting position: if selected, show map, player clicks to place starting settlement

4. BALANCE TUNING (update Config.ts):
   - Tune all values so a skilled player can win in ~30 minutes at 1x speed:
     - Territory expansion rate: should feel steady but not instant
     - Economy growth: player should afford first market by tick ~50, first castle by tick ~100
     - Population growth: villages reach 500 pop (town_charter threshold) by tick ~150
     - AI aggression timing: first AI war should happen around tick 100-200
     - Stability recovery: conquering 3 provinces should be manageable, 8+ should tank stability
     - Gunpowder should be reachable around tick 500-600 (late game)
   - Add all balance values to Config.ts as named constants (easy to tune)

5. VISUAL POLISH:
   - Smooth camera zoom (lerp toward target zoom over 5 frames instead of instant)
   - Territory border glow: 1px glow on player territory borders
   - City growth animation: brief flash when a city claims a new tile
   - War front pulse: contested border tiles pulse between attacker/defender colors
   - Hover tooltip: when hovering over a tile, show small tooltip with terrain type, owner, province name
   - Selection highlight: when a city is selected, outline its tiles with a bright border

6. src/rendering/layers/UIOverlayLayer.ts
   - Draws: hover tooltip, selection highlights, war front pulse, placement previews
   - Screen-space layer (not affected by camera transform for tooltips, but uses world-space for tile highlights)

7. Update all rendering layers (OpenFront-inspired optimizations):
   - Ensure smooth rendering at 60fps even with full world map
   - **Incremental tile updates**: Instead of full buffer rebuild on dirty, systems (TerritorySystem, CityGrowthSystem) report changed tile indices. Layers patch only those pixels into existing ImageData. Fall back to full rebuild if >10% of tiles changed.
   - **Viewport-culled putImageData**: Compute visible tile rect from camera, only `putImageData(imageData, dx, dy, dirtyX, dirtyY, dirtyW, dirtyH)` the visible portion instead of full buffer.
   - **Precomputed LUT tables**: Add `refToX[]`, `refToY[]` arrays on TileMap to avoid `idx % W` and `Math.floor(idx / W)` in hot loops (territory expansion, border detection, BFS).
   - City layer: batch draw calls, use offscreen canvas for repeated sprite patterns

TEST EXPECTATIONS:
- Full game loop works: start screen → setup → play → win/lose → play again
- Game is winnable in ~25-35 minutes at 1x speed
- Winning at 5x speed should take ~5-7 minutes
- Visual polish makes the game feel responsive and alive
- No frame drops below 30fps at any point
- Hover tooltips, selection highlights, and war animations all work
- Load a save from mid-game, continue to victory
```

---

## Post-MVP Prompts (Future)

These are noted for future development, not part of the initial build:

- **8A**: Procedural map generation (noise-based continents)

Far backlog (not actively planned):
- Multiplayer via WebSocket (OpenFront-style deterministic lockstep — builds on existing worker separation)
- **9A**: Sound design (ambient, SFX)
- **9B**: Music (procedural or licensed medieval tracks)
- **10A**: Steam/Electron wrapper for desktop release
- **10B**: Advanced AI (difficulty levels, different strategies)
- **11A**: Extended progression tree (50+ advancements, full tech tree)
- **11B**: Joint stock companies, advanced trade, colonial expansion
- **12A**: Map editor
- **12B**: Mod support

---

## Prompt Dependency Graph

```
1A (scaffold + loop) → 1B (map + terrain)
                            ↓
                       2A (countries + territory)
                            ↓
                       2B (economy + UI)
                            ↓
                       3A (combat + war)
                            ↓
                       3B (stability + peace)
                            ↓
                       4A (progression)
                            ↓
                       5A (AI)
                            ↓
                       6A (save/load)
                            ↓
                       7A (win condition + polish)
```

All prompts are sequential. Each depends on the previous one being complete and working.