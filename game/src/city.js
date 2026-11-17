// The city of Solmar: roads, blocks, buildings and landmarks.
// The layout is a grid of roads with buildings filling the blocks between
// them, a beach and sea along the eastern edge, and four landmarks placed
// on fixed blocks so missions always know where to send the player.

import {
  WORLD_W, WORLD_H, ROAD_STEP, ROAD_OFFSET, ROAD_W,
  BEACH_X, SEA_X, BUILDING_COLORS,
} from './config.js';

// Landmark blocks are fixed by grid position so the map reads the same
// every seed; their exact doorstep varies a little with the seed.
const LANDMARK_BLOCKS = {
  club: { col: 1, row: 1 },
  casino: { col: 5, row: 2 },
  docks: { col: 6, row: 4 },
  safehouse: { col: 1, row: 4 },
};

export function roadCenterX(col) {
  return ROAD_OFFSET + col * ROAD_STEP;
}

export function roadCenterY(row) {
  return ROAD_OFFSET + row * ROAD_STEP;
}

export function isOnRoad(x, y) {
  const half = ROAD_W / 2 + 6;
  for (let c = 0; c <= 7; c += 1) {
    if (Math.abs(x - roadCenterX(c)) < half) return true;
  }
  for (let r = 0; r <= 5; r += 1) {
    if (Math.abs(y - roadCenterY(r)) < half) return true;
  }
  return false;
}

// Snap a point to the centre of the nearest road.
export function nearestRoadPoint(x, y) {
  let bestX = roadCenterX(0);
  let bestD = Infinity;
  for (let c = 0; c <= 7; c += 1) {
    const d = Math.abs(x - roadCenterX(c));
    if (d < bestD) { bestD = d; bestX = roadCenterX(c); }
  }
  let bestY = roadCenterY(0);
  bestD = Infinity;
  for (let r = 0; r <= 5; r += 1) {
    const d = Math.abs(y - roadCenterY(r));
    if (d < bestD) { bestD = d; bestY = roadCenterY(r); }
  }
  // Keep the axis the point was already closest to.
  if (Math.abs(x - bestX) < Math.abs(y - bestY)) return { x: bestX, y };
  return { x, y: bestY };
}

export function generateCity(rng) {
  const buildings = [];
  const landmarks = {};
  const parkingSpots = [];

  const cols = 7;
  const rows = 5;
  for (let col = 0; col < cols; col += 1) {
    for (let row = 0; row < rows; row += 1) {
      const x0 = roadCenterX(col) + ROAD_W / 2 + 14;
      const y0 = roadCenterY(row) + ROAD_W / 2 + 14;
      const x1 = roadCenterX(col + 1) - ROAD_W / 2 - 14;
      const y1 = roadCenterY(row + 1) - ROAD_W / 2 - 14;
      if (x1 <= x0 || y1 <= y0) continue;
      if (x0 > BEACH_X) continue;

      const landmarkKey = Object.keys(LANDMARK_BLOCKS).find(
        (key) => LANDMARK_BLOCKS[key].col === col && LANDMARK_BLOCKS[key].row === row,
      );
      // The docks are placed on the beach after the loop, not in a block.
      if (landmarkKey === 'docks') continue;
      if (landmarkKey) {
        const w = Math.min(150, x1 - x0);
        const h = Math.min(110, y1 - y0);
        const bx = x0 + (x1 - x0 - w) / 2;
        const by = y0 + (y1 - y0 - h) / 2;
        landmarks[landmarkKey] = {
          x: bx + w / 2,
          y: by + h / 2,
          w,
          h,
          doorX: bx + w / 2,
          doorY: by + h + 16,
        };
        buildings.push({
          x: bx, y: by, w, h,
          color: landmarkKey === 'casino' ? '#d4af37' : landmarkKey === 'club' ? '#ff4fd8' : '#8f7a5a',
          landmark: landmarkKey, height: 3,
        });
        continue;
      }

      // Ordinary blocks get one to three buildings.
      const count = rng.int(1, 3);
      for (let i = 0; i < count; i += 1) {
        const w = rng.range(70, Math.min(150, (x1 - x0) / count));
        const h = rng.range(60, Math.min(120, y1 - y0));
        const bx = rng.range(x0, Math.max(x0, x1 - w));
        const by = rng.range(y0, Math.max(y0, y1 - h));
        buildings.push({
          x: bx, y: by, w, h,
          color: rng.pick(BUILDING_COLORS),
          landmark: null, height: rng.int(1, 4),
        });
      }

      // A parking spot or two along the block's road edge, just inside the
      // road so a car can pull out without hitting a building.
      if (rng.chance(0.7)) {
        parkingSpots.push({
          x: roadCenterX(col) + ROAD_W / 2 - 12,
          y: roadCenterY(row) + rng.range(40, 200),
          angle: Math.PI / 2,
        });
      }
    }
  }

  // The docks sit on the beach itself, east of the last road.
  landmarks.docks = {
    x: BEACH_X + 60, y: roadCenterY(4), w: 130, h: 90,
    doorX: BEACH_X + 30, doorY: roadCenterY(4),
  };
  buildings.push({
    x: BEACH_X + 10, y: roadCenterY(4) - 45, w: 120, h: 90,
    color: '#7a6a55', landmark: 'docks', height: 1,
  });

  return { buildings, landmarks, parkingSpots, cols, rows };
}

// Push a circle out of every building it overlaps. Returns true when a
// collision happened. Buildings are solid; roads, beach and sea are open.
export function collideBuildings(city, x, y, radius) {
  let hit = false;
  for (const b of city.buildings) {
    const cx = Math.max(b.x, Math.min(x, b.x + b.w));
    const cy = Math.max(b.y, Math.min(y, b.y + b.h));
    const dx = x - cx;
    const dy = y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 < radius * radius) {
      hit = true;
      const d = Math.sqrt(d2) || 0.001;
      const push = radius - d;
      x += (dx / d) * push;
      y += (dy / d) * push;
    }
  }
  return { x, y, hit };
}

export function clampToWorld(x, y, margin = 20) {
  return {
    x: Math.max(margin, Math.min(WORLD_W - margin, x)),
    y: Math.max(margin, Math.min(WORLD_H - margin, y)),
  };
}

export function pointInRect(x, y, rect) {
  return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
}
