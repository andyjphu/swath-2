import { GameState } from './core/GameState';
import { GameLoop } from './core/GameLoop';
import { Camera } from './rendering/Camera';
import { GameRenderer } from './rendering/GameRenderer';
import { InputHandler } from './input/InputHandler';
import { Config } from './core/Config';
import { TileMap } from './map/TileMap';
import { RiverSystem } from './map/RiverSystem';
import { generateWorldMap } from './map/WorldMapGen';
import { TerrainLayer } from './rendering/layers/TerrainLayer';
import { MapEditor } from './ui/MapEditor';

// Init core
const canvas = document.getElementById('game') as HTMLCanvasElement;
const state = new GameState();
const camera = new Camera();
const renderer = new GameRenderer(canvas, camera, state);
new InputHandler(canvas, camera);
const loop = new GameLoop(state);

// Generate world map
const tileMap = new TileMap();
const rivers = new RiverSystem();

async function init() {
  console.log('Generating world map...');
  await generateWorldMap(tileMap, rivers);
  console.log('Map generated.');

  // Center camera on map
  camera.zoom = 0.5;
  camera.panX = window.innerWidth / 2 - (Config.MAP_WIDTH * Config.TILE_SIZE * camera.zoom) / 2;
  camera.panY = window.innerHeight / 2 - (Config.MAP_HEIGHT * Config.TILE_SIZE * camera.zoom) / 2;

  // Add layers
  const terrainLayer = new TerrainLayer(tileMap, rivers);
  renderer.addLayer(terrainLayer);

  // Map editor
  new MapEditor(tileMap, rivers, camera, canvas, () => {
    terrainLayer.markDirty();
  });

  loop.start();
}

init();
