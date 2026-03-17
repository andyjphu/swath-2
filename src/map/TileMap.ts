import { Config } from '../core/Config';
import { TerrainType, TerrainConfigs } from './Terrain';

export class TileMap {
  width: number;
  height: number;
  terrain: Uint8Array;
  owner: Uint16Array;
  building: Uint8Array;
  population: Uint16Array;
  cityId: Uint16Array;

  constructor() {
    this.width = Config.MAP_WIDTH;
    this.height = Config.MAP_HEIGHT;
    const size = this.width * this.height;
    this.terrain = new Uint8Array(size);
    this.owner = new Uint16Array(size);
    this.building = new Uint8Array(size);
    this.population = new Uint16Array(size);
    this.cityId = new Uint16Array(size);
  }

  /** Crop the tile map to a sub-region, reallocating all arrays. */
  crop(x1: number, y1: number, x2: number, y2: number): void {
    const newW = x2 - x1 + 1;
    const newH = y2 - y1 + 1;
    const newSize = newW * newH;

    const newTerrain = new Uint8Array(newSize);
    const newOwner = new Uint16Array(newSize);
    const newBuilding = new Uint8Array(newSize);
    const newPop = new Uint16Array(newSize);
    const newCity = new Uint16Array(newSize);

    for (let y = 0; y < newH; y++) {
      for (let x = 0; x < newW; x++) {
        const srcIdx = (y + y1) * this.width + (x + x1);
        const dstIdx = y * newW + x;
        newTerrain[dstIdx] = this.terrain[srcIdx];
        newOwner[dstIdx] = this.owner[srcIdx];
        newBuilding[dstIdx] = this.building[srcIdx];
        newPop[dstIdx] = this.population[srcIdx];
        newCity[dstIdx] = this.cityId[srcIdx];
      }
    }

    this.width = newW;
    this.height = newH;
    this.terrain = newTerrain;
    this.owner = newOwner;
    this.building = newBuilding;
    this.population = newPop;
    this.cityId = newCity;
  }

  index(x: number, y: number): number {
    return y * this.width + x;
  }

  inBounds(x: number, y: number): boolean {
    return x >= 0 && x < this.width && y >= 0 && y < this.height;
  }

  getTerrainAt(x: number, y: number): TerrainType {
    if (!this.inBounds(x, y)) return TerrainType.WATER;
    return this.terrain[this.index(x, y)] as TerrainType;
  }

  setTerrain(x: number, y: number, t: TerrainType): void {
    if (this.inBounds(x, y)) {
      this.terrain[this.index(x, y)] = t;
    }
  }

  getOwner(x: number, y: number): number {
    if (!this.inBounds(x, y)) return 0;
    return this.owner[this.index(x, y)];
  }

  setOwner(x: number, y: number, id: number): void {
    if (this.inBounds(x, y)) {
      this.owner[this.index(x, y)] = id;
    }
  }

  isPassable(x: number, y: number): boolean {
    const t = this.getTerrainAt(x, y);
    return TerrainConfigs[t].passable;
  }

  getNeighbors(x: number, y: number): { x: number; y: number }[] {
    const result: { x: number; y: number }[] = [];
    if (x > 0) result.push({ x: x - 1, y });
    if (x < this.width - 1) result.push({ x: x + 1, y });
    if (y > 0) result.push({ x, y: y - 1 });
    if (y < this.height - 1) result.push({ x, y: y + 1 });
    return result;
  }

  getTilesInRadius(cx: number, cy: number, r: number): { x: number; y: number }[] {
    const result: { x: number; y: number }[] = [];
    const r2 = r * r;
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy <= r2) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (this.inBounds(nx, ny)) {
            result.push({ x: nx, y: ny });
          }
        }
      }
    }
    return result;
  }
}
