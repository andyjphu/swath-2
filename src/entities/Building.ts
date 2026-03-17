export enum BuildingType {
  CASTLE = 1,
  MARKET = 2,
  FARM = 3,
  WORKSHOP = 4,
  WALLS = 5,
  PORT = 6,
}

export interface BuildingConfig {
  name: string;
  cost: { gold: number; wood?: number; iron?: number };
  effects: string;
  prerequisite?: string;
}

export const BuildingConfigs: Record<BuildingType, BuildingConfig> = {
  [BuildingType.CASTLE]: {
    name: 'Castle',
    cost: { gold: 100, wood: 20 },
    effects: 'Defense +5 (radius 3), troop recruitment +2/tick',
  },
  [BuildingType.MARKET]: {
    name: 'Market',
    cost: { gold: 60 },
    effects: 'Gold +3/tick',
  },
  [BuildingType.FARM]: {
    name: 'Farm',
    cost: { gold: 30, wood: 10 },
    effects: 'Food +2/tick, converts nearby plains to farmland',
  },
  [BuildingType.WORKSHOP]: {
    name: 'Workshop',
    cost: { gold: 50 },
    effects: 'Production +1 (type depends on nearby terrain)',
  },
  [BuildingType.WALLS]: {
    name: 'Walls',
    cost: { gold: 80, iron: 30 },
    effects: 'Defense +3 on city border tiles',
  },
  [BuildingType.PORT]: {
    name: 'Port',
    cost: { gold: 100, wood: 20 },
    effects: 'Enables coastal trade, trade income +2/tick',
  },
};

export interface Building {
  type: BuildingType;
  cityId: number;
  tileIndex: number;
}
