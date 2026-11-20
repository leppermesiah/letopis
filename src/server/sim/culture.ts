// Cultures that learn. Clans that come from the same first clan share a way of life: one small neural network that
// looks at what the clan lives with every month and leans its work towards farming, herding, fishing, crafting,
// building or foraging. Nobody writes the right answer: the culture tries a small change of its network for five
// years, then the opposite change for five more, and keeps going in the direction that let it grow more
// (an evolution strategy). A culture that does clearly worse than a neighbour takes up part of the neighbour's ways,
// and a culture that spread over many clans splits in two, so the world grows several ways of life.
// Everything is computed here, on the server, and saved with the world.

import { Rng } from '../../shared/rng';

/** what a clan feels each month (all about -1..1) */
export const SENSES = ['spring/autumn', 'winter/summer', 'hunger', 'stores', 'game', 'fish', 'fields', 'cold', 'size', 'settled', 'crowding', 'last period'] as const;
/** numbers the network writes for itself and reads back next month */
export const MEM = 3;
/** the jobs it leans: the order of the work weights in sim.work() */
export const JOBS = ['farm', 'herd', 'fish', 'craft', 'build', 'forage'] as const;
export type Job = (typeof JOBS)[number];

const IN = SENSES.length + MEM;
const HID = 12;
const OUT = JOBS.length + MEM;
const PARAMS = HID * IN + HID + OUT * HID + OUT;
/** months a culture lives with one variation */
const PERIOD = 60;
const SIGMA = 0.15;
const RATE = 0.06;
const MOMENTUM = 0.7;
/** how far the network may move a job's weight: x0.55 .. x1.8 */
const LEAN = 0.6;
/** a culture this big splits in two */
const SPLIT_AT = 12;

export interface Culture {
  id: number;
  /** the clan it began with, for the chronicle */
  root: string;
  theta: number[];
  mom: number[];
  /** 0: living with +noise, 1: with -noise */
  phase: 0 | 1;
  /** the tick the current half began, the people then, and how the + half went */
  t0: number;
  pop0: number;
  plus?: number;
  /** the growth of the last full period (log ratio a year), for the senses and for learning from neighbours */
  last: number;
  /** how many periods it lived */
  epoch: number;
  /** its way of life (the job it leans to most), and when that was written in the chronicle */
  style?: Job | 'mixed';
  styleYear?: number;
  /** what it leaned to last year (it becomes the style when it holds a second year) */
  cand?: Job | 'mixed';
  /** the average lean of every job over the last year, summed monthly */
  lean?: number[];
  leanN?: number;
}

export interface CultureState {
  cultures: Record<number, Culture>;
  next: number;
}

function noise(seed: number, c: Culture): number[] {
  const r = new Rng((seed ^ Math.imul(c.id + 1, 0x9e3779b1) ^ Math.imul(c.epoch + 7, 0x85ebca6b)) >>> 0);
  // a normal-ish number: the sum of three uniform ones
  return Array.from({ length: PARAMS }, () => (r.next() + r.next() + r.next() - 1.5) * 2);
}

export function newCulture(st: CultureState, root: string, tick: number, pop: number, theta?: number[]): Culture {
  const c: Culture = {
    id: st.next++, root, theta: theta ? [...theta] : new Array(PARAMS).fill(0), mom: new Array(PARAMS).fill(0),
    phase: 0, t0: tick, pop0: pop, last: 0, epoch: 0,
  };
  st.cultures[c.id] = c;
  return c;
}

/** the network a culture lives with right now: its weights and the variation it tries */
function weights(seed: number, c: Culture, cache: Map<number, number[]>): number[] {
  let w = cache.get(c.id);
  if (!w) {
    const e = noise(seed, c), s = c.phase === 0 ? SIGMA : -SIGMA;
    w = c.theta.map((t, i) => t + s * e[i]);
    cache.set(c.id, w);
  }
  return w;
}

/** the lean of every job (multipliers for the work weights) and the memory to keep */
export function decide(w: number[], x: number[]): { lean: number[]; mem: number[] } {
  const h = new Array(HID);
  let o = 0;
  for (let j = 0; j < HID; j++) {
    let s = 0;
    for (let i = 0; i < IN; i++) s += w[o++] * x[i];
    h[j] = s;
  }
  for (let j = 0; j < HID; j++) h[j] = Math.tanh(h[j] + w[o++]);
  const out = new Array(OUT);
  for (let k = 0; k < OUT; k++) {
    let s = 0;
    for (let j = 0; j < HID; j++) s += w[o++] * h[j];
    out[k] = s;
  }
  for (let k = 0; k < OUT; k++) out[k] = Math.tanh(out[k] + w[o++]);
  return {
    lean: out.slice(0, JOBS.length).map((v) => Math.exp(v * LEAN)),
    mem: out.slice(JOBS.length),
  };
}

export class Cultures {
  private cache = new Map<number, number[]>();
  constructor(public st: CultureState, private seed: number) {}

  /** a clan's lean this month (and its memory for the next) */
  /** avail: which jobs the clan can do at all (only those count for its way of life) */
  lean(cultureId: number, x: number[], avail: boolean[]): { lean: number[]; mem: number[] } {
    const c = this.st.cultures[cultureId];
    if (!c) return { lean: JOBS.map(() => 1), mem: new Array(MEM).fill(0) };
    const r = decide(weights(this.seed, c, this.cache), x);
    c.lean ??= JOBS.map(() => 0);
    for (let k = 0; k < JOBS.length; k++) c.lean[k] += avail[k] ? r.lean[k] : 1;
    c.leanN = (c.leanN ?? 0) + 1;
    return r;
  }

  /** once a year: learn where a half ended, take up a better neighbour's ways, split the big ones.
   *  pops: people of every culture now; near: cultures next to each other; returns what happened, for the chronicle */
  yearly(tick: number, pops: Map<number, number>, near: Map<number, Set<number>>):
    { styled: { c: Culture; style: Job | 'mixed' }[]; taught: { c: Culture; from: Culture }[] } {
    const styled: { c: Culture; style: Job | 'mixed' }[] = [];
    const taught: { c: Culture; from: Culture }[] = [];
    for (const c of Object.values(this.st.cultures)) {
      const pop = pops.get(c.id) ?? 0;
      if (!pop) { delete this.st.cultures[c.id]; continue; }
      // its way of life this year: the job it leaned to most, if clearly more than the rest
      if (c.lean && c.leanN) {
        // building is part of every way of life, not one of its own
        const avg = c.lean.map((v, k) => (JOBS[k] === 'build' ? 0 : v / c.leanN!));
        const k = avg.indexOf(Math.max(...avg));
        const seen: Job | 'mixed' = avg[k] > 1.4 ? JOBS[k] : 'mixed';
        // a way of life is a way of life only if it holds two years in a row
        const style = seen === c.cand ? seen : c.style ?? 'mixed';
        c.cand = seen;
        if (style !== c.style) {
          const old = c.style;
          c.style = style;
          if (old && style !== 'mixed') styled.push({ c, style });
        }
        c.lean = undefined; c.leanN = undefined;
      }
      if (tick - c.t0 < PERIOD) continue;
      const growth = Math.log((pop + 1) / (c.pop0 + 1)) / (PERIOD / 12);
      if (c.phase === 0) {
        c.plus = growth;
        c.phase = 1;
      } else {
        // the two halves: move towards the better one, the bigger the difference the further
        const diff = Math.max(-1, Math.min(1, ((c.plus ?? 0) - growth) * 10));
        const e = noise(this.seed, c);
        for (let i = 0; i < PARAMS; i++) {
          c.mom[i] = MOMENTUM * c.mom[i] + RATE * diff * e[i];
          c.theta[i] = Math.max(-3, Math.min(3, c.theta[i] + c.mom[i]));
        }
        c.last = ((c.plus ?? 0) + growth) / 2;
        c.phase = 0;
        c.epoch++;
      }
      c.t0 = tick;
      c.pop0 = pop;
      this.cache.delete(c.id);
    }
    // a culture doing clearly worse than a neighbour takes up a fifth of its ways
    for (const c of Object.values(this.st.cultures)) {
      if (!c.epoch) continue;
      let best: Culture | null = null;
      for (const o of near.get(c.id) ?? []) {
        const n = this.st.cultures[o];
        if (n && n.epoch && n.last > c.last + 0.01 && (!best || n.last > best.last)) best = n;
      }
      if (!best) continue;
      for (let i = 0; i < PARAMS; i++) c.theta[i] = c.theta[i] * 0.8 + best.theta[i] * 0.2;
      this.cache.delete(c.id);
      if (best.style && best.style !== 'mixed' && best.style !== c.style) taught.push({ c, from: best });
    }
    return { styled, taught };
  }

  /** a culture spread over too many clans splits in two along its longest side; returns the clans that change culture */
  split(tick: number, bands: { id: number; cx: number; cy: number; culture?: number }[], pops: Map<number, number>, rootOf: (bandId: number) => string): number {
    let moved = 0;
    const by = new Map<number, typeof bands>();
    for (const b of bands) if (b.culture !== undefined) (by.get(b.culture) ?? by.set(b.culture, []).get(b.culture)!).push(b);
    for (const [id, list] of by) {
      if (list.length < SPLIT_AT) continue;
      const c = this.st.cultures[id];
      if (!c) continue;
      const xs = list.map((b) => b.cx), ys = list.map((b) => b.cy);
      const wide = Math.max(...xs) - Math.min(...xs) >= Math.max(...ys) - Math.min(...ys);
      const key = (b: { cx: number; cy: number }) => (wide ? b.cx : b.cy);
      const sorted = [...list].sort((a, b) => key(a) - key(b));
      const half = sorted.slice(Math.floor(sorted.length / 2));
      const nc = newCulture(this.st, rootOf(half[0].id), tick, 0, c.theta);
      nc.style = c.style;
      nc.last = c.last;
      for (const b of half) b.culture = nc.id;
      nc.pop0 = half.reduce((s, b) => s + (pops.get(b.id) ?? 0), 0);
      c.pop0 = Math.max(0, c.pop0 - nc.pop0);
      moved += half.length;
    }
    return moved;
  }
}
