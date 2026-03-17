import { TileMap } from './TileMap';
import { TerrainType, TerrainConfigs } from './Terrain';
import { setMapSize } from '../core/Config';

function colorToTerrain(r: number, g: number, b: number): TerrainType {
  let bestMatch = TerrainType.WATER;
  let bestDist = Infinity;

  for (const [typeStr, config] of Object.entries(TerrainConfigs)) {
    const type = Number(typeStr) as TerrainType;
    const hex = config.color;
    const tr = parseInt(hex.slice(1, 3), 16);
    const tg = parseInt(hex.slice(3, 5), 16);
    const tb = parseInt(hex.slice(5, 7), 16);
    const dist = (r - tr) ** 2 + (g - tg) ** 2 + (b - tb) ** 2;
    if (dist < bestDist) {
      bestDist = dist;
      bestMatch = type;
    }
  }
  return bestMatch;
}

export async function loadMapFromPng(tileMap: TileMap, src: string): Promise<void> {
  const img = new Image();
  img.src = src;
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error(`Failed to load map image: ${src}`));
  });

  const W = img.naturalWidth;
  const H = img.naturalHeight;

  // Resize tileMap to match image dimensions
  setMapSize(W, H);
  tileMap.width = W;
  tileMap.height = H;
  const size = W * H;
  tileMap.terrain = new Uint8Array(size);
  tileMap.owner = new Uint16Array(size);
  tileMap.building = new Uint8Array(size);
  tileMap.population = new Uint16Array(size);
  tileMap.cityId = new Uint16Array(size);

  const canvas = new OffscreenCanvas(W, H);
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0);
  const imageData = ctx.getImageData(0, 0, W, H);
  const pixels = imageData.data;

  for (let i = 0; i < size; i++) {
    const r = pixels[i * 4];
    const g = pixels[i * 4 + 1];
    const b = pixels[i * 4 + 2];
    tileMap.terrain[i] = colorToTerrain(r, g, b);
  }
}
