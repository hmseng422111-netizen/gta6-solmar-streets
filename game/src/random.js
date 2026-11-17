// A small seeded random number generator (mulberry32): the same seed gives the same city,
// the same traffic and the same screenshot scenes, which is what makes the staged shots
// repeatable. Extra helpers keep the call sites short.

export function createRandom(seed) {
  let a = seed | 0;
  function random() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  return {
    next: random,
    /** A number in [min, max). */
    range(min, max) {
      return min + random() * (max - min);
    },
    /** An integer in [min, max]. */
    int(min, max) {
      return min + Math.floor(random() * (max - min + 1));
    },
    /** One element of `items`, uniformly. */
    pick(items) {
      return items[Math.floor(random() * items.length)];
    },
    /** True with probability `p`. */
    chance(p) {
      return random() < p;
    },
  };
}
