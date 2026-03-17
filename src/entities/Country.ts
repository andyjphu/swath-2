import { City } from './City';

export interface Resources {
  gold: number;
  food: number;
  manpower: number;
  iron: number;
  wood: number;
  cloth: number;
}

export type TaxRate = 'low' | 'normal' | 'exorbitant';

export class Country {
  id: number;
  name: string;
  color: string;
  isPlayer: boolean;
  resources: Resources;
  stability = 70;
  taxRate: TaxRate = 'normal';
  cities: City[] = [];
  ownedTileCount = 0;
  wars = new Set<number>();
  tradePartners = new Set<number>();
  advancements = new Set<string>();

  constructor(id: number, name: string, color: string, isPlayer: boolean) {
    this.id = id;
    this.name = name;
    this.color = color;
    this.isPlayer = isPlayer;
    this.resources = {
      gold: 100,
      food: 50,
      manpower: 50,
      iron: 0,
      wood: 0,
      cloth: 0,
    };
  }

  get totalPopulation(): number {
    let total = 0;
    for (const city of this.cities) {
      total += city.population;
    }
    return total;
  }

  getManpowerPool(): number {
    return Math.floor(this.totalPopulation * 0.1);
  }
}
