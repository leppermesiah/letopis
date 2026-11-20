// What one viewer sees: the whole world, or only one of its maps. The simulation always runs the whole world;
// here its tiles, villages, people and ships are cut to the viewer's map and moved to that map's own coordinates,
// so the page draws one map exactly as it drew the single world before the world could grow.

import type { Simulation } from './sim/sim';
import { mapKey } from './sim/world';
import { PersonRow, SnapshotMessage, TickMessage, WorldInfo, b64encode } from '../shared/types';

export interface View { key: string; x0: number; y0: number; w: number; h: number; map: [number, number] | null }

/** the viewer's view from `?map=gx,gy`; a grown world is always seen one map at a time (missing or not open: the first map) */
export function viewFor(sm: Simulation, param: string | null): View {
  const W = sm.t.w, H = sm.t.h, g = sm.s.grid;
  const all: View = { key: 'all', x0: 0, y0: 0, w: W, h: H, map: null };
  if (!g) return all;
  let [gx, gy] = (param ?? '').split(',').map(Number);
  if (!Number.isFinite(gx) || !Number.isFinite(gy) || !g.open.includes(mapKey(gx, gy))) [gx, gy] = [0, 0];
  const S = sm.mapSize;
  return { key: mapKey(gx, gy), x0: (gx - g.gx0) * S, y0: (gy - g.gy0) * S, w: S, h: S, map: [gx, gy] };
}

function crop<T extends Uint8Array>(a: T, W: number, v: View): Uint8Array {
  if (v.key === 'all') return a;
  const out = new Uint8Array(v.w * v.h);
  for (let y = 0; y < v.h; y++) out.set(a.subarray((y + v.y0) * W + v.x0, (y + v.y0) * W + v.x0 + v.w), y * v.w);
  return out;
}

function bits(a: Uint8Array): string {
  const bytes = new Uint8Array((a.length + 7) >> 3);
  for (let i = 0; i < a.length; i++) if (a[i]) bytes[i >> 3] |= 1 << (i & 7);
  return b64encode(bytes);
}

const inside = (v: View, x: number, y: number) => x >= v.x0 - 0.5 && y >= v.y0 - 0.5 && x < v.x0 + v.w - 0.5 && y < v.y0 + v.h - 0.5;

export function worldInfoFor(sm: Simulation, v: View): WorldInfo {
  const t = sm.t;
  const n = t.w * t.h;
  const height = new Uint8Array(n), temp = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    height[i] = Math.max(0, Math.min(255, Math.round((t.height[i] + 1) * 127.5)));
    temp[i] = Math.round(t.temp[i] * 255);
  }
  const g = sm.s.grid;
  return {
    worldId: sm.s.worldId, seed: sm.s.seed, w: v.w, h: v.h,
    height: b64encode(crop(height, t.w, v)), biome: b64encode(crop(t.biome, t.w, v)), river: b64encode(crop(t.river, t.w, v)), temp: b64encode(crop(temp, t.w, v)),
    treeKinds: b64encode(crop(sm.treeKind, t.w, v)), planet: sm.s.planet,
    grid: g ? { size: sm.mapSize, gx0: g.gx0, gy0: g.gy0, cols: g.cols, rows: g.rows, open: g.open } : undefined,
    view: v.map,
    closed: g && v.key === 'all' && t.closed ? b64encode(t.closed) : undefined,
  };
}

/** villages, people and ships of the view, in its own coordinates */
export type Moving = Required<Pick<SnapshotMessage, 'bands' | 'people' | 'seas'>>;
export const movingOf = (sm: Simulation): Moving => ({ bands: sm.bandViews(), people: sm.personRows(), seas: sm.seaViews() });

function moving(all: Moving, v: View): Moving {
  const { bands, people, seas } = all;
  if (v.key === 'all') return all;
  return {
    bands: bands.filter((b) => inside(v, b.x, b.y)).map((b) => ({ ...b, x: b.x - v.x0, y: b.y - v.y0 })),
    people: people.filter((r) => inside(v, r[1] / 10, r[2] / 10)).map((r) => {
      const o = [...r] as PersonRow;
      o[1] = r[1] - v.x0 * 10;
      o[2] = r[2] - v.y0 * 10;
      return o;
    }),
    seas: seas.filter((s) => inside(v, s.x, s.y) || s.way.some(([x, y]) => inside(v, x, y)))
      .map((s) => ({ ...s, x: s.x - v.x0, y: s.y - v.y0, way: s.way.map(([x, y]) => [x - v.x0, y - v.y0] as [number, number]) })),
  };
}

export function snapshotFor(sm: Simulation, v: View, time: SnapshotMessage['time'], all: Moving = movingOf(sm)): SnapshotMessage {
  return {
    t: 'snapshot', time, ...moving(all, v),
    explored: bits(crop(sm.t.explored, sm.t.w, v)), trees: b64encode(crop(sm.trees, sm.t.w, v)), roads: b64encode(crop(sm.roads, sm.t.w, v)),
    population: sm.s.people.length, totalBorn: sm.s.totalBorn, totalDied: sm.s.totalDied,
  };
}

/** [tile, value, tile, value, ...] of the whole world -> of the view */
function changes(list: number[], W: number, v: View): number[] {
  if (v.key === 'all') return list;
  const out: number[] = [];
  for (let k = 0; k < list.length; k += 2) {
    const x = list[k] % W, y = Math.floor(list[k] / W);
    if (x < v.x0 || y < v.y0 || x >= v.x0 + v.w || y >= v.y0 + v.h) continue;
    out.push((y - v.y0) * v.w + (x - v.x0), list[k + 1]);
  }
  return out;
}

export function tickFor(sm: Simulation, v: View, base: Pick<TickMessage, 'time' | 'events' | 'population'>, all: Moving, explored: boolean, trees: number[], roads: number[]): TickMessage {
  const msg: TickMessage = { t: 'tick', ...base, ...moving(all, v) };
  if (explored) msg.explored = bits(crop(sm.t.explored, sm.t.w, v));
  const tr = changes(trees, sm.t.w, v), rd = changes(roads, sm.t.w, v);
  if (tr.length) msg.trees = tr;
  if (rd.length) msg.roads = rd;
  return msg;
}
