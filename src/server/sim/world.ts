import { Rng } from '../../shared/rng';
import { Simplex } from '../../shared/noise';
import { Biome, isWater } from '../../shared/types';

/** Map side in tiles. Old worlds were 192; new ones are 272 (about twice the area). */
export const OLD_SIZE = 192;
export const NEW_SIZE = 272;
export let W = OLD_SIZE;
export let H = OLD_SIZE;
/** Set before generating, loading or touching a world: the Earth and Mars share these. */
export function setWorldSize(w: number, h = w) {
  W = w;
  H = h;
}

/** The world grows by whole maps when a ship reaches the edge: at most two more maps in every direction (5 x 5).
 *  The first map is (0, 0); the grid is the box around every open map, in maps. */
export interface Grid { gx0: number; gy0: number; cols: number; rows: number; open: string[] }
export const GRID_REACH = 2;
export const mapKey = (gx: number, gy: number) => `${gx},${gy}`;

/** Static terrain plus the living resources on each tile. */
export interface Terrain {
  w: number;
  h: number;
  height: Float32Array; // 0..1, sea level = SEA
  temp: Float32Array; // 0 (frozen) .. 1 (hot)
  moist: Float32Array; // 0..1
  biome: Uint8Array;
  river: Uint8Array; // 0 none, else flow strength 1..255
  // renewable resources (current, capacity)
  plants: Float32Array;
  plantsCap: Float32Array;
  game: Float32Array;
  gameCap: Float32Array;
  fish: Float32Array; // capacity-based: fish near coast/river
  flint: Uint8Array; // 1 if flint/good stone nearby
  clay: Uint8Array;
  grain: Uint8Array; // wild grains grow here (for agriculture)
  wildHerd: Uint8Array; // wild goats/sheep/aurochs: domestication possible
  explored: Uint8Array; // 1 if any human has seen it
  /** 1 on the tiles of maps not opened yet (deep sea nobody can sail into) */
  closed?: Uint8Array;
}

const FIELDS = ['height', 'temp', 'moist', 'biome', 'river', 'plants', 'plantsCap', 'game', 'gameCap', 'fish', 'flint', 'clay', 'grain', 'wildHerd', 'explored', 'closed'] as const;

function emptyTerrain(w: number, h: number): Terrain {
  const n = w * h;
  const t: Terrain = {
    w, h, height: new Float32Array(n).fill(-1), temp: new Float32Array(n), moist: new Float32Array(n), biome: new Uint8Array(n).fill(Biome.DeepWater),
    river: new Uint8Array(n), plants: new Float32Array(n), plantsCap: new Float32Array(n), game: new Float32Array(n), gameCap: new Float32Array(n),
    fish: new Float32Array(n), flint: new Uint8Array(n), clay: new Uint8Array(n), grain: new Uint8Array(n), wildHerd: new Uint8Array(n),
    explored: new Uint8Array(n), closed: new Uint8Array(n).fill(1),
  };
  return t;
}

/** copy all of `src` into `dst` with its top left corner at (ox, oy) */
function blit(src: Terrain, dst: Terrain, ox: number, oy: number) {
  for (const f of FIELDS) {
    const a = src[f] as Float32Array | Uint8Array | undefined, b = dst[f] as Float32Array | Uint8Array;
    for (let y = 0; y < src.h; y++) {
      if (a) b.set(a.subarray(y * src.w, (y + 1) * src.w), (y + oy) * dst.w + ox);
      else b.fill(0, (y + oy) * dst.w + ox, (y + oy) * dst.w + ox + src.w);
    }
  }
}

/** one map of the grid, made on its own (S x S) */
function makeMap(seed: number, S: number, gx: number, gy: number): Terrain {
  setWorldSize(S);
  return generateTerrain(seed, gx, gy);
}

/** the whole world: every open map in its place, the rest closed sea */
export function buildTerrain(seed: number, S: number, g: Grid): Terrain {
  const t = emptyTerrain(g.cols * S, g.rows * S);
  for (const key of g.open) {
    const [gx, gy] = key.split(',').map(Number);
    blit(makeMap(seed, S, gx, gy), t, (gx - g.gx0) * S, (gy - g.gy0) * S);
  }
  setWorldSize(t.w, t.h);
  return t;
}

/** the world with one more map: the old tiles keep what grew and was seen on them; returns the shift of the old tiles */
export function growTerrain(old: Terrain, seed: number, S: number, g: Grid, gx: number, gy: number): { t: Terrain; grid: Grid; dx: number; dy: number } {
  const gx0 = Math.min(g.gx0, gx), gy0 = Math.min(g.gy0, gy);
  const cols = Math.max(g.gx0 + g.cols, gx + 1) - gx0, rows = Math.max(g.gy0 + g.rows, gy + 1) - gy0;
  const grid: Grid = { gx0, gy0, cols, rows, open: [...g.open, mapKey(gx, gy)] };
  const t = emptyTerrain(cols * S, rows * S);
  const dx = (g.gx0 - gx0) * S, dy = (g.gy0 - gy0) * S;
  blit(old, t, dx, dy);
  blit(makeMap(seed, S, gx, gy), t, (gx - gx0) * S, (gy - gy0) * S);
  setWorldSize(t.w, t.h);
  return { t, grid, dx, dy };
}

export const SEA = 0.0;

export function idx(x: number, y: number): number {
  return y * W + x;
}

export function inBounds(x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < W && y < H;
}

/** one map: the first one is (0, 0); the others go on with the same noise, so the coasts meet at the seams */
export function generateTerrain(seed: number, gx = 0, gy = 0): Terrain {
  const rng0 = new Rng(seed);
  const elev = new Simplex(rng0);
  const wet = new Simplex(rng0);
  const warp = new Simplex(rng0);
  // the first map goes on with the same numbers as always; every other map has its own
  const rng = gx || gy ? new Rng((seed ^ Math.imul(gx + 101, 0x9e3779b1) ^ Math.imul(gy + 307, 0x85ebca6b)) >>> 0) : rng0;
  const ox = gx * W, oy = gy * H;
  const n = W * H;
  // keep hills, rivers and coasts the same size in tiles on a bigger map
  const k = W / OLD_SIZE, kk = k * k;
  const t: Terrain = {
    w: W, h: H,
    height: new Float32Array(n),
    temp: new Float32Array(n),
    moist: new Float32Array(n),
    biome: new Uint8Array(n),
    river: new Uint8Array(n),
    plants: new Float32Array(n),
    plantsCap: new Float32Array(n),
    game: new Float32Array(n),
    gameCap: new Float32Array(n),
    fish: new Float32Array(n),
    flint: new Uint8Array(n),
    clay: new Uint8Array(n),
    grain: new Uint8Array(n),
    wildHerd: new Uint8Array(n),
    explored: new Uint8Array(n),
  };

  // Height: fbm + domain warp, shaped into one big continent with a few islands.
  const ridgeX = rng.range(0.3, 0.7);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const nx = x / W + gx, ny = y / H + gy;
      const wx = nx + 0.12 * warp.fbm(nx * 3 * k, ny * 3 * k, 3);
      const wy = ny + 0.12 * warp.fbm(nx * 3 * k + 7.3, ny * 3 * k + 2.1, 3);
      let e = elev.fbm(wx * 3.2 * k, wy * 3.2 * k, 6, 2.0, 0.5);
      // continent mask: distance from centre with an elliptic falloff
      const dx = (nx - gx - 0.5) / 0.48, dy = (ny - gy - 0.5) / 0.46;
      const d = Math.sqrt(dx * dx + dy * dy);
      e = e * 0.85 + 0.42 - Math.pow(d, 2.2) * 0.75;
      // a mountain spine
      const spine = Math.exp(-Math.pow((wx - gx - ridgeX - 0.15 * Math.sin(wy * 6 * k)) / (0.06 / k), 2)) * 0.28 * (1 - d * 0.7);
      e += Math.max(0, spine) * (0.6 + 0.4 * elev.noise(wx * 9 * k, wy * 9 * k));
      t.height[idx(x, y)] = e;
    }
  }
  // normalise land to 0..1 and sea to negative
  let maxH = 0, minH = 0;
  for (let i = 0; i < n; i++) { maxH = Math.max(maxH, t.height[i]); minH = Math.min(minH, t.height[i]); }
  for (let i = 0; i < n; i++) {
    const h = t.height[i];
    t.height[i] = h > 0 ? h / maxH : -h / minH;
  }

  // Temperature: north is cold, south is warm, mountains are cold.
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = idx(x, y);
      // 0 = north; the maps to the north are colder, those to the south hotter, more gently than within the first
      const L = y / H + gy;
      const lat = L < 0 ? L * 0.35 : L > 1 ? 1 + (L - 1) * 0.35 : L;
      const h = Math.max(0, t.height[i]);
      t.temp[i] = Math.min(1, Math.max(0, 0.15 + lat * 0.75 - h * 0.55 + 0.08 * wet.noise((x + ox) / 30, (y + oy) / 30)));
      t.moist[i] = Math.min(1, Math.max(0, 0.55 + 0.45 * wet.fbm((x + ox) / 55 + 11, (y + oy) / 55 + 3, 4)));
    }
  }

  // Rivers: start at wet highlands, run downhill to the sea.
  const sources: number[] = [];
  for (let a = 0; a < 4000 * kk && sources.length < Math.round(34 * kk); a++) {
    const x = rng.int(4, W - 5), y = rng.int(4, H - 5);
    const i = idx(x, y);
    if (t.height[i] > 0.45 && t.moist[i] > 0.45 && !sources.some((s) => Math.abs((s % W) - x) + Math.abs(Math.floor(s / W) - y) < 14)) sources.push(i);
  }
  for (const s of sources) {
    let x = s % W, y = Math.floor(s / W);
    let flow = 1;
    const visited = new Set<number>();
    for (let step = 0; step < 400 * k; step++) {
      const i = idx(x, y);
      if (t.height[i] <= SEA) break;
      visited.add(i);
      t.river[i] = Math.min(255, t.river[i] + flow);
      flow = Math.min(255, flow + 2);
      let best = -1, bestH = t.height[i];
      for (const [ddx, ddy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + ddx, ny = y + ddy;
        if (!inBounds(nx, ny)) continue;
        const j = idx(nx, ny);
        if (visited.has(j)) continue;
        const hh = t.height[j] + rng.next() * 0.004;
        if (hh < bestH) { bestH = hh; best = j; }
      }
      if (best < 0) {
        // local pit: carve through to the lowest neighbour (erosion) so rivers keep going
        let low = -1, lowH = 9;
        for (const [ddx, ddy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + ddx, ny = y + ddy;
          if (!inBounds(nx, ny)) continue;
          const j = idx(nx, ny);
          if (visited.has(j)) continue;
          if (t.height[j] < lowH) { lowH = t.height[j]; low = j; }
        }
        if (low < 0) break;
        t.height[low] = Math.min(t.height[low], t.height[i] - 0.0005);
        best = low;
      }
      x = best % W; y = Math.floor(best / W);
    }
  }
  // Rivers moisten their banks.
  const moistCopy = t.moist.slice();
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!t.river[idx(x, y)]) continue;
    for (let oy = -3; oy <= 3; oy++) for (let ox = -3; ox <= 3; ox++) {
      if (!inBounds(x + ox, y + oy)) continue;
      const j = idx(x + ox, y + oy);
      moistCopy[j] = Math.min(1, moistCopy[j] + 0.05);
    }
  }
  t.moist.set(moistCopy);

  // Biomes
  for (let i = 0; i < n; i++) {
    const h = t.height[i], tp = t.temp[i], m = t.moist[i];
    let b: Biome;
    if (h <= SEA) b = h < -0.25 ? Biome.DeepWater : Biome.Water;
    else if (h < 0.035) b = tp < 0.22 ? Biome.Tundra : Biome.Beach;
    else if (h > 0.82 || (h > 0.62 && tp < 0.18)) b = Biome.Snow;
    else if (h > 0.6) b = Biome.Mountain;
    else if (h > 0.45) b = tp < 0.25 ? Biome.Taiga : Biome.Hills;
    else if (tp < 0.2) b = Biome.Tundra;
    else if (tp < 0.38) b = m > 0.45 ? Biome.Taiga : Biome.Plains;
    else if (tp > 0.78 && m < 0.42) b = Biome.Desert;
    else if (m > 0.78 && h < 0.12) b = Biome.Marsh;
    else if (m > 0.58) b = Biome.Forest;
    else if (m > 0.4) b = Biome.Grassland;
    else b = Biome.Plains;
    t.biome[i] = b;
  }

  // Resources
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = idx(x, y);
    const b = t.biome[i];
    const PL: Record<number, number> = { 2: 0.5, 3: 1.0, 4: 0.8, 5: 1.2, 6: 0.6, 7: 0.7, 8: 0.2, 10: 0.15, 11: 0.25, 12: 0.8 };
    const GM: Record<number, number> = { 2: 0.2, 3: 1.1, 4: 1.0, 5: 1.1, 6: 0.9, 7: 0.8, 8: 0.35, 10: 0.15, 11: 0.6, 12: 0.5 };
    const pc = (PL[b] ?? 0) * (0.6 + 0.6 * t.moist[i]) * (0.5 + t.temp[i]);
    t.plantsCap[i] = pc * 2.2;
    t.plants[i] = pc * 2.2;
    t.gameCap[i] = (GM[b] ?? 0) * 1.6;
    t.game[i] = t.gameCap[i];
    if (!isWater(b)) {
      let nearWater = 0;
      for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
        if (!inBounds(x + ox, y + oy)) continue;
        const j = idx(x + ox, y + oy);
        if (isWater(t.biome[j])) nearWater = Math.max(nearWater, 1);
        if (t.river[j]) nearWater = Math.max(nearWater, 0.8);
      }
      t.fish[i] = nearWater;
      if ((b === Biome.Hills || b === Biome.Mountain) && rng.chance(0.35)) t.flint[i] = 1;
      if (t.river[i] && rng.chance(0.5)) t.clay[i] = 1;
      if ((b === Biome.Grassland || b === Biome.Plains) && t.temp[i] > 0.42 && t.temp[i] < 0.8 && rng.chance(0.18)) t.grain[i] = 1;
      if ((b === Biome.Hills || b === Biome.Grassland || b === Biome.Plains) && t.temp[i] > 0.35 && rng.chance(0.06)) t.wildHerd[i] = 1;
    }
  }
  return t;
}

/** Find a good starting area: warm, fertile land near a river. */
export function findStart(t: Terrain, rng: Rng): { x: number; y: number } {
  let best = { x: W >> 1, y: H >> 1 }, bestScore = -1;
  for (let k = 0; k < 3000; k++) {
    const x = rng.int(10, W - 11), y = rng.int(H * 0.4, H - 15);
    const i = idx(x, y);
    if (isWater(t.biome[i]) || t.height[i] > 0.4) continue;
    let s = 0;
    for (let oy = -4; oy <= 4; oy++) for (let ox = -4; ox <= 4; ox++) {
      const j = idx(x + ox, y + oy);
      s += t.plantsCap[j] + t.gameCap[j] + t.fish[j] * 0.5 + t.flint[j] * 0.5 + t.grain[j] * 0.3;
    }
    if (s > bestScore) { bestScore = s; best = { x, y }; }
  }
  return best;
}

/** The red planet: dust plains, hills and old craters, ice at the poles; no water, no plants, no game.
 *  People live there under domes and grow their food inside. */
export function generateMars(seed: number): Terrain {
  const rng = new Rng(seed);
  const elev = new Simplex(rng);
  const n = W * H;
  const k = W / OLD_SIZE;
  const t: Terrain = {
    w: W, h: H,
    height: new Float32Array(n), temp: new Float32Array(n), moist: new Float32Array(n), biome: new Uint8Array(n), river: new Uint8Array(n),
    plants: new Float32Array(n), plantsCap: new Float32Array(n), game: new Float32Array(n), gameCap: new Float32Array(n), fish: new Float32Array(n),
    flint: new Uint8Array(n), clay: new Uint8Array(n), grain: new Uint8Array(n), wildHerd: new Uint8Array(n), explored: new Uint8Array(n),
  };
  // craters: round bowls with a raised rim
  const craters = Array.from({ length: Math.round(30 * k * k) }, () => ({ x: rng.range(0, W), y: rng.range(0, H), r: rng.range(3, 14) * k }));
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = idx(x, y);
    let h = 0.25 + 0.3 * elev.fbm((x / W) * 4 * k, (y / H) * 4 * k, 4);
    for (const c of craters) {
      const d = Math.hypot(x - c.x, y - c.y) / c.r;
      if (d < 1) h -= 0.18 * (1 - d * d);
      else if (d < 1.25) h += 0.12 * (1 - Math.abs(d - 1.12) / 0.13);
    }
    h = Math.max(0.04, Math.min(0.95, h));
    t.height[i] = h;
    // the domes keep their people warm: the cold outside does not reach them
    t.temp[i] = 0.5;
    t.moist[i] = 0;
    const pole = Math.min(y, H - 1 - y) / H;
    t.biome[i] = pole < 0.05 ? Biome.Snow : h > 0.66 ? Biome.Mountain : h > 0.46 ? Biome.Hills : Biome.Desert;
    if ((t.biome[i] === Biome.Hills || t.biome[i] === Biome.Mountain) && rng.chance(0.35)) t.flint[i] = 1;
  }
  return t;
}
