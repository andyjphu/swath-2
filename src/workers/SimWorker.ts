import { TileMap } from '../map/TileMap';
import { TerritorySystem } from '../systems/TerritorySystem';
import { CityGrowthSystem } from '../systems/CityGrowthSystem';
import { Country } from '../entities/Country';
import { City } from '../entities/City';
import { setMapSize } from '../core/Config';

interface CountryData {
  id: number;
  name: string;
  color: string;
  isPlayer: boolean;
  ownedTileCount: number;
  resources: { gold: number; food: number; manpower: number; iron: number; wood: number; cloth: number };
  cities: CityData[];
}

interface CityData {
  id: number;
  name: string;
  countryId: number;
  centerX: number;
  centerY: number;
  population: number;
  tier: number;
  urbanTiles: number[];
  farmTiles: number[];
}

let tileMap: TileMap;
let countries: Map<number, Country>;
let territorySystem: TerritorySystem;
let cityGrowthSystem: CityGrowthSystem;

self.onmessage = (e: MessageEvent) => {
  const msg = e.data;

  switch (msg.type) {
    case 'init': {
      setMapSize(msg.width, msg.height);

      tileMap = new TileMap();
      // Overwrite with actual map data
      tileMap.terrain = new Uint8Array(msg.terrain);
      tileMap.owner = new Uint16Array(msg.owner);
      tileMap.cityId = new Uint16Array(msg.cityId);
      tileMap.building = new Uint8Array(msg.building);
      tileMap.population = new Uint16Array(msg.population);

      // Reconstruct countries and cities from plain data
      countries = new Map();
      for (const cd of msg.countries as CountryData[]) {
        const country = new Country(cd.id, cd.name, cd.color, cd.isPlayer);
        country.ownedTileCount = cd.ownedTileCount;
        Object.assign(country.resources, cd.resources);

        for (const cityData of cd.cities) {
          const city = new City(cityData.id, cityData.name, cityData.countryId, cityData.centerX, cityData.centerY);
          city.population = cityData.population;
          city.tier = cityData.tier;
          city.urbanTiles = new Set(cityData.urbanTiles);
          city.farmTiles = new Set(cityData.farmTiles);
          country.cities.push(city);
        }

        countries.set(country.id, country);
      }

      territorySystem = new TerritorySystem(tileMap, countries);
      cityGrowthSystem = new CityGrowthSystem(tileMap, countries);
      territorySystem.recountTiles();

      (self as unknown as Worker).postMessage({ type: 'ready' });
      break;
    }

    case 'tick': {
      territorySystem.tick();
      cityGrowthSystem.tick();

      const ownerChanges = territorySystem.consumeChanges();
      const { terrainChanges, cityIdChanges } = cityGrowthSystem.consumeChanges();

      (self as unknown as Worker).postMessage({
        type: 'tick-result',
        ownerChanges,
        terrainChanges,
        cityIdChanges,
      });
      break;
    }
  }
};
