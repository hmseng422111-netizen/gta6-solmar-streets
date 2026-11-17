// Every tuning number and colour for Solmar Streets in one place. The game paints a
// fixed 1280x720 logical view; the renderer scales it to the window, so no rule below
// depends on the screen size. The world itself is a 3600x2600 coastal city.

export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** The city: streets every 400 px, road width 90, beach along the south edge, marina east. */
export const WORLD = {
  width: 3600,
  height: 2600,
  roadGap: 400,
  roadWidth: 90,
  beachY: 2320,
  marinaX: 3240,
};

export const PLAYER = {
  radius: 13,
  walkSpeed: 230,
  runSpeed: 320,
  health: 100,
  punchRange: 34,
  punchDamage: 25,
  pistolDamage: 34,
  pistolAmmo: 12,
  pistolRange: 340,
};

export const CAR = {
  length: 64,
  width: 30,
  accel: 540,
  brake: 900,
  reverseAccel: 320,
  maxSpeed: 560,
  sportsMaxSpeed: 680,
  turnRate: 2.6,
  health: 100,
};

export const TRAFFIC_COUNT = 14;
export const PED_COUNT = 18;

/** Wanted stars 0..5: heat is continuous, stars are its floor; heat decays out of sight. */
export const WANTED = {
  maxStars: 5,
  decayPerSecond: 0.09,
  stealHeat: 1.2,
  killHeat: 2.0,
  shootHeat: 0.6,
  hitPedHeat: 0.8,
  bustSeconds: 1.2,
};

export const POLICE = {
  ramDamage: 9,
  punchDamage: 8,
  chaseSpeed: 600,
  spawnDistance: 700,
  despawnDistance: 1500,
};

export const PALETTE = {
  backdrop: '#0e1a24',
  sand: '#e8c98a',
  sea: '#2e8fa8',
  seaDeep: '#1f6f8b',
  grass: '#7fae5a',
  road: '#3a3f47',
  roadLine: '#e8d44d',
  sidewalk: '#9aa0a8',
  buildingA: '#c96f4a',
  buildingB: '#4a7fa5',
  buildingC: '#8a6fb0',
  buildingD: '#5a8a6a',
  roof: '#2e333b',
  player: '#ffd23f',
  playerDark: '#1c2733',
  traffic: '#d8dee6',
  police: '#2b6cb0',
  policeLight: '#ff3b30',
  ped: '#f2e6d8',
  hud: '#101820',
  hudText: '#f4f6f8',
  hudMuted: '#9fb2c1',
  cash: '#7ee787',
  wanted: '#ff5a4e',
  mission: '#ffd23f',
  minimapRoad: '#565d66',
  minimapBg: '#1c2833',
};

/** Sun-soaked city colours for buildings, cycled by block. */
export const BUILDING_COLORS = ['#c96f4a', '#4a7fa5', '#8a6fb0', '#5a8a6a', '#b08a4a', '#a54a6b'];

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the save (cash, missions done, best score) is kept between visits, this browser only. */
export const SAVE_KEY = 'solmar-streets.save.v1';

export const SAVE_DEFAULT = { cash: 250, missionsDone: 0, best: 0 };
