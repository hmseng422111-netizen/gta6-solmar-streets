// The city of Solmar: a road grid, the buildings that fill its blocks, the beach along
// the south edge, the marina in the east, and the landmarks the missions use. Everything is
// derived from the seed, so the same seed always builds the same city.
//
// Roads run every WORLD.roadGap pixels, centred on multiples of the gap; a point is on a
// road when it is within half a road width of a road centre line. Buildings sit inside the
// blocks between roads, inset from the road edge. The collision test only looks at the
// buildings of the block a point is in, so it stays cheap whatever the city holds.

import { BUILDING_COLORS, WORLD } from './config.js';

/** Landmark names, all invented for this game. Each point sits on a road, at the street
 * entrance of the place it names, so a car can reach it. */
export const LANDMARKS = {
  safehouse: { name: 'Rio\u2019s Safehouse', x: 400, y: 620 },
  docks: { name: 'Solmar Docks', x: 3200, y: 2400 },
  club: { name: 'Club Neon Palms', x: 1200, y: 1000 },
  marina: { name: 'Marina Lot', x: 3200, y: 620 },
  casino: { name: 'Casino Del Sol', x: 2000, y: 1400 },
  hospital: { name: 'Solmar General', x: 1200, y: 2000 },
  beach: { name: 'Palmera Beach', x: 1800, y: 2480 },
};

const HALF_ROAD = WORLD.roadWidth / 2;

/** True when the point is on a road (within half a road width of a road centre line). */
export function onRoad(x, y) {
  const rx = ((x % WORLD.roadGap) + WORLD.roadGap) % WORLD.roadGap;
  const ry = ((y % WORLD.roadGap) + WORLD.roadGap) % WORLD.roadGap;
  const nearVertical = Math.min(rx, WORLD.roadGap - rx) <= HALF_ROAD;
  const nearHorizontal = Math.min(ry, WORLD.roadGap - ry) <= HALF_ROAD;
  return nearVertical || nearHorizontal;
}

/** The nearest point on a road centre line, for snapping spawns onto the street. */
export function snapToRoad(x, y) {
  const gx = Math.round(x / WORLD.roadGap) * WORLD.roadGap;
  const gy = Math.round(y / WORLD.roadGap) * WORLD.roadGap;
  const dx = Math.abs(x - gx);
  const dy = Math.abs(y - gy);
  return dx < dy ? { x: gx, y } : { x, y: gy };
}

/** True when the point is inside any building (buildings are axis-aligned boxes). */
export function insideBuilding(city, x, y) {
  const list = city.byBlock.get(blockKey(x, y));
  if (!list) return false;
  for (let i = 0; i < list.length; i += 1) {
    const b = list[i];
    if (x > b.x && x < b.x + b.w && y > b.y && y < b.y + b.h) return true;
  }
  return false;
}

/** Push a circle out of any building it overlaps; returns true when it moved. */
export function resolveBuildingCollision(city, body) {
  const list = city.byBlock.get(blockKey(body.x, body.y));
  if (!list) return false;
  let moved = false;
  for (let i = 0; i < list.length; i += 1) {
    const b = list[i];
    const nearestX = Math.max(b.x, Math.min(body.x, b.x + b.w));
    const nearestY = Math.max(b.y, Math.min(body.y, b.y + b.h));
    const dx = body.x - nearestX;
    const dy = body.y - nearestY;
    const distSq = dx * dx + dy * dy;
    const r = body.radius || 14;
    if (distSq >= r * r) continue;
    moved = true;
    if (distSq === 0) {
      body.y = b.y - r;
      continue;
    }
    const dist = Math.sqrt(distSq);
    body.x = nearestX + (dx / dist) * r;
    body.y = nearestY + (dy / dist) * r;
  }
  return moved;
}

function blockKey(x, y) {
  return `${Math.floor(x / WORLD.roadGap)}:${Math.floor(y / WORLD.roadGap)}`;
}

/** Build the city: roads, buildings, parks, the beach, the marina and the landmarks. */
export function createCity(random) {
  const buildings = [];
  const byBlock = new Map();
  const parks = [];
  const gap = WORLD.roadGap;
  const inset = HALF_ROAD + 26;

  for (let bx = 0; bx < WORLD.width / gap; bx += 1) {
    for (let by = 0; by < WORLD.height / gap; by += 1) {
      const x0 = bx * gap + inset;
      const y0 = by * gap + inset;
      const w = gap - inset * 2;
      const h = gap - inset * 2;
      // The beach strip and the marina hold no buildings.
      if (y0 > WORLD.beachY - 60 || x0 > WORLD.marinaX - 60) continue;
      // One block in five is a park instead of buildings.
      if (random.chance(0.2)) {
        parks.push({ x: x0, y: y0, w, h, trees: random.int(3, 6) });
        continue;
      }
      const count = random.chance(0.5) ? 2 : 1;
      for (let i = 0; i < count; i += 1) {
        const bw = count === 1 ? w : w / 2 - 14;
        const bh = count === 1 ? h : h / 2 - 14;
        const bx0 = x0 + (count === 1 ? 0 : (i % 2) * (w / 2 + 14));
        const by0 = y0 + (count === 1 ? 0 : Math.floor(i / 2) * (h / 2 + 14));
        const building = {
          x: bx0,
          y: by0,
          w: bw,
          h: bh,
          color: random.pick(BUILDING_COLORS),
          tall: random.chance(0.3),
        };
        buildings.push(building);
        const key = `${bx}:${by}`;
        if (!byBlock.has(key)) byBlock.set(key, []);
        byBlock.get(key).push(building);
      }
    }
  }

  // The casino and the club are tall landmarks, placed on their blocks.
  const casino = { x: 2140, y: 1340, w: 170, h: 150, color: '#d8a93b', tall: true, name: 'Casino Del Sol' };
  const club = { x: 1340, y: 940, w: 150, h: 130, color: '#c94a8a', tall: true, name: 'Club Neon Palms' };
  for (const landmark of [casino, club]) {
    buildings.push(landmark);
    const key = blockKey(landmark.x + 10, landmark.y + 10);
    if (!byBlock.has(key)) byBlock.set(key, []);
    byBlock.get(key).push(landmark);
  }

  return { buildings, byBlock, parks, landmarks: LANDMARKS };
}

/** A random point on a road, for spawning traffic and pedestrians. */
export function randomRoadPoint(random) {
  const vertical = random.chance(0.5);
  if (vertical) {
    const gx = random.int(1, Math.floor(WORLD.width / WORLD.roadGap) - 1) * WORLD.roadGap;
    return { x: gx, y: random.range(100, WORLD.height - 100), axis: 'v' };
  }
  const gy = random.int(1, Math.floor(WORLD.height / WORLD.roadGap) - 1) * WORLD.roadGap;
  return { x: random.range(100, WORLD.width - 100), y: gy, axis: 'h' };
}

/** A random sidewalk point beside a road, for pedestrians. */
export function randomSidewalkPoint(random) {
  const p = randomRoadPoint(random);
  const off = HALF_ROAD + 16;
  if (p.axis === 'v') return { x: p.x + (random.chance(0.5) ? off : -off), y: p.y };
  return { x: p.x, y: p.y + (random.chance(0.5) ? off : -off) };
}
