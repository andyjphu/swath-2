import { Layer } from '../GameRenderer';
import { Camera } from '../Camera';
import { GameState } from '../../core/GameState';
import { TileMap } from '../../map/TileMap';
import { Country } from '../../entities/Country';
import { Config } from '../../core/Config';

export class CityLayer implements Layer {
  isWorldSpace = true;
  private offscreen!: OffscreenCanvas;
  private offCtx!: OffscreenCanvasRenderingContext2D;
  private imageData!: ImageData;
  private lastW = 0;
  private lastH = 0;
  private dirty = true;

  private colorCache = new Map<number, [number, number, number]>();

  constructor(private tileMap: TileMap, private countries: Map<number, Country>) {}

  private getLightColor(countryId: number): [number, number, number] {
    let cached = this.colorCache.get(countryId);
    if (cached) return cached;

    const country = this.countries.get(countryId);
    if (!country) {
      cached = [200, 200, 200];
    } else {
      const hex = country.color;
      // Lighter version: blend toward white (70% white, 30% country color)
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      cached = [
        Math.floor(r * 0.3 + 255 * 0.7),
        Math.floor(g * 0.3 + 255 * 0.7),
        Math.floor(b * 0.3 + 255 * 0.7),
      ];
    }
    this.colorCache.set(countryId, cached);
    return cached;
  }

  init(_ctx: CanvasRenderingContext2D): void {
    this.resizeBuffer();
  }

  markDirty(): void {
    this.dirty = true;
  }

  tick(_state: GameState): void {}

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

  render(ctx: CanvasRenderingContext2D, _camera: Camera): void {
    this.resizeBuffer();
    if (this.dirty) {
      this.rebuildBuffer();
      this.dirty = false;
    }

    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(
      this.offscreen,
      0, 0,
      this.tileMap.width * Config.TILE_SIZE,
      this.tileMap.height * Config.TILE_SIZE,
    );
  }

  private rebuildBuffer(): void {
    const W = this.tileMap.width;
    const H = this.tileMap.height;
    const data = this.imageData.data;

    data.fill(0);

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const idx = y * W + x;
        const cid = this.tileMap.cityId[idx];
        if (cid === 0) continue;

        // Check if this tile is on the edge of its city
        let isEdge = false;
        if (x === 0 || this.tileMap.cityId[idx - 1] !== cid) isEdge = true;
        if (!isEdge && x === W - 1 || this.tileMap.cityId[idx + 1] !== cid) isEdge = true;
        if (!isEdge && y === 0 || this.tileMap.cityId[idx - W] !== cid) isEdge = true;
        if (!isEdge && (y === H - 1 || this.tileMap.cityId[idx + W] !== cid)) isEdge = true;

        if (isEdge) {
          const owner = this.tileMap.owner[idx];
          const [r, g, b] = this.getLightColor(owner);
          const pxIdx = idx * 4;
          data[pxIdx] = r;
          data[pxIdx + 1] = g;
          data[pxIdx + 2] = b;
          data[pxIdx + 3] = 200;
        }
      }
    }

    this.offCtx.putImageData(this.imageData, 0, 0);
  }
}
