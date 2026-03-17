import { TileMap } from './TileMap';
import { RiverSystem } from './RiverSystem';
import { TerrainType } from './Terrain';
import { Config } from '../core/Config';

function loadImage(src: string): Promise<HTMLImageElement> {
  const img = new Image();
  img.src = src;
  return new Promise((resolve, reject) => {
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load ${src}`));
  });
}

function sampleImage(img: HTMLImageElement, w: number, h: number): ImageData {
  const canvas = new OffscreenCanvas(w, h);
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, 0, 0, w, h);
  return ctx.getImageData(0, 0, w, h);
}

export async function generateWorldMap(tileMap: TileMap, _rivers: RiverSystem): Promise<void> {
  const W = Config.MAP_WIDTH;
  const H = Config.MAP_HEIGHT;

  const [reliefImg, demImg] = await Promise.all([
    loadImage('/editor/assets/heightmap.png'),
    loadImage('/editor/assets/earthbump.jpg'),
  ]);

  const reliefData = sampleImage(reliefImg, W, H);
  const demData = sampleImage(demImg, W, H);

  // Build raw land mask from shaded relief
  const isLand = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) {
    const r = reliefData.data[i * 4];
    const g = reliefData.data[i * 4 + 1];
    const b = reliefData.data[i * 4 + 2];
    const brightness = (r + g + b) / 3;
    isLand[i] = brightness > 25 ? 1 : 0;
  }

  // Read elevation from DEM
  const elevation = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) {
    if (!isLand[i]) {
      elevation[i] = 0;
      continue;
    }
    const r = demData.data[i * 4];
    const g = demData.data[i * 4 + 1];
    const b = demData.data[i * 4 + 2];
    elevation[i] = (r + g + b) / 3 / 255;
  }

  // Assign terrain — no smoothing, raw from data
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = y * W + x;

      if (!isLand[idx]) {
        tileMap.terrain[idx] = TerrainType.WATER;
        continue;
      }

      const elev = elevation[idx];

      if (elev > 0.35) {
        tileMap.terrain[idx] = TerrainType.MOUNTAINS;
      } else if (elev > 0.15) {
        tileMap.terrain[idx] = TerrainType.HILLS;
      } else {
        tileMap.terrain[idx] = TerrainType.PLAINS;
      }
    }
  }
}
