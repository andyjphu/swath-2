import { TileMap } from '../map/TileMap';
import { Country } from '../entities/Country';
import { BuildingType } from '../entities/Building';
import { TerrainType } from '../map/Terrain';

export interface CountryUpdate {
  countryId: number;
  resources: { gold: number; food: number; manpower: number; iron: number; wood: number; cloth: number };
  stability: number;
  cities: { cityId: number; population: number }[];
}

export class EconomySystem {
  private _updates: CountryUpdate[] = [];

  constructor(private tileMap: TileMap, private countries: Map<number, Country>) {}

  consumeChanges(): CountryUpdate[] {
    const u = this._updates;
    this._updates = [];
    return u;
  }

  tick(): void {
    this._updates.length = 0;

    for (const country of this.countries.values()) {
      this.tickCountry(country);

      this._updates.push({
        countryId: country.id,
        resources: { ...country.resources },
        stability: country.stability,
        cities: country.cities.map(c => ({ cityId: c.id, population: c.population })),
      });
    }
  }

  private tickCountry(country: Country): void {
    const W = this.tileMap.width;

    // --- GOLD ---
    let goldIncome = 1; // base
    const taxMult = country.taxRate === 'low' ? 0.005 : country.taxRate === 'exorbitant' ? 0.02 : 0.01;
    goldIncome += country.totalPopulation * taxMult;

    for (const city of country.cities) {
      for (const b of city.buildings) {
        if (b.type === BuildingType.MARKET) goldIncome += 3;
        if (b.type === BuildingType.PORT) goldIncome += 2;
      }
    }

    // Trade partners
    goldIncome += country.tradePartners.size * 2;

    country.resources.gold += goldIncome;

    // --- FOOD ---
    let foodIncome = 0;
    for (const city of country.cities) {
      // Farmland tiles produce food
      foodIncome += city.farmTiles.size * 0.1;
      for (const b of city.buildings) {
        if (b.type === BuildingType.FARM) foodIncome += 2;
      }
    }
    const foodConsumption = country.totalPopulation * 0.002;
    country.resources.food += foodIncome - foodConsumption;

    // Food deficit → stability loss
    if (country.resources.food < 0) {
      country.stability = Math.max(0, country.stability - 0.2);
      country.resources.food = 0;
    }

    // --- MANPOWER ---
    let manpowerGain = 0;
    for (const city of country.cities) {
      manpowerGain += city.population * 0.001;
    }
    const manpowerCap = country.getManpowerPool();
    country.resources.manpower = Math.min(manpowerCap, country.resources.manpower + manpowerGain);

    // --- PRODUCTION (iron/wood/cloth) ---
    for (const city of country.cities) {
      for (const b of city.buildings) {
        if (b.type !== BuildingType.WORKSHOP) continue;
        // Check adjacent terrain to city center
        const cx = city.centerX;
        const cy = city.centerY;
        let hasForest = false, hasHills = false, hasPlains = false;
        for (let dy = -2; dy <= 2; dy++) {
          for (let dx = -2; dx <= 2; dx++) {
            if (!this.tileMap.inBounds(cx + dx, cy + dy)) continue;
            const t = this.tileMap.terrain[(cy + dy) * W + (cx + dx)] as TerrainType;
            if (t === TerrainType.FOREST) hasForest = true;
            if (t === TerrainType.HILLS) hasHills = true;
            if (t === TerrainType.PLAINS || t === TerrainType.FARMLAND) hasPlains = true;
          }
        }
        if (hasForest) country.resources.wood += 1;
        if (hasHills) country.resources.iron += 1;
        if (hasPlains) country.resources.cloth += 1;
      }
    }

    // --- STABILITY ---
    if (country.taxRate === 'exorbitant') {
      country.stability = Math.max(0, country.stability - 0.1);
    } else if (country.taxRate === 'low') {
      country.stability = Math.min(100, country.stability + 0.05);
    }
  }
}
