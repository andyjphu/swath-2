export enum TerrainType {
  WATER = 0,
  PLAINS = 1,
  FOREST = 2,
  HILLS = 3,
  MOUNTAINS = 4,
  FARMLAND = 5,
  URBAN = 6,
}

export interface TerrainConfig {
  color: string;
  moveCost: number;
  fertility: number;
  passable: boolean;
}

export const TerrainConfigs: Record<TerrainType, TerrainConfig> = {
  [TerrainType.WATER]: { color: '#2d5a8e', moveCost: 999, fertility: 0, passable: false },
  [TerrainType.PLAINS]: { color: '#7cad3e', moveCost: 1, fertility: 1.0, passable: true },
  [TerrainType.FOREST]: { color: '#3d7a2a', moveCost: 2, fertility: 0.4, passable: true },
  [TerrainType.HILLS]: { color: '#a89060', moveCost: 3, fertility: 0.3, passable: true },
  [TerrainType.MOUNTAINS]: { color: '#8a8a8a', moveCost: 999, fertility: 0, passable: false },
  [TerrainType.FARMLAND]: { color: '#d4b830', moveCost: 1, fertility: 2.0, passable: true },
  [TerrainType.URBAN]: { color: '#b0b0b0', moveCost: 1, fertility: 0, passable: true },
};
