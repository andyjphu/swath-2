import { TileMap } from '../map/TileMap';
import { Country, TaxRate } from '../entities/Country';
import { City } from '../entities/City';
import { BuildingType } from '../entities/Building';
import { CountryUpdate } from '../systems/EconomySystem';
import { EventBus } from '../core/EventBus';

export interface TileChanges {
  ownerChanges: number[];
  terrainChanges: number[];
  cityIdChanges: number[];
  countryUpdates: CountryUpdate[];
}

type ChangeListener = (changes: TileChanges) => void;

export class SimBridge {
  private worker: Worker;
  private listeners: ChangeListener[] = [];
  private ready = false;
  private pendingTicks = 0;

  constructor(
    private tileMap: TileMap,
    private countries: Map<number, Country>,
    private cities: Map<number, City>,
  ) {
    this.worker = new Worker(
      new URL('./SimWorker.ts', import.meta.url),
      { type: 'module' },
    );

    this.worker.onmessage = (e: MessageEvent) => {
      const msg = e.data;
      switch (msg.type) {
        case 'ready':
          this.ready = true;
          for (let i = 0; i < this.pendingTicks; i++) {
            this.worker.postMessage({ type: 'tick' });
          }
          this.pendingTicks = 0;
          break;

        case 'tick-result':
          this.applyChanges(msg);
          break;

        case 'build-result':
          EventBus.emit('build-result', msg);
          break;
      }
    };
  }

  init(): void {
    const countriesData = [];
    for (const country of this.countries.values()) {
      countriesData.push({
        id: country.id,
        name: country.name,
        color: country.color,
        isPlayer: country.isPlayer,
        ownedTileCount: country.ownedTileCount,
        resources: { ...country.resources },
        cities: country.cities.map(city => ({
          id: city.id,
          name: city.name,
          countryId: city.countryId,
          centerX: city.centerX,
          centerY: city.centerY,
          population: city.population,
          tier: city.tier,
          urbanTiles: Array.from(city.urbanTiles),
          farmTiles: Array.from(city.farmTiles),
        })),
      });
    }

    this.worker.postMessage({
      type: 'init',
      width: this.tileMap.width,
      height: this.tileMap.height,
      terrain: this.tileMap.terrain,
      owner: this.tileMap.owner,
      cityId: this.tileMap.cityId,
      building: this.tileMap.building,
      population: this.tileMap.population,
      countries: countriesData,
    });
  }

  tick(): void {
    if (!this.ready) {
      this.pendingTicks++;
      return;
    }
    this.worker.postMessage({ type: 'tick' });
  }

  onChange(listener: ChangeListener): void {
    this.listeners.push(listener);
  }

  sendBuild(cityId: number, buildingType: BuildingType): void {
    this.worker.postMessage({ type: 'build', cityId, buildingType });
  }

  sendSetTax(countryId: number, taxRate: TaxRate): void {
    // Update main thread immediately for responsive UI
    const country = this.countries.get(countryId);
    if (country) country.taxRate = taxRate;
    this.worker.postMessage({ type: 'set-tax', countryId, taxRate });
  }

  private applyChanges(msg: TileChanges): void {
    const { ownerChanges, terrainChanges, cityIdChanges, countryUpdates } = msg;

    for (let i = 0; i < ownerChanges.length; i += 2) {
      this.tileMap.owner[ownerChanges[i]] = ownerChanges[i + 1];
    }
    for (let i = 0; i < terrainChanges.length; i += 2) {
      this.tileMap.terrain[terrainChanges[i]] = terrainChanges[i + 1];
    }
    for (let i = 0; i < cityIdChanges.length; i += 2) {
      this.tileMap.cityId[cityIdChanges[i]] = cityIdChanges[i + 1];
    }

    // Sync entity state from worker
    if (countryUpdates) {
      for (const cu of countryUpdates) {
        const country = this.countries.get(cu.countryId);
        if (!country) continue;
        Object.assign(country.resources, cu.resources);
        country.stability = cu.stability;
        for (const cityUpdate of cu.cities) {
          const city = this.cities.get(cityUpdate.cityId);
          if (city) city.population = cityUpdate.population;
        }
      }
    }

    for (const listener of this.listeners) {
      listener(msg);
    }
  }
}
