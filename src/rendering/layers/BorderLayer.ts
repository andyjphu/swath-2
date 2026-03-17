import { Layer } from '../GameRenderer';
import { Camera } from '../Camera';
import { GameState } from '../../core/GameState';
import { TileMap } from '../../map/TileMap';
import { Config } from '../../core/Config';
import { Country } from '../../entities/Country';

export class BorderLayer implements Layer {
  isWorldSpace = true;
  private offscreen!: OffscreenCanvas;
  private offCtx!: OffscreenCanvasRenderingContext2D;
  private imageData!: ImageData;
  private lastW = 0;
  private lastH = 0;
  private dirty = true;

  constructor(private tileMap: TileMap, private countries: Map<number, Country>) {}

  markDirty(): void {
    this.dirty = true;
  }

  init(_ctx: CanvasRenderingContext2D): void {
    this.resizeBuffer();
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

    // Clear
    data.fill(0);

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const idx = y * W + x;
        const owner = this.tileMap.owner[idx];
        if (owner === 0) continue;

        // Check if any neighbor has a different owner (including 0)
        let isBorder = false;
        if (x > 0 && this.tileMap.owner[idx - 1] !== owner) isBorder = true;
        if (!isBorder && x < W - 1 && this.tileMap.owner[idx + 1] !== owner) isBorder = true;
        if (!isBorder && y > 0 && this.tileMap.owner[idx - W] !== owner) isBorder = true;
        if (!isBorder && y < H - 1 && this.tileMap.owner[idx + W] !== owner) isBorder = true;

        if (isBorder) {
          const pxIdx = idx * 4;
          // Darker version of country color
          const country = this.countries.get(owner);
          if (country) {
            const hex = country.color;
            data[pxIdx] = Math.floor(parseInt(hex.slice(1, 3), 16) * 0.4);
            data[pxIdx + 1] = Math.floor(parseInt(hex.slice(3, 5), 16) * 0.4);
            data[pxIdx + 2] = Math.floor(parseInt(hex.slice(5, 7), 16) * 0.4);
            data[pxIdx + 3] = 200;
          }
        }
      }
    }

    this.offCtx.putImageData(this.imageData, 0, 0);
  }
}
