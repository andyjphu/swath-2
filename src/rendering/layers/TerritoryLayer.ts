import { Layer } from '../GameRenderer';
import { Camera } from '../Camera';
import { GameState } from '../../core/GameState';
import { TileMap } from '../../map/TileMap';
import { Country } from '../../entities/Country';
import { Config } from '../../core/Config';
import { TerrainType } from '../../map/Terrain';

export class TerritoryLayer implements Layer {
  isWorldSpace = true;
  private offscreen!: OffscreenCanvas;
  private offCtx!: OffscreenCanvasRenderingContext2D;
  private imageData!: ImageData;
  private lastW = 0;
  private lastH = 0;
  private dirty = true;

  private colorCache = new Map<number, [number, number, number]>();

  constructor(private tileMap: TileMap, private countries: Map<number, Country>) {}

  init(_ctx: CanvasRenderingContext2D): void {
    this.resizeBuffer();
  }

  markDirty(): void {
    this.dirty = true;
  }

  private resizeBuffer(): void {
    const W = this.tileMap.width;
    const H = this.tileMap.height;
    if (W === this.lastW && H === this.lastH) return;
    this.offscreen = new OffscreenCanvas(W, H);
    this.offCtx = this.offscreen.getContext('2d')!;
    this.imageData = this.offCtx.createImageData(W, H);
    this.lastW = W;
    this.lastH = H;
    this.dirty = true;
  }

  tick(_state: GameState): void {}

  render(ctx: CanvasRenderingContext2D, _camera: Camera): void {
    this.resizeBuffer();
    if (this.dirty) {
      this.rebuildBuffer();
      this.dirty = false;
    }

    ctx.imageSmoothingEnabled = false;
    ctx.globalAlpha = 0.45;
    ctx.drawImage(
      this.offscreen,
      0, 0,
      this.tileMap.width * Config.TILE_SIZE,
      this.tileMap.height * Config.TILE_SIZE,
    );
    ctx.globalAlpha = 1;
  }

  private getColor(countryId: number): [number, number, number] {
    let cached = this.colorCache.get(countryId);
    if (cached) return cached;

    const country = this.countries.get(countryId);
    if (!country) {
      cached = [0, 0, 0];
    } else {
      const hex = country.color;
      cached = [
        parseInt(hex.slice(1, 3), 16),
        parseInt(hex.slice(3, 5), 16),
        parseInt(hex.slice(5, 7), 16),
      ];
    }
    this.colorCache.set(countryId, cached);
    return cached;
  }

  private rebuildBuffer(): void {
    const W = this.tileMap.width;
    const H = this.tileMap.height;
    const data = this.imageData.data;

    // Build a distance-to-city map for fading near cities
    const cityDist = this.buildCityDistanceMap();

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const idx = y * W + x;
        const pxIdx = idx * 4;
        const owner = this.tileMap.owner[idx];

        if (owner === 0) {
          data[pxIdx + 3] = 0;
          continue;
        }

        const terrain = this.tileMap.terrain[idx] as TerrainType;
        if (terrain === TerrainType.FARMLAND || terrain === TerrainType.URBAN) {
          data[pxIdx + 3] = 0;
          continue;
        }

        const [r, g, b] = this.getColor(owner);
        data[pxIdx] = r;
        data[pxIdx + 1] = g;
        data[pxIdx + 2] = b;

        const dist = cityDist[idx];
        if (dist < 6) {
          data[pxIdx + 3] = Math.floor(60 + (255 - 60) * (dist / 6));
        } else {
          data[pxIdx + 3] = 255;
        }
      }
    }

    this.offCtx.putImageData(this.imageData, 0, 0);
  }

  private buildCityDistanceMap(): Uint8Array {
    const W = this.tileMap.width;
    const H = this.tileMap.height;
    const dist = new Uint8Array(W * H);
    dist.fill(255);

    const queue: number[] = [];
    for (let i = 0; i < W * H; i++) {
      if (this.tileMap.cityId[i] !== 0) {
        dist[i] = 0;
        queue.push(i);
      }
    }

    let head = 0;
    while (head < queue.length) {
      const idx = queue[head++];
      const d = dist[idx];
      if (d >= 6) continue;

      const x = idx % W;
      const y = Math.floor(idx / W);
      const neighbors = [
        y > 0 ? idx - W : -1,
        y < H - 1 ? idx + W : -1,
        x > 0 ? idx - 1 : -1,
        x < W - 1 ? idx + 1 : -1,
      ];

      for (const ni of neighbors) {
        if (ni < 0) continue;
        if (dist[ni] <= d + 1) continue;
        dist[ni] = d + 1;
        queue.push(ni);
      }
    }

    return dist;
  }
}
