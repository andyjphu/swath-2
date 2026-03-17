import { Layer } from '../GameRenderer';
import { Camera } from '../Camera';
import { GameState } from '../../core/GameState';
import { TileMap } from '../../map/TileMap';
import { RiverSystem } from '../../map/RiverSystem';
import { TerrainConfigs, TerrainType } from '../../map/Terrain';
import { Config } from '../../core/Config';

export class TerrainLayer implements Layer {
  isWorldSpace = true;
  private offscreen!: OffscreenCanvas;
  private offCtx!: OffscreenCanvasRenderingContext2D;
  private dirty = true;
  private imageData!: ImageData;
  private lastW = 0;
  private lastH = 0;

  constructor(private tileMap: TileMap, private rivers: RiverSystem) {
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
  }

  init(_ctx: CanvasRenderingContext2D): void {
    this.dirty = true;
  }

  tick(_state: GameState): void {}

  markDirty(): void {
    this.dirty = true;
  }

  render(ctx: CanvasRenderingContext2D, _camera: Camera): void {
    if (this.dirty) {
      this.resizeBuffer();
      this.rebuildBuffer();
      this.dirty = false;
    }

    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(
      this.offscreen,
      0, 0,
      this.tileMap.width * Config.TILE_SIZE,
      this.tileMap.height * Config.TILE_SIZE
    );
  }

  private rebuildBuffer(): void {
    const W = this.tileMap.width;
    const H = this.tileMap.height;
    const data = this.imageData.data;

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const idx = y * W + x;
        const pxIdx = idx * 4;

        const terrain = this.tileMap.terrain[idx] as TerrainType;
        const config = TerrainConfigs[terrain];
        const hex = config.color;

        let r = parseInt(hex.slice(1, 3), 16);
        let g = parseInt(hex.slice(3, 5), 16);
        let b = parseInt(hex.slice(5, 7), 16);

        if (this.rivers.isRiver(x, y) && terrain !== TerrainType.WATER) {
          r = 0x2a;
          g = 0x50;
          b = 0x9a;
        }

        data[pxIdx] = r;
        data[pxIdx + 1] = g;
        data[pxIdx + 2] = b;
        data[pxIdx + 3] = 255;
      }
    }

    this.offCtx.putImageData(this.imageData, 0, 0);
  }
}
