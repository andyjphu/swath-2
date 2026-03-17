import { TileMap } from '../map/TileMap';
import { Country } from '../entities/Country';
import { TerrainType, TerrainConfigs } from '../map/Terrain';

export class TerritorySystem {
  // Cache border tiles per country for performance
  private borderCache = new Map<number, Set<number>>();
  private dirtyCountries = new Set<number>();

  // Change tracking for worker communication
  private _ownerChanges: number[] = [];

  constructor(private tileMap: TileMap, private countries: Map<number, Country>) {}

  consumeChanges(): number[] {
    const changes = this._ownerChanges;
    this._ownerChanges = [];
    return changes;
  }

  /** Mark a country's border cache as needing refresh */
  markDirty(countryId: number): void {
    this.dirtyCountries.add(countryId);
  }

  /** Get border tiles (owned tiles with at least one unowned/enemy neighbor) */
  getBorderTiles(countryId: number): Set<number> {
    if (this.dirtyCountries.has(countryId) || !this.borderCache.has(countryId)) {
      this.rebuildBorderCache(countryId);
      this.dirtyCountries.delete(countryId);
    }
    return this.borderCache.get(countryId)!;
  }

  private rebuildBorderCache(countryId: number): void {
    const W = this.tileMap.width;
    const H = this.tileMap.height;
    const border = new Set<number>();

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const idx = y * W + x;
        if (this.tileMap.owner[idx] !== countryId) continue;

        // Check 4-directional neighbors
        const neighbors = [
          x > 0 ? idx - 1 : -1,
          x < W - 1 ? idx + 1 : -1,
          y > 0 ? idx - W : -1,
          y < H - 1 ? idx + W : -1,
        ];

        for (const ni of neighbors) {
          if (ni < 0) continue;
          if (this.tileMap.owner[ni] !== countryId) {
            border.add(idx);
            break;
          }
        }
      }
    }

    this.borderCache.set(countryId, border);
  }

  /** Run one tick of territory expansion for all countries */
  tick(): void {
    const W = this.tileMap.width;
    const H = this.tileMap.height;
    this._ownerChanges.length = 0;

    for (const [countryId, country] of this.countries) {
      const borders = this.getBorderTiles(countryId);
      if (borders.size === 0) continue;

      // Expansion rate: diminishing returns for large countries
      const baseRate = Math.max(1, Math.floor(country.getManpowerPool() * 0.05));
      const sizeModifier = Math.max(0.1, 1 - country.ownedTileCount / 50000);
      const expansionBudget = Math.max(1, Math.floor(baseRate * sizeModifier));

      let expanded = 0;
      const borderArr = Array.from(borders);

      // Shuffle for randomized expansion direction
      for (let i = borderArr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [borderArr[i], borderArr[j]] = [borderArr[j], borderArr[i]];
      }

      for (const idx of borderArr) {
        if (expanded >= expansionBudget) break;

        const x = idx % W;
        const y = Math.floor(idx / W);

        // Try to expand into unowned passable neighbors
        const neighbors = [
          { nx: x, ny: y - 1 },
          { nx: x, ny: y + 1 },
          { nx: x - 1, ny: y },
          { nx: x + 1, ny: y },
        ];

        // Shuffle neighbors too
        for (let i = neighbors.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [neighbors[i], neighbors[j]] = [neighbors[j], neighbors[i]];
        }

        for (const { nx, ny } of neighbors) {
          if (expanded >= expansionBudget) break;
          if (!this.tileMap.inBounds(nx, ny)) continue;

          const ni = ny * W + nx;
          if (this.tileMap.owner[ni] !== 0) continue; // Already owned

          const terrain = this.tileMap.terrain[ni] as TerrainType;
          if (!TerrainConfigs[terrain].passable) continue;

          // Claim the tile
          this.tileMap.owner[ni] = countryId;
          this._ownerChanges.push(ni, countryId);
          country.ownedTileCount++;
          expanded++;

          // Mark neighbors' countries as dirty
          this.dirtyCountries.add(countryId);

          // Auto-claim enclosed impassable neighbors (mountains, water)
          this.claimEnclosedNeighbors(ni, countryId, country, W, H);
        }
      }
    }
  }

  /** Claim impassable tiles that are fully surrounded by the same owner */
  private claimEnclosedNeighbors(idx: number, countryId: number, country: Country, W: number, H: number): void {
    const x = idx % W;
    const y = Math.floor(idx / W);
    const adjIndices = [
      y > 0 ? idx - W : -1,
      y < H - 1 ? idx + W : -1,
      x > 0 ? idx - 1 : -1,
      x < W - 1 ? idx + 1 : -1,
    ];

    for (const adj of adjIndices) {
      if (adj < 0) continue;
      if (this.tileMap.owner[adj] !== 0) continue;

      // Only check impassable tiles
      const terrain = this.tileMap.terrain[adj] as TerrainType;
      if (TerrainConfigs[terrain].passable) continue;

      // Check all 4 neighbors of this impassable tile
      const ax = adj % W;
      const ay = Math.floor(adj / W);
      let allOwned = true;
      if (ax > 0 && this.tileMap.owner[adj - 1] !== countryId) allOwned = false;
      if (allOwned && ax < W - 1 && this.tileMap.owner[adj + 1] !== countryId) allOwned = false;
      if (allOwned && ay > 0 && this.tileMap.owner[adj - W] !== countryId) allOwned = false;
      if (allOwned && ay < H - 1 && this.tileMap.owner[adj + W] !== countryId) allOwned = false;

      if (allOwned) {
        this.tileMap.owner[adj] = countryId;
        this._ownerChanges.push(adj, countryId);
        country.ownedTileCount++;
      }
    }
  }

  /** Recalculate ownedTileCount for all countries */
  recountTiles(): void {
    for (const country of this.countries.values()) {
      country.ownedTileCount = 0;
    }
    const size = this.tileMap.width * this.tileMap.height;
    for (let i = 0; i < size; i++) {
      const owner = this.tileMap.owner[i];
      if (owner !== 0) {
        const country = this.countries.get(owner);
        if (country) country.ownedTileCount++;
      }
    }
  }
}
