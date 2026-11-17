// Missions and the story: three jobs for Rio, then free-roam taxi fares for cash. A
// mission is a list of objectives; each one names a place, what to do there, and what it
// pays. The save (cash, missions done, best score) lives in localStorage; a fresh visit
// starts Rio with $250 and no jobs done.
//
// The story, all invented for this game: Rio, a driver-for-hire in Solmar, works for
// Marla Voss, who runs Club Neon Palms. Job one, The Pickup: fetch a package from the
// docks and bring it to the club. Job two, Hot Wheels: steal the Comet GT from the marina
// lot and lose the cops. Job three, The Big Score: crack the Casino Del Sol vault and get
// the cash to the safehouse.

import { LANDMARKS } from './city.js';
import { SAVE_DEFAULT, SAVE_KEY } from './config.js';

/** The three story jobs, in order. */
export const MISSIONS = [
  {
    id: 'pickup',
    title: 'Job 1: The Pickup',
    intro: 'Marla needs a package from the docks. Drive there, grab it, bring it to Club Neon Palms.',
    reward: 800,
    objectives: [
      { id: 'docks', text: 'Drive to the Solmar Docks', x: LANDMARKS.docks.x, y: LANDMARKS.docks.y, radius: 90 },
      { id: 'club', text: 'Deliver the package to Club Neon Palms', x: LANDMARKS.club.x, y: LANDMARKS.club.y, radius: 90 },
    ],
  },
  {
    id: 'hotwheels',
    title: 'Job 2: Hot Wheels',
    intro: 'A Comet GT is sitting in the marina lot. Take it — and lose the cops after.',
    reward: 1200,
    objectives: [
      { id: 'steal', text: 'Steal the Comet GT from the marina lot', x: LANDMARKS.marina.x, y: LANDMARKS.marina.y, radius: 110, needCar: 'sports' },
      { id: 'lose', text: 'Lose the cops: get your wanted level to zero', x: 0, y: 0, radius: 0, needQuiet: true },
    ],
  },
  {
    id: 'bigscore',
    title: 'Job 3: The Big Score',
    intro: 'Casino Del Sol keeps its cash in the vault. Crack it, grab the money, get home.',
    reward: 5000,
    objectives: [
      { id: 'casino', text: 'Reach Casino Del Sol', x: LANDMARKS.casino.x, y: LANDMARKS.casino.y, radius: 110 },
      { id: 'vault', text: 'Hold E at the vault door to crack it', x: LANDMARKS.casino.x, y: LANDMARKS.casino.y, radius: 110, holdSeconds: 3 },
      { id: 'home', text: 'Escape to the safehouse with the cash', x: LANDMARKS.safehouse.x, y: LANDMARKS.safehouse.y, radius: 90 },
    ],
  },
];

/** Start the next undone story job; null when all three are done. */
export function startNextMission(save) {
  const index = save.missionsDone;
  if (index >= MISSIONS.length) return null;
  const mission = MISSIONS[index];
  return { mission, objectiveIndex: 0, holdProgress: 0, done: false };
}

/** The objective the player is working on now, or null when the mission is done. */
export function currentObjective(active) {
  if (!active || active.done) return null;
  return active.mission.objectives[active.objectiveIndex] || null;
}

/** Move to the next objective; returns true when the mission is complete. */
export function advanceObjective(active) {
  active.objectiveIndex += 1;
  active.holdProgress = 0;
  if (active.objectiveIndex >= active.mission.objectives.length) {
    active.done = true;
    return true;
  }
  return false;
}

/** A taxi fare: a pedestrian to pick up, a place to take them, and the pay. */
export function createFare(random, city) {
  const spots = [
    { x: 1200, y: 1000, name: 'the club' },
    { x: 2000, y: 1200, name: 'downtown' },
    { x: 1200, y: 2000, name: 'the hospital' },
    { x: 3200, y: 620, name: 'the marina' },
    { x: 1800, y: 2400, name: 'the beach' },
  ];
  const dest = random.pick(spots);
  return { x: dest.x, y: dest.y, name: dest.name, pay: random.int(150, 400) };
}

/** Read the save from localStorage, or the default for a first visit. */
export function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return { ...SAVE_DEFAULT };
    const parsed = JSON.parse(raw);
    return {
      cash: typeof parsed.cash === 'number' ? parsed.cash : SAVE_DEFAULT.cash,
      missionsDone: typeof parsed.missionsDone === 'number' ? parsed.missionsDone : 0,
      best: typeof parsed.best === 'number' ? parsed.best : 0,
    };
  } catch {
    return { ...SAVE_DEFAULT };
  }
}

/** Write the save back to localStorage; storage may be off, and then it is skipped. */
export function storeSave(save) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  } catch {
    // Private windows and blocked storage: the save then lasts this visit only.
  }
}
