// Solmar Streets — shared configuration.
// One place for every number the game balances on, so tuning never means
// hunting through the simulation. All distances are in world pixels and all
// speeds in pixels per second.

export const VIEW_W = 1280;
export const VIEW_H = 720;

export const WORLD_W = 2560;
export const WORLD_H = 1920;

// Road grid: roads run every ROAD_STEP pixels, each ROAD_W wide, with the
// first road inset from the world edge by ROAD_OFFSET.
export const ROAD_STEP = 320;
export const ROAD_OFFSET = 160;
export const ROAD_W = 64;

// The beach and the sea occupy the eastern strip of the world.
export const BEACH_X = 2320;
export const SEA_X = 2440;

export const COLS = Math.floor((WORLD_W - ROAD_OFFSET) / ROAD_STEP);
export const ROWS = Math.floor((WORLD_H - ROAD_OFFSET) / ROAD_STEP);

export const PLAYER_WALK_SPEED = 190;
export const PLAYER_RUN_SPEED = 260;
export const PLAYER_RADIUS = 14;
export const PLAYER_MAX_HEALTH = 100;

export const CAR_LENGTH = 46;
export const CAR_WIDTH = 22;
export const CAR_TOP_SPEED = 430;
export const CAR_ACCEL = 320;
export const CAR_BRAKE = 520;
export const CAR_TURN = 2.6;
export const CAR_DRAG = 0.55;

export const TRAFFIC_COUNT = 14;
export const TRAFFIC_SPEED = 150;
export const PED_COUNT = 26;
export const PED_SPEED = 55;

export const POLICE_TOP_SPEED = 470;
export const POLICE_SPAWN_INTERVAL = 2.5;
export const WANTED_MAX = 5;
export const WANTED_DECAY_SECONDS = 10;
export const ARREST_SECONDS = 2.5;

export const BULLET_SPEED = 720;
export const BULLET_RANGE = 520;
export const BULLET_DAMAGE = 34;
export const PUNCH_RANGE = 34;
export const PUNCH_DAMAGE = 20;

export const START_CASH = 250;
export const TAXI_FARE_MIN = 150;
export const TAXI_FARE_MAX = 400;

export const SAVE_KEY = 'solmar-streets-save-v1';

// Story missions, in order. Each mission is a list of stages; a stage is
// either "go to this landmark" or "do this action at this landmark".
export const MISSIONS = [
  {
    id: 'm1',
    name: 'First Run',
    pay: 800,
    brief: 'Pick up the package at the Solmar Docks, then deliver it to Club Neon Palms.',
    stages: [
      { kind: 'goto', landmark: 'docks', label: 'Pick up the package at the Solmar Docks' },
      { kind: 'goto', landmark: 'club', label: 'Deliver the package to Club Neon Palms' },
    ],
  },
  {
    id: 'm2',
    name: 'The Comet GT',
    pay: 1200,
    brief: 'Steal the Comet GT from the Casino Del Sol car park and lose the police.',
    stages: [
      { kind: 'steal', landmark: 'casino', label: 'Steal the Comet GT at Casino Del Sol' },
      { kind: 'escape', label: 'Lose the police — stay out of sight until your wanted level clears' },
    ],
  },
  {
    id: 'm3',
    name: 'The Vault',
    pay: 5000,
    brief: 'Crack the Casino Del Sol vault, then get back to the safehouse alive.',
    stages: [
      { kind: 'crack', landmark: 'casino', label: 'Crack the vault at Casino Del Sol (hold still for 5 seconds)' },
      { kind: 'goto', landmark: 'safehouse', label: 'Escape back to the safehouse' },
    ],
  },
];

export const LANDMARK_NAMES = {
  club: 'Club Neon Palms',
  casino: 'Casino Del Sol',
  docks: 'Solmar Docks',
  safehouse: 'Safehouse',
};

export const CAR_COLORS = [
  '#c0392b', '#2980b9', '#27ae60', '#f39c12', '#8e44ad',
  '#16a085', '#d35400', '#7f8c8d', '#e8e8e8', '#2c3e50',
];
export const TAXI_COLOR = '#f7dc00';
export const POLICE_COLOR = '#1b2a4a';
export const COMET_COLOR = '#ff2e88';

export const BUILDING_COLORS = [
  '#b8a88f', '#a89a86', '#c2b49a', '#9fb3c8', '#c8a2a2',
  '#a8c8a2', '#d8c49a', '#b0a8c8',
];
