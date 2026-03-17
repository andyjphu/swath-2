import { Config } from '../core/Config';
import { TileMap } from './TileMap';
import { TerrainType } from './Terrain';

export interface Province {
  id: number;
  name: string;
  tiles: Set<number>;
  center: { x: number; y: number };
}

const PROVINCE_NAMES = [
  'Castile', 'Aragon', 'Portugal', 'Galicia', 'Andalusia', 'Leon', 'Navarre', 'Catalonia',
  'Normandy', 'Brittany', 'Aquitaine', 'Burgundy', 'Provence', 'Champagne', 'Picardy', 'Gascony',
  'Flanders', 'Holland', 'Brabant', 'Frisia',
  'Wessex', 'Mercia', 'Northumbria', 'Wales', 'Scotland', 'Ulster', 'Munster', 'Leinster',
  'Saxony', 'Bavaria', 'Swabia', 'Franconia', 'Brandenburg', 'Pomerania', 'Silesia', 'Bohemia',
  'Lombardy', 'Tuscany', 'Romagna', 'Naples', 'Sicily', 'Sardinia', 'Venice', 'Piedmont',
  'Norway', 'Sweden', 'Denmark', 'Finland', 'Gotland',
  'Poland', 'Lithuania', 'Livonia', 'Prussia', 'Masovia',
  'Hungary', 'Croatia', 'Serbia', 'Bosnia', 'Wallachia', 'Moldavia', 'Bulgaria', 'Thrace',
  'Attica', 'Thessaly', 'Macedonia', 'Epirus', 'Morea',
  'Ukraine', 'Ruthenia', 'Muscovy', 'Novgorod', 'Smolensk',
  'Transylvania', 'Moravia', 'Austria', 'Tyrol', 'Carinthia',
  'Corsica', 'Albania', 'Montenegro',
  'Helvetia', 'Alsace', 'Lorraine',
  'Crimea', 'Don', 'Volhynia', 'Courland',
];

export class ProvinceMap {
  private provinces: Province[] = [];
  private tileToProvince: Int16Array;

  constructor() {
    this.tileToProvince = new Int16Array(Config.MAP_WIDTH * Config.MAP_HEIGHT).fill(-1);
  }

  generateProvinces(tileMap: TileMap, count: number = 90): void {
    const W = Config.MAP_WIDTH;
    const H = Config.MAP_HEIGHT;

    // Collect land tiles
    const landTiles: { x: number; y: number }[] = [];
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (tileMap.getTerrainAt(x, y) !== TerrainType.WATER) {
          landTiles.push({ x, y });
        }
      }
    }

    if (landTiles.length === 0) return;

    // Place seed points spread across land
    const seeds: { x: number; y: number }[] = [];
    const step = Math.max(1, Math.floor(landTiles.length / count));
    // Shuffle land tiles deterministically
    const rng = mulberry32(42);
    for (let i = landTiles.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [landTiles[i], landTiles[j]] = [landTiles[j], landTiles[i]];
    }
    for (let i = 0; i < count && i * step < landTiles.length; i++) {
      seeds.push(landTiles[i * step]);
    }

    // Init provinces
    for (let i = 0; i < seeds.length; i++) {
      this.provinces.push({
        id: i,
        name: i < PROVINCE_NAMES.length ? PROVINCE_NAMES[i] : `Province ${i}`,
        tiles: new Set(),
        center: seeds[i],
      });
    }

    // Voronoi-ish assignment: assign each land tile to nearest seed
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (tileMap.getTerrainAt(x, y) === TerrainType.WATER) continue;
        let bestDist = Infinity;
        let bestId = 0;
        for (let i = 0; i < seeds.length; i++) {
          const dx = x - seeds[i].x;
          const dy = y - seeds[i].y;
          const d = dx * dx + dy * dy;
          if (d < bestDist) {
            bestDist = d;
            bestId = i;
          }
        }
        const idx = y * W + x;
        this.tileToProvince[idx] = bestId;
        this.provinces[bestId].tiles.add(idx);
      }
    }
  }

  getProvinceAt(x: number, y: number): Province | null {
    const idx = y * Config.MAP_WIDTH + x;
    const pId = this.tileToProvince[idx];
    if (pId < 0) return null;
    return this.provinces[pId];
  }

  getProvincesForCountry(countryId: number, tileMap: TileMap): Province[] {
    const result: Province[] = [];
    for (const prov of this.provinces) {
      let owned = 0;
      let total = 0;
      for (const tileIdx of prov.tiles) {
        total++;
        if (tileMap.owner[tileIdx] === countryId) owned++;
      }
      if (owned > total / 2) result.push(prov);
    }
    return result;
  }

  getAllProvinces(): Province[] {
    return this.provinces;
  }
}

function mulberry32(seed: number): () => number {
  let a = seed;
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
