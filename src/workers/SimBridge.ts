import { TileMap } from '../map/TileMap';
import { Country } from '../entities/Country';

export interface TileChanges {
  ownerChanges: number[];
  terrainChanges: number[];
  cityIdChanges: number[];
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
          // Process any ticks that queued while initializing
          for (let i = 0; i < this.pendingTicks; i++) {
            this.worker.postMessage({ type: 'tick' });
          }
          this.pendingTicks = 0;
          break;

        case 'tick-result':
          this.applyChanges(msg);
          break;
      }
    };
  }

  /** Send initial state to the worker */
  init(): void {
    // Serialize countries and cities to plain objects
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

  /** Request one simulation tick */
  tick(): void {
    if (!this.ready) {
      this.pendingTicks++;
      return;
    }
    this.worker.postMessage({ type: 'tick' });
  }

  /** Register a listener for tile changes */
  onChange(listener: ChangeListener): void {
    this.listeners.push(listener);
  }

  /** Apply changes from worker to the main thread's TileMap */
  private applyChanges(msg: TileChanges): void {
    const { ownerChanges, terrainChanges, cityIdChanges } = msg;

    // Apply owner changes
    for (let i = 0; i < ownerChanges.length; i += 2) {
      this.tileMap.owner[ownerChanges[i]] = ownerChanges[i + 1];
    }

    // Apply terrain changes
    for (let i = 0; i < terrainChanges.length; i += 2) {
      this.tileMap.terrain[terrainChanges[i]] = terrainChanges[i + 1];
    }

    // Apply cityId changes
    for (let i = 0; i < cityIdChanges.length; i += 2) {
      this.tileMap.cityId[cityIdChanges[i]] = cityIdChanges[i + 1];
    }

    // Notify listeners
    for (const listener of this.listeners) {
      listener(msg);
    }
  }
}
