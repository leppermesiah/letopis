// Ships on the sea: once towns know the harbour, boats sail between them, and a colony's settlers come on a galleon.
// Only for the eye: the simulation does not know about them.

import { Sprite } from 'pixi.js';
import type { WorldRenderer } from './render';
import { iso } from './render';
import type { BandView, SeaView } from '../shared/types';

interface Harbour { id: number; x: number; y: number; kind: string; frames: number }
/** a ship of settlers the simulation sails: slow, across the open sea */
interface Voyager { s: Sprite; kind: string; frames: number; mul: number; path: [number, number][]; t0: number; dur: number; seed: number }
interface Ship { s: Sprite; path: [number, number][]; t: number; speed: number; kind: string; frames: number; seed: number }

/** the best ship a town can build, and how many animation frames its sprite has */
function shipOf(techs: Set<string>): [string, number] | null {
  if (techs.has('computer')) return Math.random() < 0.5 ? ['containership', 1] : ['steamer', 4];
  if (techs.has('steamship')) return Math.random() < 0.6 ? ['steamer', 4] : ['galleon', 4];
  if (techs.has('caravel')) return Math.random() < 0.6 ? ['galleon', 4] : ['caravel', 4];
  if (techs.has('compass')) return ['cog', 1];
  if (techs.has('harbor')) return ['galley', 1];
  return null;
}

/** the ship that carries settlers far over the sea */
function voyagerOf(techs: Set<string>): [string, number] {
  if (techs.has('steamship')) return ['steamer', 4];
  if (techs.has('caravel')) return ['caravel', 4];
  if (techs.has('compass')) return ['cog', 1];
  if (techs.has('harbor')) return ['galley', 1];
  return ['rowship', 4];
}

/** the sail-and-oar ship is drawn at the people's scale on its sheet, where its rowers come out tiny: made bigger */
const VOYAGER_SIZE: Record<string, number> = { rowship: 2.6 };

const MAX_SHIPS = 10;
const REACH = 70;

export class Fleet {
  ships: Ship[] = [];
  private harbours: Harbour[] = [];
  private paths = new Map<string, [number, number][] | null>();
  private known = new Set<number>();
  private first = true;
  private lastSpawn = 0;
  private voyagers = new Map<number, Voyager>();
  constructor(public r: WorldRenderer) {}

  /** the settlers' ships: each month a stretch of their way, sailed slowly over the whole month */
  updateSeas(seas: SeaView[], tickMs: number) {
    const seen = new Set<number>();
    for (const v of seas) {
      seen.add(v.id);
      let sh = this.voyagers.get(v.id);
      if (!sh) {
        let [kind, frames] = voyagerOf(new Set(v.techs));
        if (!this.r.atlas.has(frames > 1 ? `${kind}0` : kind)) { kind = 'galleon'; frames = 4; }
        if (!this.r.atlas.has(`${kind}0`) && !this.r.atlas.has(kind)) continue;
        const s = this.r.atlas.sprite(frames > 1 ? `${kind}0` : kind);
        this.r.peopleLayer.addChild(s);
        sh = { s, kind, frames, mul: VOYAGER_SIZE[kind] ?? 1, path: [[v.x, v.y]], t0: performance.now(), dur: 1, seed: Math.random() * 100 };
        this.voyagers.set(v.id, sh);
      }
      const at = this.voyagerAt(sh, performance.now());
      sh.path = [at, ...v.way];
      if (sh.path.length < 2) sh.path.push([v.x, v.y]);
      sh.t0 = performance.now();
      sh.dur = Math.max(800, tickMs * 0.98);
    }
    for (const [id, sh] of this.voyagers) if (!seen.has(id)) { sh.s.destroy(); this.voyagers.delete(id); }
  }

  private voyagerAt(sh: Voyager, now: number): [number, number] {
    const k = Math.max(0, Math.min(1, (now - sh.t0) / sh.dur)) * (sh.path.length - 1);
    const i = Math.min(sh.path.length - 2, Math.floor(k));
    if (i < 0) return sh.path[0];
    const f = k - i, [x0, y0] = sh.path[i], [x1, y1] = sh.path[i + 1];
    return [x0 + (x1 - x0) * f, y0 + (y1 - y0) * f];
  }

  /** a sea tile 1 to 5 steps from the town */
  private spot(b: BandView): { x: number; y: number } | null {
    const bx = Math.round(b.x), by = Math.round(b.y);
    for (let d = 1; d <= 5; d++) {
      for (const [dx, dy] of [[d, 0], [0, d], [d, d], [-d, d], [d, -d], [-d, 0], [0, -d], [-d, -d]]) {
        if (this.r.isSea(bx + dx, by + dy)) return { x: bx + dx, y: by + dy };
      }
    }
    return null;
  }

  updateBands(bands: BandView[]) {
    if (!this.r.info) return;
    this.harbours = [];
    for (const b of bands) {
      if (!b.settled) continue;
      const kind = shipOf(new Set(b.techIds));
      if (!kind) continue;
      const p = this.spot(b);
      if (p) this.harbours.push({ id: b.id, x: p.x, y: p.y, kind: kind[0], frames: kind[1] });
    }
    // a new colony: its settlers sail in from the town they left
    for (const b of bands) {
      if (this.known.has(b.id)) continue;
      this.known.add(b.id);
      if (this.first || !b.colony || !b.from) continue;
      const from = this.harbours.find((h) => h.id === b.from!.id);
      const to = this.spot(b);
      if (from && to) this.launch({ x: from.x, y: from.y }, to, 'galleon', 4, 0.9);
    }
    this.first = false;
  }

  /** the shortest way over the water (8 directions), or null if there is none close by */
  private route(a: { x: number; y: number }, b: { x: number; y: number }): [number, number][] | null {
    const key = `${a.x},${a.y}>${b.x},${b.y}`;
    if (this.paths.has(key)) return this.paths.get(key)!;
    const { w, h } = this.r.info;
    const prev = new Map<number, number>();
    const start = a.y * w + a.x, goal = b.y * w + b.x;
    const queue = [start];
    prev.set(start, -1);
    let found = false;
    for (let qi = 0; qi < queue.length && qi < 30000; qi++) {
      const c = queue[qi];
      if (c === goal) { found = true; break; }
      const cx = c % w, cy = Math.floor(c / w);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
        const nx = cx + dx, ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const n = ny * w + nx;
        if (prev.has(n) || !this.r.isSea(nx, ny)) continue;
        // no squeezing diagonally between two bits of land
        if (dx && dy && (!this.r.isSea(cx + dx, cy) || !this.r.isSea(cx, cy + dy))) continue;
        prev.set(n, c);
        queue.push(n);
      }
    }
    let path: [number, number][] | null = null;
    if (found) {
      path = [];
      for (let c = goal; c !== -1; c = prev.get(c)!) path.push([c % w, Math.floor(c / w)]);
      path.reverse();
    }
    this.paths.set(key, path);
    return path;
  }

  private launch(a: { x: number; y: number }, b: { x: number; y: number }, kind: string, frames: number, speed: number): boolean {
    const name = frames > 1 ? `${kind}0` : kind;
    if (!this.r.atlas.has(name)) return false;
    const path = this.route(a, b);
    if (!path || path.length < 4) return false;
    const s = this.r.atlas.sprite(name);
    this.r.peopleLayer.addChild(s);
    this.ships.push({ s, path, t: 0, speed, kind, frames, seed: Math.random() * 100 });
    return true;
  }

  frame(now: number, dt: number) {
    if (!this.r.info) return;
    for (const sh of this.voyagers.values()) {
      const [x, y] = this.voyagerAt(sh, now);
      const p = this.r.tileTop(x, y);
      sh.s.position.set(p.x, p.y + Math.sin(now / 600 + sh.seed) * 0.6);
      // the atlas sets the size with every frame: bigger for the sail-and-oar ship (and keep the way it faces)
      const facing = Math.sign(sh.s.scale.x) || 1;
      this.r.atlas.set(sh.s, sh.frames > 1 ? `${sh.kind}${Math.floor(now / 400 + sh.seed) % sh.frames}` : sh.kind, sh.mul);
      sh.s.scale.x *= facing;
      const k = Math.max(0, Math.min(1, (now - sh.t0) / sh.dur)) * (sh.path.length - 1);
      const i = Math.max(0, Math.min(sh.path.length - 2, Math.floor(k)));
      if (sh.path.length > 1) {
        const [x0, y0] = sh.path[i], [x1, y1] = sh.path[i + 1];
        const dx = iso(x1, y1).x - iso(x0, y0).x;
        if (Math.abs(dx) > 0.01) sh.s.scale.x = Math.abs(sh.s.scale.x) * (dx < 0 ? -1 : 1);
      }
    }
    // now and then a ship leaves one harbour for another one not too far away
    if (now - this.lastSpawn > 6000 && this.harbours.length >= 2 && this.ships.length < Math.min(MAX_SHIPS, this.harbours.length)) {
      this.lastSpawn = now;
      const a = this.harbours[Math.floor(Math.random() * this.harbours.length)];
      const near = this.harbours.filter((h) => h !== a && Math.hypot(h.x - a.x, h.y - a.y) < REACH && Math.hypot(h.x - a.x, h.y - a.y) > 6);
      if (near.length) {
        const b = near[Math.floor(Math.random() * near.length)];
        this.launch(a, b, a.kind, a.frames, a.frames > 1 ? 0.7 : 0.5);
      }
    }
    for (const sh of this.ships) {
      sh.t += sh.speed * dt;
      const i = Math.min(sh.path.length - 2, Math.floor(sh.t));
      const f = Math.min(1, sh.t - i);
      const [x0, y0] = sh.path[i], [x1, y1] = sh.path[i + 1];
      const x = x0 + (x1 - x0) * f, y = y0 + (y1 - y0) * f;
      const p = this.r.tileTop(x, y);
      // gently rocking on the waves
      sh.s.position.set(p.x, p.y + Math.sin(now / 600 + sh.seed) * 0.6);
      if (sh.frames > 1) this.r.atlas.set(sh.s, `${sh.kind}${Math.floor(now / 400 + sh.seed) % sh.frames}`);
      // the sprites face south-east; going west on screen the ship turns round
      // (the container ship is drawn facing south-west)
      const west = (iso(x1, y1).x < iso(x0, y0).x) !== (sh.kind === 'containership');
      sh.s.scale.x = Math.abs(sh.s.scale.x) * (west ? -1 : 1);
      // a ship fades in as it leaves and out as it arrives
      const left = sh.path.length - 1 - sh.t;
      sh.s.alpha = Math.min(1, sh.t / 1.5, left / 1.5);
    }
    this.ships = this.ships.filter((sh) => {
      if (sh.t < sh.path.length - 1) return true;
      sh.s.destroy();
      return false;
    });
  }
}
