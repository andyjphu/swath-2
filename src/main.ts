import { GameState } from './core/GameState';
import { GameLoop } from './core/GameLoop';
import { Camera } from './rendering/Camera';
import { GameRenderer } from './rendering/GameRenderer';
import { InputHandler } from './input/InputHandler';
import { Config } from './core/Config';
import { TileMap } from './map/TileMap';
import { RiverSystem } from './map/RiverSystem';
import { TerrainLayer } from './rendering/layers/TerrainLayer';
import { TerritoryLayer } from './rendering/layers/TerritoryLayer';
import { BorderLayer } from './rendering/layers/BorderLayer';
import { CityLayer } from './rendering/layers/CityLayer';
import { loadMapFromPng } from './map/MapLoader';
import { Country } from './entities/Country';
import { City } from './entities/City';
import { TerritorySystem } from './systems/TerritorySystem';
import { CityGrowthSystem } from './systems/CityGrowthSystem';
import { SimBridge } from './workers/SimBridge';
import { TopBar } from './ui/TopBar';
import { CityPanel } from './ui/CityPanel';
import { EventBus } from './core/EventBus';
import { TerrainType } from './map/Terrain';

// Init core
const canvas = document.getElementById('game') as HTMLCanvasElement;
const state = new GameState();
const camera = new Camera();
const renderer = new GameRenderer(canvas, camera, state);
const loop = new GameLoop(state);

const tileMap = new TileMap();
const rivers = new RiverSystem();

// European country starting positions (approximate tile coords on 2160×784 map)
const COUNTRY_DEFS = [
  { name: 'Kingdom of France', color: '#2980b9', x: 1092, y: 162, isPlayer: true },
  { name: 'Kingdom of England', color: '#c0392b', x: 1078, y: 128, isPlayer: false },
  { name: 'Kingdom of Castile', color: '#f39c12', x: 1056, y: 183, isPlayer: false },
  { name: 'Holy Roman Empire', color: '#27ae60', x: 1170, y: 151, isPlayer: false },
  { name: 'Kingdom of Poland', color: '#8e44ad', x: 1190, y: 138, isPlayer: false },
];

const CITY_NAMES: Record<string, string> = {
  'Kingdom of France': 'Paris',
  'Kingdom of England': 'London',
  'Kingdom of Castile': 'Toledo',
  'Holy Roman Empire': 'Vienna',
  'Kingdom of Poland': 'Krakow',
};

/** Find the nearest passable plains tile to the target position */
function findStartPosition(tileMap: TileMap, targetX: number, targetY: number): { x: number; y: number } {
  const W = tileMap.width;
  for (let r = 0; r < 50; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
        const x = targetX + dx;
        const y = targetY + dy;
        if (!tileMap.inBounds(x, y)) continue;
        const terrain = tileMap.terrain[y * W + x] as TerrainType;
        if (terrain === TerrainType.PLAINS) {
          return { x, y };
        }
      }
    }
  }
  return { x: targetX, y: targetY };
}

async function init() {
  console.log('Loading world map...');
  await loadMapFromPng(tileMap, '/world-1.0.5.png');
  console.log(`Map loaded: ${tileMap.width}x${tileMap.height}`);

  // Create countries and cities
  for (let i = 0; i < COUNTRY_DEFS.length; i++) {
    const def = COUNTRY_DEFS[i];
    const countryId = i + 1;
    const country = new Country(countryId, def.name, def.color, def.isPlayer);
    state.addCountry(country);

    if (def.isPlayer) state.playerId = countryId;

    const pos = findStartPosition(tileMap, def.x, def.y);
    const cityName = CITY_NAMES[def.name] || def.name;
    const city = new City(0, cityName, countryId, pos.x, pos.y);
    state.addCity(city, country);
  }

  // Init systems on main thread for one-time setup
  const territorySystem = new TerritorySystem(tileMap, state.countries);
  const cityGrowthSystem = new CityGrowthSystem(tileMap, state.countries);

  for (const country of state.countries.values()) {
    for (const city of country.cities) {
      cityGrowthSystem.initCity(city, country);
    }
  }
  territorySystem.recountTiles();

  // Center camera on Europe
  const europeX = 1120 * Config.TILE_SIZE;
  const europeY = 155 * Config.TILE_SIZE;
  camera.zoom = 1.5;
  camera.panX = window.innerWidth / 2 - europeX * camera.zoom;
  camera.panY = window.innerHeight / 2 - europeY * camera.zoom;

  // Rendering layers
  const terrainLayer = new TerrainLayer(tileMap, rivers);
  const territoryLayer = new TerritoryLayer(tileMap, state.countries);
  const borderLayer = new BorderLayer(tileMap, state.countries, state.playerId);
  const cityLayer = new CityLayer(tileMap, state.countries);
  renderer.addLayer(terrainLayer);
  renderer.addLayer(territoryLayer);
  renderer.addLayer(borderLayer);
  renderer.addLayer(cityLayer);

  // Input (needs tileMap for click detection)
  new InputHandler(canvas, camera, tileMap);

  // Worker bridge for simulation
  const simBridge = new SimBridge(tileMap, state.countries, state.cities);

  simBridge.onChange((changes) => {
    if (changes.ownerChanges.length > 0) {
      territoryLayer.markDirty();
      borderLayer.markDirty();
    }
    if (changes.terrainChanges.length > 0) {
      terrainLayer.markDirty();
      territoryLayer.markDirty();
    }
    if (changes.cityIdChanges.length > 0) {
      cityLayer.markDirty();
      territoryLayer.markDirty();
    }
  });

  simBridge.init();

  // UI
  new TopBar(state, loop);
  new CityPanel(state, simBridge);

  // On tick, tell the worker to simulate
  EventBus.on<{ tick: number }>('tick', () => {
    simBridge.tick();
  });

  loop.start();
}

init();
