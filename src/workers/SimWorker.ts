import { TileMap } from '../map/TileMap';
import { TerritorySystem } from '../systems/TerritorySystem';
import { CityGrowthSystem } from '../systems/CityGrowthSystem';
import { EconomySystem } from '../systems/EconomySystem';
import { Country, TaxRate } from '../entities/Country';
import { City } from '../entities/City';
import { BuildingType, BuildingConfigs } from '../entities/Building';
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
let cities: Map<number, City>;
let territorySystem: TerritorySystem;
let cityGrowthSystem: CityGrowthSystem;
let economySystem: EconomySystem;

self.onmessage = (e: MessageEvent) => {
  const msg = e.data;

  switch (msg.type) {
    case 'init': {
      setMapSize(msg.width, msg.height);

      tileMap = new TileMap();
      tileMap.terrain = new Uint8Array(msg.terrain);
      tileMap.owner = new Uint16Array(msg.owner);
      tileMap.cityId = new Uint16Array(msg.cityId);
      tileMap.building = new Uint8Array(msg.building);
      tileMap.population = new Uint16Array(msg.population);

      countries = new Map();
      cities = new Map();
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
          cities.set(city.id, city);
        }

        countries.set(country.id, country);
      }

      territorySystem = new TerritorySystem(tileMap, countries);
      cityGrowthSystem = new CityGrowthSystem(tileMap, countries);
      economySystem = new EconomySystem(tileMap, countries);
      territorySystem.recountTiles();

      (self as unknown as Worker).postMessage({ type: 'ready' });
      break;
    }

    case 'tick': {
      territorySystem.tick();
      cityGrowthSystem.tick();
      economySystem.tick();

      const ownerChanges = territorySystem.consumeChanges();
      const { terrainChanges, cityIdChanges } = cityGrowthSystem.consumeChanges();
      const countryUpdates = economySystem.consumeChanges();

      (self as unknown as Worker).postMessage({
        type: 'tick-result',
        ownerChanges,
        terrainChanges,
        cityIdChanges,
        countryUpdates,
      });
      break;
    }

    case 'set-tax': {
      const country = countries.get(msg.countryId);
      if (country) {
        country.taxRate = msg.taxRate as TaxRate;
      }
      break;
    }

    case 'build': {
      const city = cities.get(msg.cityId);
      if (!city) {
        post({ type: 'build-result', success: false, error: 'City not found' });
        break;
      }
      const country = countries.get(city.countryId);
      if (!country) {
        post({ type: 'build-result', success: false, error: 'Country not found' });
        break;
      }

      const config = BuildingConfigs[msg.buildingType as BuildingType];
      if (!config) {
        post({ type: 'build-result', success: false, error: 'Invalid building type' });
        break;
      }

      // Check costs
      if (country.resources.gold < config.cost.gold) {
        post({ type: 'build-result', success: false, error: 'Not enough gold' });
        break;
      }
      if (config.cost.wood && country.resources.wood < config.cost.wood) {
        post({ type: 'build-result', success: false, error: 'Not enough wood' });
        break;
      }
      if (config.cost.iron && country.resources.iron < config.cost.iron) {
        post({ type: 'build-result', success: false, error: 'Not enough iron' });
        break;
      }

      // Deduct costs
      country.resources.gold -= config.cost.gold;
      if (config.cost.wood) country.resources.wood -= config.cost.wood;
      if (config.cost.iron) country.resources.iron -= config.cost.iron;

      // Place building
      city.buildings.push({
        type: msg.buildingType as BuildingType,
        cityId: city.id,
        tileIndex: 0,
      });

      post({
        type: 'build-result',
        success: true,
        cityId: city.id,
        buildingType: msg.buildingType,
        resources: { ...country.resources },
      });
      break;
    }
  }
};

function post(data: unknown) {
  (self as unknown as Worker).postMessage(data);
}
