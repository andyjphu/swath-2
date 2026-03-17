import { Config } from '../core/Config';

export class RiverSystem {
  private riverTiles = new Set<number>();

  private index(x: number, y: number): number {
    return y * Config.MAP_WIDTH + x;
  }

  addRiver(x: number, y: number): void {
    this.riverTiles.add(this.index(x, y));
  }

  removeRiver(x: number, y: number): void {
    this.riverTiles.delete(this.index(x, y));
  }

  clear(): void {
    this.riverTiles.clear();
  }

  isRiver(x: number, y: number): boolean {
    return this.riverTiles.has(this.index(x, y));
  }

  getRiverFertilityBonus(x: number, y: number): number {
    if (this.isRiver(x, y)) return 1.5;
    // Check 1-tile neighbors
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        if (this.isRiver(x + dx, y + dy)) return 1.5;
      }
    }
    // Check 2-tile neighbors
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        if (Math.abs(dx) <= 1 && Math.abs(dy) <= 1) continue;
        if (this.isRiver(x + dx, y + dy)) return 1.2;
      }
    }
    return 1.0;
  }

  getAllRiverTiles(): Set<number> {
    return this.riverTiles;
  }
}
