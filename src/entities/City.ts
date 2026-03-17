import { Building } from './Building';

export enum CityTier {
  VILLAGE = 1,
  TOWN = 2,
  METROPOLIS = 3,
}

export class City {
  id: number;
  name: string;
  countryId: number;
  tier: CityTier = CityTier.VILLAGE;
  centerX: number;
  centerY: number;
  population = 100;
  urbanTiles = new Set<number>();
  farmTiles = new Set<number>();
  buildings: Building[] = [];

  constructor(id: number, name: string, countryId: number, cx: number, cy: number) {
    this.id = id;
    this.name = name;
    this.countryId = countryId;
    this.centerX = cx;
    this.centerY = cy;
  }

  getTotalTiles(): number {
    return this.urbanTiles.size + this.farmTiles.size;
  }

  getPopulationCap(): number {
    return this.urbanTiles.size * 200 + this.farmTiles.size * 50;
  }

  getFootprintRadius(): number {
    switch (this.tier) {
      case CityTier.VILLAGE: return 5;
      case CityTier.TOWN: return 10;
      case CityTier.METROPOLIS: return 18;
    }
  }
}
