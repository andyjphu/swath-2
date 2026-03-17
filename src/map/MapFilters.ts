import { TileMap } from './TileMap';
import { TerrainType } from './Terrain';

/**
 * Smooth coastlines: fill water speckles on land, remove land speckles in water.
 * Uses a 5x5 neighborhood majority vote. Configurable passes.
 */
export function smoothCoastlines(tileMap: TileMap, passes: number = 1): void {
  const W = tileMap.width, H = tileMap.height;
  for (let pass = 0; pass < passes; pass++) {
    const snapshot = new Uint8Array(tileMap.terrain);
    for (let y = 2; y < H - 2; y++) {
      for (let x = 2; x < W - 2; x++) {
        const idx = y * W + x;
        let landCount = 0;
        for (let dy = -2; dy <= 2; dy++) {
          for (let dx = -2; dx <= 2; dx++) {
            if (snapshot[(y + dy) * W + (x + dx)] !== TerrainType.WATER) landCount++;
          }
        }
        if (snapshot[idx] === TerrainType.WATER && landCount >= 18) {
          tileMap.terrain[idx] = TerrainType.PLAINS;
        }
        if (snapshot[idx] !== TerrainType.WATER && landCount <= 7) {
          tileMap.terrain[idx] = TerrainType.WATER;
        }
      }
    }
  }
}

/**
 * Remove small islands below a tile count threshold using flood fill.
 */
export function removeSmallIslands(tileMap: TileMap, minSize: number = 50): void {
  const W = tileMap.width, H = tileMap.height;
  const visited = new Uint8Array(W * H);

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = y * W + x;
      if (visited[idx] || tileMap.terrain[idx] === TerrainType.WATER) continue;

      const island: number[] = [];
      const stack = [idx];
      visited[idx] = 1;

      while (stack.length > 0) {
        const cur = stack.pop()!;
        island.push(cur);
        const cx = cur % W;
        const cy = Math.floor(cur / W);

        for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
          const ni = ny * W + nx;
          if (visited[ni] || tileMap.terrain[ni] === TerrainType.WATER) continue;
          visited[ni] = 1;
          stack.push(ni);
        }
      }

      if (island.length < minSize) {
        for (const ti of island) {
          tileMap.terrain[ti] = TerrainType.WATER;
        }
      }
    }
  }
}

/**
 * Fill small inland water bodies (lakes) below a tile count threshold.
 */
export function fillSmallLakes(tileMap: TileMap, minSize: number = 100): void {
  const W = tileMap.width, H = tileMap.height;
  const visited = new Uint8Array(W * H);

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = y * W + x;
      if (visited[idx] || tileMap.terrain[idx] !== TerrainType.WATER) continue;

      const lake: number[] = [];
      const stack = [idx];
      visited[idx] = 1;
      let touchesEdge = false;

      while (stack.length > 0) {
        const cur = stack.pop()!;
        lake.push(cur);
        const cx = cur % W;
        const cy = Math.floor(cur / W);

        if (cx === 0 || cx === W - 1 || cy === 0 || cy === H - 1) touchesEdge = true;

        for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
          const ni = ny * W + nx;
          if (visited[ni] || tileMap.terrain[ni] !== TerrainType.WATER) continue;
          visited[ni] = 1;
          stack.push(ni);
        }
      }

      if (!touchesEdge && lake.length < minSize) {
        for (const ti of lake) {
          tileMap.terrain[ti] = TerrainType.PLAINS;
        }
      }
    }
  }
}

/**
 * Blur/smooth terrain types using majority vote in a radius.
 * Water tiles are excluded (not changed, not counted).
 */
export function blurTerrain(tileMap: TileMap, radius: number = 2): void {
  const W = tileMap.width, H = tileMap.height;
  const snapshot = new Uint8Array(tileMap.terrain);

  for (let y = radius; y < H - radius; y++) {
    for (let x = radius; x < W - radius; x++) {
      const idx = y * W + x;
      if (snapshot[idx] === TerrainType.WATER) continue;

      const counts = new Uint16Array(7);
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const t = snapshot[(y + dy) * W + (x + dx)];
          if (t !== TerrainType.WATER) counts[t]++;
        }
      }

      let bestType = snapshot[idx] as TerrainType;
      let bestCount = 0;
      for (let t = 1; t < counts.length; t++) {
        if (counts[t] > bestCount) {
          bestCount = counts[t];
          bestType = t as TerrainType;
        }
      }
      tileMap.terrain[idx] = bestType;
    }
  }
}

/**
 * Erode thin peninsulas: land tiles surrounded by mostly water become water.
 */
export function erodePeninsulas(tileMap: TileMap, mode: 'manhattan' | 'diagonal' = 'manhattan', passes: number = 1): void {
  const W = tileMap.width, H = tileMap.height;
  const DIRS_4: [number, number][] = [[0, -1], [0, 1], [-1, 0], [1, 0]];
  const DIRS_8: [number, number][] = [[0, -1], [0, 1], [-1, 0], [1, 0], [-1, -1], [-1, 1], [1, -1], [1, 1]];

  const dirs = mode === 'manhattan' ? DIRS_4 : DIRS_8;
  const threshold = mode === 'manhattan' ? 3 : 5;

  for (let pass = 0; pass < passes; pass++) {
    const snapshot = new Uint8Array(tileMap.terrain);
    for (let y = 1; y < H - 1; y++) {
      for (let x = 1; x < W - 1; x++) {
        const idx = y * W + x;
        if (snapshot[idx] === TerrainType.WATER) continue;

        let waterCount = 0;
        for (const [dx, dy] of dirs) {
          if (snapshot[(y + dy) * W + (x + dx)] === TerrainType.WATER) waterCount++;
        }

        if (waterCount >= threshold) {
          tileMap.terrain[idx] = TerrainType.WATER;
        }
      }
    }
  }
}

/**
 * Fill inland water: water tiles surrounded by mostly land become plains.
 * Inverse of erodePeninsulas.
 */
export function fillInlandWater(tileMap: TileMap, mode: 'manhattan' | 'diagonal' = 'diagonal', passes: number = 1): void {
  const W = tileMap.width, H = tileMap.height;
  const DIRS_4: [number, number][] = [[0, -1], [0, 1], [-1, 0], [1, 0]];
  const DIRS_8: [number, number][] = [[0, -1], [0, 1], [-1, 0], [1, 0], [-1, -1], [-1, 1], [1, -1], [1, 1]];

  const dirs = mode === 'manhattan' ? DIRS_4 : DIRS_8;
  const threshold = mode === 'manhattan' ? 3 : 5;

  for (let pass = 0; pass < passes; pass++) {
    const snapshot = new Uint8Array(tileMap.terrain);
    for (let y = 1; y < H - 1; y++) {
      for (let x = 1; x < W - 1; x++) {
        const idx = y * W + x;
        if (snapshot[idx] !== TerrainType.WATER) continue;

        let landCount = 0;
        for (const [dx, dy] of dirs) {
          if (snapshot[(y + dy) * W + (x + dx)] !== TerrainType.WATER) landCount++;
        }

        if (landCount >= threshold) {
          tileMap.terrain[idx] = TerrainType.PLAINS;
        }
      }
    }
  }
}
