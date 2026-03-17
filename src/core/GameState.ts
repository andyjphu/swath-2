import { Country } from '../entities/Country';
import { City } from '../entities/City';

export class GameState {
  currentTick = 0;
  speedMultiplier = 1;
  isPaused = false;

  countries = new Map<number, Country>();
  cities = new Map<number, City>();
  playerId = 1;
  nextCityId = 1;

  addCountry(country: Country): void {
    this.countries.set(country.id, country);
  }

  addCity(city: City, country: Country): void {
    city.id = this.nextCityId++;
    this.cities.set(city.id, city);
    country.cities.push(city);
  }

  getPlayerCountry(): Country | undefined {
    return this.countries.get(this.playerId);
  }

  reset(): void {
    this.currentTick = 0;
    this.speedMultiplier = 1;
    this.isPaused = false;
    this.countries.clear();
    this.cities.clear();
    this.nextCityId = 1;
  }
}
