import { TileMap } from '../map/TileMap';
import { Country } from '../entities/Country';
import { City, CityTier } from '../entities/City';
import { TerrainType } from '../map/Terrain';

export class CityGrowthSystem {
  // Change tracking for worker communication
  private _terrainChanges: number[] = [];
  private _cityIdChanges: number[] = [];

  constructor(private tileMap: TileMap, private countries: Map<number, Country>) {}

  consumeChanges(): { terrainChanges: number[]; cityIdChanges: number[] } {
    const result = {
      terrainChanges: this._terrainChanges,
      cityIdChanges: this._cityIdChanges,
    };
    this._terrainChanges = [];
    this._cityIdChanges = [];
    return result;
  }

  tick(): void {
    this._terrainChanges.length = 0;
    this._cityIdChanges.length = 0;
    for (const country of this.countries.values()) {
      for (const city of country.cities) {
        this.growPopulation(city, country);
        this.spreadCity(city, country);
      }
    }
  }

  private growPopulation(city: City, country: Country): void {
    const cap = city.getPopulationCap();
    if (cap <= 0) return;

    const baseGrowth = city.population * 0.001;
    const foodBonus = Math.max(0, country.resources.food * 0.002);
    const capacityFactor = Math.max(0, 1 - city.population / cap);
    const growth = (baseGrowth + foodBonus) * capacityFactor;

    city.population = Math.min(cap, city.population + growth);
  }

  private spreadCity(city: City, country: Country): void {
    const W = this.tileMap.width;

    // Spread threshold scales with tier
    const spreadThreshold = city.tier === CityTier.VILLAGE ? 30 : city.tier === CityTier.TOWN ? 20 : 15;
    const tilesPerPop = city.population / Math.max(1, city.getTotalTiles());
    if (tilesPerPop < spreadThreshold) return;

    // Find best adjacent tile to claim
    const radius = city.getFootprintRadius();
    const cx = city.centerX;
    const cy = city.centerY;

    let bestTile = -1;
    let bestScore = -Infinity;

    // Check tiles within city radius
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (dx * dx + dy * dy > radius * radius) continue;
        const nx = cx + dx;
        const ny = cy + dy;
        if (!this.tileMap.inBounds(nx, ny)) continue;

        const ni = ny * W + nx;
        // Must be owned by this country and not already a city tile
        if (this.tileMap.owner[ni] !== country.id) continue;
        if (this.tileMap.cityId[ni] !== 0) continue;

        const terrain = this.tileMap.terrain[ni] as TerrainType;
        if (terrain === TerrainType.WATER || terrain === TerrainType.MOUNTAINS) continue;

        // Must be adjacent to an existing city tile (no disjoint tiles)
        let adjacent = false;
        if (nx > 0 && this.tileMap.cityId[ni - 1] === city.id) adjacent = true;
        if (!adjacent && nx < W - 1 && this.tileMap.cityId[ni + 1] === city.id) adjacent = true;
        if (!adjacent && ny > 0 && this.tileMap.cityId[ni - W] === city.id) adjacent = true;
        if (!adjacent && ny < this.tileMap.height - 1 && this.tileMap.cityId[ni + W] === city.id) adjacent = true;
        if (!adjacent) continue;

        // Score: prefer close tiles, plains for farms
        const dist = Math.sqrt(dx * dx + dy * dy);
        let score = radius - dist;
        if (terrain === TerrainType.PLAINS) score += 2; // Good for farming
        if (terrain === TerrainType.HILLS) score -= 1;

        if (score > bestScore) {
          bestScore = score;
          bestTile = ni;
        }
      }
    }

    if (bestTile < 0) return;

    // New edge tiles are always farms (cities grow outward with farms on periphery)
    this.tileMap.cityId[bestTile] = city.id;
    this._cityIdChanges.push(bestTile, city.id);
    city.farmTiles.add(bestTile);
    this.tileMap.terrain[bestTile] = TerrainType.FARMLAND;
    this._terrainChanges.push(bestTile, TerrainType.FARMLAND);

    // Check if we need more urban — if so, convert the innermost farm to urban
    // Target urban ratio: villages 30%, towns 50%, metropolis 70%
    const targetUrban = city.tier === CityTier.VILLAGE ? 0.3 : city.tier === CityTier.TOWN ? 0.5 : 0.7;
    const urbanRatio = city.urbanTiles.size / Math.max(1, city.getTotalTiles());

    if (urbanRatio < targetUrban && city.farmTiles.size > 0) {
      // Find innermost farm tile (closest to city center)
      let closestFarm = -1;
      let closestDist = Infinity;
      for (const ft of city.farmTiles) {
        const fx = ft % W;
        const fy = Math.floor(ft / W);
        const d = (fx - cx) * (fx - cx) + (fy - cy) * (fy - cy);
        if (d < closestDist) {
          closestDist = d;
          closestFarm = ft;
        }
      }
      if (closestFarm >= 0) {
        city.farmTiles.delete(closestFarm);
        city.urbanTiles.add(closestFarm);
        this.tileMap.terrain[closestFarm] = TerrainType.URBAN;
        this._terrainChanges.push(closestFarm, TerrainType.URBAN);
      }
    }
  }

  /** Initialize a city's center tile */
  initCity(city: City, country: Country): void {
    const W = this.tileMap.width;
    const idx = city.centerY * W + city.centerX;

    this.tileMap.owner[idx] = country.id;
    this.tileMap.cityId[idx] = city.id;
    this.tileMap.terrain[idx] = TerrainType.URBAN;
    city.urbanTiles.add(idx);

    // Claim a small area around the city center
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        if (dx === 0 && dy === 0) continue;
        if (dx * dx + dy * dy > 4) continue;
        const nx = city.centerX + dx;
        const ny = city.centerY + dy;
        if (!this.tileMap.inBounds(nx, ny)) continue;
        const ni = ny * W + nx;
        const terrain = this.tileMap.terrain[ni] as TerrainType;
        if (terrain === TerrainType.WATER || terrain === TerrainType.MOUNTAINS) continue;
        this.tileMap.owner[ni] = country.id;
      }
    }
  }
}
