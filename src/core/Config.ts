interface GameConfig {
  readonly TICK_MS: number;
  readonly TILE_SIZE: number;
  MAP_WIDTH: number;
  MAP_HEIGHT: number;
  readonly SPEED_OPTIONS: readonly number[];
}

export const Config: GameConfig = {
  TICK_MS: 200,
  TILE_SIZE: 4,
  MAP_WIDTH: 2160,
  MAP_HEIGHT: 1080,
  SPEED_OPTIONS: [0, 1, 2, 5],
};

export function setMapSize(width: number, height: number): void {
  Config.MAP_WIDTH = width;
  Config.MAP_HEIGHT = height;
}
