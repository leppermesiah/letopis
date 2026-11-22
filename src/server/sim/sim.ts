import { Rng } from '../../shared/rng';
import {
  BandView, ChronicleEntry, ChronicleRef, GoneBand, PersonDetail, PersonRow, TASKS, TASK_NAMES, Task, CHIEF_TITLES, TimeInfo, TreeNode, FamilyTree, b64encode, formatYear, isWater, Biome, RIVER_WATER,
} from '../../shared/types';
import { Terrain, Grid, GRID_REACH, generateTerrain, generateMars, buildTerrain, growTerrain, mapKey, findStart, idx, inBounds, W, H, setWorldSize, OLD_SIZE, NEW_SIZE } from './world';
import { SECRET_COUNT, SECRET_HEROES, SECRET_KINDS, SecretFind } from '../../shared/secrets';
import { FEMALE, MALE, bandColor, bandName, fixBandName, familyFrom, nickname, placeName } from './names';
import { ERAS, TECHS, TECH_BY_ID, Tech, eraOf, techOpen } from './tech';
import { CultureState, Cultures, JOBS, Job, MEM, newCulture } from './culture';

/** a culture's way of life in the chronicle: [bg, en, de ("leben jetzt vor allem ...")] */
const STYLE: Record<Job, [string, string, string]> = {
  farm: ['орат земята', 'farming', 'vom Ackerbau'],
  herd: ['гледат стада', 'herding', 'von der Viehzucht'],
  fish: ['ловят риба', 'fishing', 'vom Fischfang'],
  craft: ['живеят от занаяти', 'crafts', 'vom Handwerk'],
  build: ['строят', 'building', 'vom Bauen'],
  forage: ['ловуват и събират', 'hunting and gathering', 'von der Jagd und vom Sammeln'],
};
import { FAMOUS, fameRole } from '../../shared/famous';
import { realPeople } from '../../shared/people';
import { BIG, startStage, treeKinds } from '../../shared/trees';
import { findRoad } from './roads';
import { BEAST_EN, ERAS_EN, FEATURE_EN, SECRET_HEROES_EN, SECRET_KINDS_EN, TECH_EN, bandEn, bandLabelEn, bandThe, villageEn, causeEn, chiefEn, deedEn, personEn, translit } from '../../shared/i18n';
import {
  BEAST_DE, ERAS_DE, ERAS_DE_ART, ERA_WHY_DE, FEATURE_DE, SECRET_HEROES_DE, SECRET_KINDS_DE, TECH_DE, bandLabelDe, bandWithDe, causeDe, chiefDe,
  fillTechDe, numDe, personDe, techDe, villageDe,
} from '../../shared/i18n-de';

export const START_YEAR = -12000;
/** what a new age brings, written in the chronicle when the first band reaches it: [bg, en] */
const ERA_WHY: Record<number, [string, string]> = {
  1: ['Хората вече не само търсят храна, а я отглеждат.', 'People no longer only search for food, they grow it.'],
  2: ['Медта и калаят се сливат в метал, по-твърд от камъка. Селата растат в градове.', 'Copper and tin melt into a metal harder than stone. Villages grow into towns.'],
  3: ['Желязото е навсякъде и е по-евтино от бронза. Селата се събират в царства.', 'Iron is everywhere and cheaper than bronze. Villages come together into kingdoms.'],
  4: ['Замъци пазят селата, манастирите пазят знанието, а вятърът и водата мелят брашното.', 'Castles guard the villages, monasteries guard knowledge, and wind and water grind the flour.'],
  5: ['Корабите прекосяват откритото море, на далечни брегове никнат нови села, а вестниците разнасят новините.', 'Ships cross the open sea, new villages spring up on distant shores, and newspapers carry the news.'],
  6: ['Парата движи машини, кораби и влакове, а фабриките правят стоки за всички.', 'Steam drives machines, ships and trains, and factories make goods for everyone.'],
  7: ['Компютрите смятат, картините летят по въздуха, а една мрежа свързва целия свят.', 'Computers count, pictures fly through the air, and one network joins the whole world.'],
  8: ['Хората живеят на Луната, а корабите им летят към планетите.', 'People live on the Moon, and their ships fly to the planets.'],
};
/** chance per band and month for an idea whose time has come */
const GLOBAL_DISCOVERY = 0.0003;
/** a kingdom holds at most this many towns, all within this distance of the capital */
const KINGDOM_MAX = 8;
const KINGDOM_REACH = 32;
/** people a town needs before it can found a kingdom */
const KINGDOM_FOUNDER = 250;
/** kings marry their children to neighbouring royal houses this far apart; allied realms may later unite up to this many towns */
const ALLY_REACH = 90;
const UNION_MAX = 16;
const GENE_KEYS = ['str', 'int', 'cur', 'soc', 'hea', 'lon'] as const;
type GeneKey = (typeof GENE_KEYS)[number];
export const GENE_NAMES: Record<GeneKey, string> = {
  str: 'Сила', int: 'Ум', cur: 'Любопитство', soc: 'Общителност', hea: 'Здраве', lon: 'Дълголетие',
};

export interface Person {
  id: number;
  first: string;
  nick: string | null;
  family: string | null;
  sex: 0 | 1;
  born: number; // tick
  motherId: number | null;
  fatherId: number | null;
  partnerId: number | null;
  bandId: number;
  genes: Record<GeneKey, number>;
  x: number;
  y: number;
  task: Task;
  children: number[];
  deeds: string[];
  gen: number;
  lastBirth: number; // tick of last child (women)
  /** a famous person of the real world: index in FAMOUS + 1 */
  fame?: number;
}

export interface Band {
  id: number;
  name: string;
  color: number;
  cx: number;
  cy: number;
  settled: boolean;
  settlementName: string | null;
  techs: string[];
  food: number;
  founded: number; // tick
  lastProd: number;
  lastNeed: number;
  fed?: number; // smoothed food cover, 1 = just enough
  met: number[]; // bands already met
  /** the head of the band: always the oldest man */
  chiefId?: number | null;
  /** who founded the band and which band they left (none for the first bands) */
  founder?: { id: number; name: string } | null;
  from?: { id: number; name: string } | null;
  /** wood the band still needs to cut (one unit = one young tree) */
  wood?: number;
  /** nomads: the chief went ahead to look at a new place; the band follows when he gets there */
  scout?: { x: number; y: number; px?: number; py?: number } | null;
  /** the kingdom this town belongs to (iron age) */
  kingdom?: number | null;
  /** founded by settlers who came over the sea (from v1.40) */
  colony?: boolean;
  /** on a small island: it stays a village, there is no room for a town (from v1.90.2) */
  isle?: boolean;
  /** two towns grown into one keep room for all of them, so nobody has to leave again at once (from v1.92) */
  room?: number;
  /** the culture it belongs to (from v1.90.2) and the numbers its network keeps from month to month */
  culture?: number;
  mem?: number[];
}

/** villages that joined under one crown, peacefully: the chief of the capital is the king */
export interface Kingdom {
  id: number;
  /** the capital's name when the kingdom was founded (Bulgarian; the kingdom keeps it) */
  place: string;
  capital: number;
  members: number[];
  founded: number; // year
  /** royal weddings: ally kingdom id -> the year they became allies (from v1.40) */
  allies?: Record<number, number>;
  /** every king the realm had, first to last (from v1.41) */
  kings?: { id: number; name: string; from: number; to?: number }[];
}

/** Everything in here is saved to disk. */
export interface SimState {
  version: 1;
  /** the maps opened so far, when ships found more than the first (from v1.90.2), and the year of the last one */
  grid?: Grid;
  lastMapYear?: number;
  /** ships of settlers at sea (from v1.90.2) */
  fleet?: Sea[];
  /** cultures that learn their way of life (from v1.90.2) */
  cultures?: CultureState;
  worldId: string;
  seed: number;
  /** map side in tiles; missing in worlds saved before maps grew (192) */
  size?: number;
  /** secrets (easter eggs) found by the people watching; numbers only in v1.04 saves */
  secrets?: (number | SecretFind)[];
  tick: number;
  rng: [number, number, number, number];
  nextPersonId: number;
  nextBandId: number;
  nextEventId: number;
  people: Person[];
  bands: Band[];
  usedPlaces: string[];
  usedBands: string[];
  discovered: string[]; // techs known by anyone ever (first discovery)
  totalBorn: number;
  totalDied: number;
  /** everyone a flood, drought or plague has taken */
  disasterDead?: number;
  era: number;
  startedAt: number;
  milestone: number;
  /** famous people born in this world: index in FAMOUS, person id, their band, year of death */
  famous?: { i: number; id: number; band: string; died?: number }[];
  plants: number[]; // terrain resource state (rounded)
  game: number[];
  explored: string; // base64
  /** first discoveries ever: what, who, when (from v1.14) */
  firsts?: { tech: string; pid: number; name: string; band: string; year: number }[];
  /** size of every tree, one byte per tile (0 none .. 4 big); missing before v1.11 */
  trees?: string;
  /** road on every tile (0 none, 1 dirt, 2 paved; +4 a railway, from v1.51); missing before v1.20 */
  roads?: string;
  /** village pairs joined by a road, as 'a-b:level' */
  roadPairs?: string[];
  /** town pairs joined by a railway, as 'a-b' (9 behind it: no way there) (from v1.51) */
  railPairs?: string[];
  /** iron age kingdoms (from v1.35) */
  kingdoms?: Kingdom[];
  /** everyone who ever wore a crown (from v1.41) */
  kingIds?: number[];
  nextKingdomId?: number;
  /** 'mars': the second world, where the colonists live under domes (from v1.80) */
  planet?: 'mars';
  /** ships that flew between the worlds */
  ships?: number;
}

/** people on their way to the other world */
/** a ship of settlers on its way over the sea to a new land (from v1.90.2) */
export interface Sea {
  id: number;
  x: number;
  y: number;
  /** the tiles it sailed this month, and the ones still ahead */
  way: number[];
  path: number[];
  people: Person[];
  techs: string[];
  from: number;
  fromBg: string;
  fromEn: string;
  fromDe: string;
  dest: [number, number];
  isle: boolean;
  culture?: number;
  color: number;
  /** sailing to the edge of the known world: the map it will open */
  explore?: [number, number];
  /** a whole village that moved to the new world (its people are in `people`) */
  band?: Band;
}

export interface Voyage { people: Person[]; techs: string[]; from: string; fromEn: string; fromDe: string; first: boolean }

export interface DeadRecord {
  id: number;
  name: string;
  sex: 0 | 1;
  born: number;
  died: number;
  cause: string;
  motherId: number | null;
  fatherId: number | null;
  partnerId: number | null;
  children: number[];
  deeds: string[];
  genes: Record<string, number>;
  bandName: string;
  gen: number;
}

export function yearOf(tick: number): number {
  return START_YEAR + tick / 12;
}

export class Simulation {
  s: SimState;
  t: Terrain;
  rng: Rng;
  private byId = new Map<number, Person>();
  private bandById = new Map<number, Band>();
  private techSets = new Map<number, Set<string>>();
  private regions: Int32Array = new Int32Array(0);
  /** which tree can grow on each tile (0 none), and how big it is now (0..4) */
  treeKind: Uint8Array = new Uint8Array(0);
  trees: Uint8Array = new Uint8Array(0);
  /** trees that changed this month, as [tile, stage, tile, stage, ...] for the viewers */
  treeChanges: number[] = [];
  roads: Uint8Array = new Uint8Array(0);
  /** roads built this month, as [tile, level, ...] for the viewers */
  roadChanges: number[] = [];
  events: ChronicleEntry[] = [];
  deadQueue: DeadRecord[] = [];
  goneQueue: GoneBand[] = [];
  exploredDirty = true;
  private cul?: Cultures;
  /** the cultures and their networks (made on first use, also for old worlds) */
  private culs(): Cultures {
    return (this.cul ??= new Cultures(this.s.cultures ??= { cultures: {}, next: 1 }, this.s.seed));
  }
  /** set by the server so that dead people's names can be looked up */
  lookupDead: (id: number) => DeadRecord | null = () => null;

  constructor(state: SimState | null, seed?: number) {
    if (state) {
      this.s = state;
      setWorldSize(state.size ?? OLD_SIZE);
      for (const b of state.bands) b.name = fixBandName(b.name);
      state.usedBands = state.usedBands.map(fixBandName);
      this.t = state.planet === 'mars' ? generateMars(state.seed) : state.grid ? buildTerrain(state.seed, state.size ?? OLD_SIZE, state.grid) : generateTerrain(state.seed);
      this.regions = this.landRegions();
      this.rng = new Rng(state.rng);
      for (let i = 0; i < state.plants.length; i++) this.t.plants[i] = state.plants[i] / 100;
      for (let i = 0; i < state.game.length; i++) this.t.game[i] = state.game[i] / 100;
      const ex = Buffer.from(state.explored, 'base64');
      for (let i = 0; i < this.t.explored.length; i++) this.t.explored[i] = (ex[i >> 3] >> (i & 7)) & 1;
      this.initTrees(state.trees);
      // no trees grow on Mars
      if (state.planet === 'mars') { this.treeKind.fill(0); this.trees.fill(0); }
      this.roads = state.roads ? new Uint8Array(Buffer.from(state.roads, 'base64')) : new Uint8Array(W * H);
      if (this.roads.length !== W * H) this.roads = new Uint8Array(W * H);
      this.dryCamps();
    } else {
      const sd = seed ?? Math.floor(Math.random() * 2 ** 31);
      setWorldSize(NEW_SIZE);
      this.t = generateTerrain(sd);
      this.regions = this.landRegions();
      this.initTrees();
      this.roads = new Uint8Array(W * H);
      this.rng = new Rng(sd ^ 0x5bd1e995);
      this.s = {
        version: 1,
        worldId: `${new Date().toISOString().slice(0, 10)}-${sd.toString(36)}`,
        seed: sd,
        size: NEW_SIZE,
        tick: 0,
        rng: this.rng.s,
        nextPersonId: 1,
        nextBandId: 1,
        nextEventId: 1,
        people: [],
        bands: [],
        usedPlaces: [],
        usedBands: [],
        discovered: [],
        totalBorn: 0,
        totalDied: 0,
        era: 0,
        startedAt: Date.now(),
        milestone: 0,
        plants: [],
        game: [],
        explored: '',
      };
      this.genesis();
    }
    this.reindex();
    this.treeChanges = [];
    this.roadChanges = [];
  }

  /** the side of one map in tiles */
  get mapSize(): number {
    return this.s.size ?? OLD_SIZE;
  }

  /** where tile (0, 0) lies in the coordinates of the first map */
  origin(): [number, number] {
    const g = this.s?.grid;
    return g ? [g.gx0 * this.mapSize, g.gy0 * this.mapSize] : [0, 0];
  }

  private kindsOfTrees(): Uint8Array {
    const [ox, oy] = this.origin();
    return treeKinds(W, H, this.t.biome, this.t.river, this.t.temp, ox, oy);
  }

  /** the Earth and Mars share the size of the map: whoever is worked on sets it first */
  use(): this {
    setWorldSize(this.t.w, this.t.h);
    return this;
  }

  /** the map (gx, gy) a tile lies on */
  mapAt(x: number, y: number): [number, number] {
    const S = this.mapSize, g = this.s.grid;
    return [Math.floor(x / S) + (g?.gx0 ?? 0), Math.floor(y / S) + (g?.gy0 ?? 0)];
  }

  isOpen(gx: number, gy: number): boolean {
    return this.s.grid ? this.s.grid.open.includes(mapKey(gx, gy)) : gx === 0 && gy === 0;
  }

  /** set when the world grew this month, for the server to tell the viewers */
  grew: { dx: number; dy: number } | null = null;

  /** a ship reached the edge: the next map opens there. The old tiles keep everything, only shifted when the
   *  world grows to the west or north */
  openMap(gx: number, gy: number): boolean {
    if (this.mars || Math.abs(gx) > GRID_REACH || Math.abs(gy) > GRID_REACH || this.isOpen(gx, gy)) return false;
    const S = this.mapSize;
    const g = this.s.grid ?? { gx0: 0, gy0: 0, cols: 1, rows: 1, open: [mapKey(0, 0)] };
    const oldW = W, oldH = H;
    if (!this.t.closed) this.t.closed = new Uint8Array(oldW * oldH);
    const { t, grid, dx, dy } = growTerrain(this.t, this.s.seed, S, g, gx, gy);
    this.t = t;
    this.s.grid = grid;
    const move = (i: number) => (i % oldW + dx) + (Math.floor(i / oldW) + dy) * W;
    // trees and roads: the old ones where they were, the new map with its old forest
    const trees = new Uint8Array(W * H), roads = new Uint8Array(W * H);
    for (let i = 0; i < oldW * oldH; i++) { trees[move(i)] = this.trees[i]; roads[move(i)] = this.roads[i]; }
    this.treeKind = this.kindsOfTrees();
    const [ox, oy] = this.origin();
    const mx = (gx - grid.gx0) * S, my = (gy - grid.gy0) * S;
    for (let y = my; y < my + S; y++) for (let x = mx; x < mx + S; x++) {
      const i = idx(x, y);
      if (this.treeKind[i]) trees[i] = startStage(x + ox, y + oy);
    }
    this.trees = trees;
    this.roads = roads;
    this.treeChanges = [];
    this.roadChanges = [];
    // everybody and everything moves with its tiles
    if (dx || dy) {
      for (const p of this.s.people) { p.x += dx; p.y += dy; }
      for (const b of this.s.bands) {
        b.cx += dx; b.cy += dy;
        if (b.scout) { b.scout.x += dx; b.scout.y += dy; if (b.scout.px !== undefined) b.scout.px += dx; if (b.scout.py !== undefined) b.scout.py += dy; }
      }
    }
    for (const sh of this.s.fleet ?? []) {
      sh.x += dx; sh.y += dy;
      sh.dest = [sh.dest[0] + dx, sh.dest[1] + dy];
      sh.path = sh.path.map(move);
      sh.way = sh.way.map(move);
    }
    this.regions = this.landRegions();
    this.regionTiles = undefined;
    this.exploredDirty = true;
    this.grew = { dx: (this.grew?.dx ?? 0) + dx, dy: (this.grew?.dy ?? 0) + dy };
    return true;
  }

  /** dry land you can walk on: no sea, lake or river wide enough to be drawn as water */
  private walkable(i: number): boolean {
    return !isWater(this.t.biome[i]) && this.t.river[i] < RIVER_WATER;
  }

  /** every piece of land cut off by water gets its own number: without boats nobody leaves it */
  private landRegions(): Int32Array {
    const n = W * H, reg = new Int32Array(n).fill(-1);
    let id = 0;
    const stack: number[] = [];
    for (let s = 0; s < n; s++) {
      if (reg[s] >= 0 || !this.walkable(s)) continue;
      reg[s] = id;
      stack.push(s);
      while (stack.length) {
        const i = stack.pop()!;
        const x = i % W, y = (i - x) / W;
        if (x > 0 && reg[i - 1] < 0 && this.walkable(i - 1)) { reg[i - 1] = id; stack.push(i - 1); }
        if (x < W - 1 && reg[i + 1] < 0 && this.walkable(i + 1)) { reg[i + 1] = id; stack.push(i + 1); }
        if (y > 0 && reg[i - W] < 0 && this.walkable(i - W)) { reg[i - W] = id; stack.push(i - W); }
        if (y < H - 1 && reg[i + W] < 0 && this.walkable(i + W)) { reg[i + W] = id; stack.push(i + W); }
      }
      id++;
    }
    return reg;
  }

  /** can the band get to this tile? by land, or over water once it has boats */
  private reachable(b: Band, x: number, y: number): boolean {
    if (!inBounds(x, y)) return false;
    const i = idx(x, y);
    if (!this.walkable(i)) return false;
    if (this.hasTech(b, 'boats')) return true;
    const cx = Math.round(b.cx), cy = Math.round(b.cy);
    return inBounds(cx, cy) && this.regions[i] === this.regions[idx(cx, cy)];
  }

  // ---------- trees ----------

  private initTrees(saved?: string) {
    this.treeKind = this.kindsOfTrees();
    this.trees = new Uint8Array(W * H);
    if (saved) {
      const b = Buffer.from(saved, 'base64');
      for (let i = 0; i < this.trees.length; i++) this.trees[i] = this.treeKind[i] ? Math.min(BIG, b[i] ?? 0) : 0;
      return;
    }
    const [ox, oy] = this.origin();
    for (let i = 0; i < this.trees.length; i++) if (this.treeKind[i]) this.trees[i] = startStage(i % W + ox, Math.floor(i / W) + oy);
    // worlds from before v1.11: the land around each camp is already cleared
    for (const b of this.s?.bands ?? []) this.clearAround(b.cx, b.cy, b.settled ? 3 : 1);
  }

  private setTree(i: number, stage: number) {
    if (this.trees[i] === stage) return;
    this.trees[i] = stage;
    this.treeChanges.push(i, stage);
  }

  /** a camp (or village) stands here: the trees under it are cut */
  private clearAround(x: number, y: number, R: number) {
    const cx = Math.round(x), cy = Math.round(y);
    for (let yy = cy - R; yy <= cy + R; yy++) for (let xx = cx - R; xx <= cx + R; xx++) {
      if (inBounds(xx, yy) && (xx - cx) ** 2 + (yy - cy) ** 2 <= R * R + 1) this.setTree(idx(xx, yy), 0);
    }
  }

  /** trees of at least `min` size within R tiles */
  // ---------- roads ----------

  roadsB64(): string {
    return b64encode(this.roads);
  }

  private setRoad(i: number, lvl: number) {
    if ((this.roads[i] & 3) >= lvl) return;
    this.roads[i] = (this.roads[i] & 4) | lvl;
    this.roadChanges.push(i, this.roads[i]);
    if (this.trees[i]) this.setTree(i, 0);
  }

  private setRail(i: number) {
    if (this.roads[i] & 4) return;
    this.roads[i] |= 4;
    this.roadChanges.push(i, this.roads[i]);
    if (this.trees[i]) this.setTree(i, 0);
  }

  /** once a year towns that know the railway lay tracks to the nearest towns that know it too */
  private buildRails() {
    const towns = this.s.bands.filter((b) => b.settled && this.hasTech(b, 'railway'));
    if (towns.length < 2) return;
    const done = new Map<string, number>();
    for (const e of this.s.railPairs ?? []) {
      const [k, v] = e.split(':');
      done.set(k, Number(v ?? 1));
    }
    const alive = new Set(towns.map((b) => b.id));
    let built = 0;
    for (const a of this.rng.shuffle([...towns])) {
      if (built >= 6) break;
      const near = towns.filter((o) => o !== a && dist(a, o) < 60).sort((p, q) => dist(a, p) - dist(a, q)).slice(0, 2);
      for (const o of near) {
        const key = a.id < o.id ? `${a.id}-${o.id}` : `${o.id}-${a.id}`;
        if (done.has(key)) continue;
        const ia = idx(Math.round(a.cx), Math.round(a.cy)), io = idx(Math.round(o.cx), Math.round(o.cy));
        const path = findRoad(this.t, this.roads, ia, io, 20000, 4);
        done.set(key, path ? 1 : 9);
        built++;
        if (!path) continue;
        for (const i of path) this.setRail(i);
      }
    }
    this.s.railPairs = [...done].filter(([k]) => k.split('-').every((id) => alive.has(Number(id)))).map(([k, v]) => `${k}:${v}`);
  }

  // ---------- kingdoms (iron age) ----------

  private kingdomOf(b: Band): Kingdom | undefined {
    return b.kingdom == null ? undefined : this.s.kingdoms?.find((k) => k.id === b.kingdom);
  }

  kingdomView(b: Band): BandView['kingdom'] {
    const k = this.kingdomOf(b);
    if (!k) return null;
    const allies = Object.keys(k.allies ?? {}).map((id) => this.s.kingdoms?.find((o) => o.id === +id)?.place).filter((x): x is string => !!x);
    const kings = k.capital === b.id ? (k.kings ?? []).map((x) => ({ id: x.id, name: x.name, from: x.from, to: x.to ?? null })) : undefined;
    return { id: k.id, place: k.place, capital: k.capital === b.id, members: k.members.length, color: this.bandById.get(k.capital)?.color ?? b.color, founded: k.founded, allies, kings };
  }

  /** 'царство Бялово' in a sentence, 'Царство Бялово' at its start */
  private kBg(k: Kingdom, subject = false): string {
    return `${subject ? 'Царство' : 'царство'} ${k.place}`;
  }
  private kEn(k: Kingdom, subject = false): string {
    return `${subject ? 'The' : 'the'} Kingdom of ${villageEn(k.place)}`;
  }
  private kDe(k: Kingdom, c: 'nom' | 'akk' | 'dat' | 'gen', subject = false): string {
    const art = { nom: 'das', akk: 'das', dat: 'dem', gen: 'des' }[c];
    return `${subject ? art[0].toUpperCase() + art.slice(1) : art} Königreich${c === 'gen' ? 's' : ''} ${villageDe(k.place)}`;
  }

  /** once a year: towns that know the crown found kingdoms, kingdoms invite their neighbours, a lost capital moves */
  private kingdoms() {
    const ks = (this.s.kingdoms ??= []);
    for (const k of [...ks]) {
      k.members = k.members.filter((id) => this.bandById.get(id)?.settled);
      if (k.members.length === 0) {
        ks.splice(ks.indexOf(k), 1);
        for (const o of ks) if (o.allies) delete o.allies[k.id];
        this.emit('kingdom', 2, `${this.kBg(k, true)} се разпадна: в него не остана нито едно село.`, undefined, undefined, undefined, [],
          [`${this.kEn(k, true)} came to an end: not a single village was left in it.`],
          [`${this.kDe(k, 'nom', true)} ging zu Ende: Kein einziges Dorf ist ihm geblieben.`]);
        continue;
      }
      if (!k.members.includes(k.capital)) {
        const counts = new Map<number, number>();
        for (const p of this.s.people) counts.set(p.bandId, (counts.get(p.bandId) ?? 0) + 1);
        k.capital = [...k.members].sort((x, y) => (counts.get(y) ?? 0) - (counts.get(x) ?? 0))[0];
        const nc = this.bandById.get(k.capital)!;
        this.emit('kingdom', 1, `${this.bandLabel(nc, true)} е новата столица на ${this.kBg(k)}.`, undefined, undefined, nc.id, [],
          [`${this.bandEnLabel(nc, true)} is the new capital of ${this.kEn(k)}.`],
          [`${this.bDe(nc, 'nom', true)} ist jetzt die Hauptstadt ${this.kDe(k, 'gen')}.`]);
      }
    }
    for (const b of this.s.bands) {
      if (b.kingdom != null && !ks.some((k) => k.id === b.kingdom && k.members.includes(b.id))) b.kingdom = null;
    }
    const towns = this.s.bands.filter((b) => b.settled);
    const size = new Map<number, number>();
    for (const p of this.s.people) size.set(p.bandId, (size.get(p.bandId) ?? 0) + 1);
    // now and then a big walled town that knows the crown and has no king nearby founds a kingdom; the rest wait for an invitation
    for (const b of towns) {
      if (b.kingdom != null || !this.hasTech(b, 'kingdom') || !this.hasTech(b, 'walls')) continue;
      if ((size.get(b.id) ?? 0) < KINGDOM_FOUNDER || !this.rng.chance(0.06)) continue;
      if (ks.some((k) => dist(this.bandById.get(k.capital)!, b) < KINGDOM_REACH * 1.25)) continue;
      const k: Kingdom = { id: (this.s.nextKingdomId = (this.s.nextKingdomId ?? 0) + 1), place: b.settlementName ?? b.name, capital: b.id, members: [b.id], founded: Math.floor(this.year) };
      ks.push(k);
      b.kingdom = k.id;
      this.recordKing(k);
      const king = b.chiefId ? this.byId.get(b.chiefId) : undefined;
      if (king) king.deeds.push(`Стана първият цар на ${this.kBg(k)} (${formatYear(this.year)})`);
      this.emit('kingdom', 2, `${this.bandLabel(b, true)} стана столица на ${this.kBg(k)}.${king ? ` ${this.nameOf(king)} е първият му цар.` : ''}`,
        `${this.bandLabel(b, true)} вече е столица на цяло царство!`, king?.id, b.id, [],
        [`${this.bandEnLabel(b, true)} became the capital of ${this.kEn(k)}.${king ? ` ${this.nameEn(king)} is its first king.` : ''}`,
          `${this.bandEnLabel(b, true)} is now the capital of a whole kingdom!`],
        [`${this.bDe(b, 'nom', true)} wurde Hauptstadt ${this.kDe(k, 'gen')}.${king ? ` Erster König ist ${this.nameDe(king)}.` : ''}`,
          `${this.bDe(b, 'nom', true)} ist jetzt die Hauptstadt eines ganzen Königreichs!`]);
    }
    // the king invites the towns around: they come to a feast and stay
    for (const k of ks) {
      const cap = this.bandById.get(k.capital)!;
      for (const o of towns) {
        if (k.members.length >= KINGDOM_MAX) break;
        if (o.kingdom != null || dist(cap, o) >= KINGDOM_REACH || !this.rng.chance(0.02)) continue;
        this.joinKingdom(k, o);
      }
    }
    for (const k of ks) this.recordKing(k);
    this.royalWeddings(ks);
    this.unions(ks);
  }

  /** the chief of the capital is the king: a new one is written in the list of kings */
  private recordKing(k: Kingdom) {
    const cap = this.bandById.get(k.capital);
    const id = cap?.chiefId;
    const list = (k.kings ??= []);
    const last = list[list.length - 1];
    if (!id || last?.id === id) return;
    const p = this.byId.get(id);
    if (!p) return;
    const y = Math.floor(this.year);
    if (last && last.to == null) last.to = y;
    list.push({ id, name: this.nameOf(p), from: y });
    const all = (this.s.kingIds ??= []);
    if (!all.includes(id)) all.push(id);
  }

  /** the biggest number of people a settled town holds before some leave to found a new village */
  private townLimit(b: Band): number {
    if (b.isle) return 130;
    return Math.max(b.room ?? 0, this.techLimit(b));
  }

  private techLimit(b: Band): number {
    return this.hasTech(b, 'fusion') ? 1600 : this.hasTech(b, 'nuclear_power') ? 1200 : this.hasTech(b, 'electricity') ? 900 : this.hasTech(b, 'factory') ? 700 : this.hasTech(b, 'star_fort') ? 420 : this.hasTech(b, 'castle') ? 340
      : this.hasTech(b, 'aqueduct') ? 280 : this.hasTech(b, 'walls') ? 210 : 140;
  }

  /** once a year a big, well fed village with room to grow takes in a small clan from nearby: wanderers who have
   *  heard there is food there, or a tiny village next door that would rather live with the many */
  private gatherVillages() {
    const size = new Map<number, number>();
    for (const p of this.s.people) size.set(p.bandId, (size.get(p.bandId) ?? 0) + 1);
    const gone = new Set<number>();
    const villages = this.s.bands.filter((b) => b.settled && (size.get(b.id) ?? 0) >= 50 && (b.fed ?? 1) >= 1.1)
      .sort((a, b) => (size.get(b.id) ?? 0) - (size.get(a.id) ?? 0));
    for (const t of villages) {
      if (gone.has(t.id) || !this.rng.chance(0.08)) continue;
      const ts = size.get(t.id) ?? 0;
      const room = this.townLimit(t) * 0.75 - ts;
      if (room < 10) continue;
      const near = this.s.bands.filter((v) => {
        if (v === t || gone.has(v.id) || this.isCapital(v)) return false;
        const vs = size.get(v.id) ?? 0;
        if (vs === 0 || vs > room) return false;
        if (v.kingdom != null && t.kingdom != null && v.kingdom !== t.kingdom) return false;
        return v.settled ? vs <= 25 && ts >= vs * 3 && dist(v, t) <= 5 : vs <= 30 && dist(v, t) <= 8;
      });
      if (!near.length) continue;
      const v = this.rng.pick(near);
      for (const p of this.s.people) if (p.bandId === v.id) { p.bandId = t.id; p.task = 'travel'; }
      for (const tech of v.techs) this.addTech(t, tech);
      t.food += v.food;
      size.set(t.id, ts + (size.get(v.id) ?? 0));
      gone.add(v.id);
      this.emit('merge', 2, `${this.bandLabel(t, true)} прие при себе си ${this.bandLabel(v)}. Тук има храна и място за всички.`,
        `${this.bandLabel(t, true)} прие при себе си ${this.bandLabel(v)}. Там има много храна!`, undefined, t.id, this.bRefs(v),
        [`${this.bandEnLabel(v, true)} came to live in ${this.bandEnLabel(t)}. There is food and room for everyone there.`,
          `${this.bandEnLabel(v, true)} moved to ${this.bandEnLabel(t)}. There is lots of food there!`],
        [`${this.bDe(v, 'nom', true)} ließ sich ${this.bWith('in', t)} nieder. Dort gibt es Essen und Platz für alle.`,
          `${this.bDe(v, 'nom', true)} wohnt jetzt ${this.bWith('in', t)}. Dort gibt es viel zu essen!`]);
      this.removeBand(v, t);
    }
  }

  /** once a year a walled town swallows a small village right next to it: the village becomes a quarter of the town */
  private growTowns() {
    const size = new Map<number, number>();
    for (const p of this.s.people) size.set(p.bandId, (size.get(p.bandId) ?? 0) + 1);
    const towns = this.s.bands.filter((b) => b.settled && this.hasTech(b, 'walls') && (size.get(b.id) ?? 0) >= 150)
      .sort((a, b) => (size.get(b.id) ?? 0) - (size.get(a.id) ?? 0));
    const gone = new Set<number>();
    for (const t of towns) {
      if (gone.has(t.id)) continue;
      const ts = size.get(t.id) ?? 0;
      // the town reaches further out once it has roads for carts, and further still with trains
      const reach = this.hasTech(t, 'railway') ? 11 : this.hasTech(t, 'star_fort') ? 9 : 7;
      for (const v of this.s.bands) {
        if (v === t || gone.has(v.id) || !v.settled || dist(v, t) > reach) continue;
        const vs = size.get(v.id) ?? 0;
        if (vs * 2 > ts || ts + vs > this.townLimit(t) * 0.9) continue;
        if (v.kingdom != null && t.kingdom != null && v.kingdom !== t.kingdom) continue;
        if (this.isCapital(v) || !this.rng.chance(0.05)) continue;
        for (const p of this.s.people) if (p.bandId === v.id) { p.bandId = t.id; p.task = 'travel'; }
        for (const tech of v.techs) this.addTech(t, tech);
        t.food += v.food;
        size.set(t.id, ts + vs);
        gone.add(v.id);
        this.emit('merge', 2, `${this.bandLabel(t, true)} се разрасна до ${this.bandLabel(v)} и то вече е един от кварталите му.`,
          `${this.bandLabel(t, true)} порасна толкова, че стигна до ${this.bandLabel(v)}. Сега са един голям град!`, undefined, t.id, this.bRefs(v),
          [`${this.bandEnLabel(t, true)} grew out as far as ${this.bandEnLabel(v)}, and the village became one of the quarters of the town.`,
            `${this.bandEnLabel(t, true)} grew so big that it reached ${this.bandEnLabel(v)}. Now they are one big town!`],
          [`${this.bDe(t, 'nom', true)} wuchs bis ${`zu ${this.bDe(v, 'dat')}`.replace(/^zu dem /, 'zum ').replace(/^zu der /, 'zur ')} heran, und das Dorf wurde eines der Viertel der Stadt.`,
            `${this.bDe(t, 'nom', true)} ist so groß geworden, dass es ${this.bDe(v, 'akk')} erreicht hat. Jetzt sind sie eine große Stadt!`]);
        this.removeBand(v, t);
        break;
      }
    }
  }

  /** how far the wall of a village or town reaches from its fire, in tiles (the same rule the map draws it by) */
  wallReach(b: Band, size: number): number {
    if (!b.settled || this.s.planet === 'mars') return 0;
    const town = this.hasTech(b, 'mudbrick') && this.hasTech(b, 'walls');
    return town ? Math.max(2, Math.min(5, 2 + Math.floor(size / 150))) : 2;
  }

  /** once a year two villages or towns whose walls have grown into each other become one: the one with more people
   *  keeps its name, and the wall is built anew round both */
  private joinWalls() {
    const size = new Map<number, number>();
    for (const p of this.s.people) size.set(p.bandId, (size.get(p.bandId) ?? 0) + 1);
    const walled = this.s.bands.filter((b) => b.settled && (size.get(b.id) ?? 0) > 0)
      .sort((a, b) => (size.get(b.id) ?? 0) - (size.get(a.id) ?? 0));
    const gone = new Set<number>();
    for (const t of walled) {
      if (gone.has(t.id)) continue;
      for (const v of walled) {
        if (v === t || gone.has(v.id)) continue;
        const ts = size.get(t.id) ?? 0, vs = size.get(v.id) ?? 0;
        if (vs > ts) continue;
        // the walls touch: the two rings of tiles are next to each other; when they reach into each other
        // by two or three tiles the two places are one already, however many live there
        const gap = dist(v, t) - this.wallReach(t, ts) - this.wallReach(v, vs);
        if (gap > 1.5) continue;
        const overlap = gap <= -1;
        if (this.isCapital(v) || (v.kingdom != null && t.kingdom != null && v.kingdom !== t.kingdom)) continue;
        if (!overlap && ts + vs > this.townLimit(t) * 0.95) continue;
        if (overlap && ts + vs > this.townLimit(t)) t.room = Math.ceil((ts + vs) * 1.05);
        for (const p of this.s.people) if (p.bandId === v.id) { p.bandId = t.id; p.task = 'travel'; }
        for (const tech of v.techs) this.addTech(t, tech);
        t.food += v.food;
        size.set(t.id, ts + vs);
        gone.add(v.id);
        this.emit('merge', 2, `Стените на ${this.bandLabel(t)} и ${this.bandLabel(v)} се допряха и двете места станаха едно, което запази името на ${this.bandLabel(t)}.`,
          `${this.bandLabel(t, true)} и ${this.bandLabel(v)} пораснаха, докато стените им се допряха. Сега са едно място!`, undefined, t.id, this.bRefs(v),
          [`The walls of ${this.bandEnLabel(t)} and ${this.bandEnLabel(v)} grew until they touched, and the two became one place, keeping the name of ${this.bandEnLabel(t)}.`,
            `${this.bandEnLabel(t, true)} and ${this.bandEnLabel(v)} grew until their walls touched. Now they are one place!`],
          [`Die Mauern ${this.bDe(t, 'gen')} und ${this.bDe(v, 'gen')} wuchsen, bis sie sich berührten, und beide wurden ein Ort, der den Namen ${this.bDe(t, 'gen')} behält.`,
            `${this.bDe(t, 'nom', true)} und ${this.bDe(v, 'nom')} sind gewachsen, bis sich ihre Mauern berührten. Jetzt sind sie ein Ort!`]);
        this.removeBand(v, t);
      }
    }
  }

  /** king, queen (a king's wife), prince or princess (a king's child), for the family tree */
  private royalOf(id: number, motherId: number | null, fatherId: number | null, partnerId: number | null): TreeNode['royal'] {
    const kings = this.s.kingIds;
    if (!kings?.length) return undefined;
    if (kings.includes(id)) return 'king';
    if (partnerId && kings.includes(partnerId)) return 'queen';
    if ((fatherId && kings.includes(fatherId)) || (motherId && kings.includes(motherId))) return 'heir';
    return undefined;
  }

  /** the king's children and grandchildren */
  private royalBlood(cap: Band): Set<number> {
    const king = cap.chiefId ? this.byId.get(cap.chiefId) : undefined;
    const blood = new Set<number>(king?.children ?? []);
    for (const c of king?.children ?? []) for (const g of this.byId.get(c)?.children ?? []) blood.add(g);
    return blood;
  }

  /** children and grandchildren of the king who live in the capital and are free to marry */
  private heirs(k: Kingdom, sex: 0 | 1): Person[] {
    const cap = this.bandById.get(k.capital);
    if (!cap) return [];
    const blood = this.royalBlood(cap);
    const out: Person[] = [];
    for (const id of blood) {
      const p = this.byId.get(id);
      if (p && p.sex === sex && p.bandId === cap.id && !p.partnerId && this.ageOf(p) >= 16 && this.ageOf(p) <= 35) out.push(p);
    }
    return out;
  }

  /** now and then two neighbouring kings marry their children to each other, and the realms become allies */
  private royalWeddings(ks: Kingdom[]) {
    for (let i = 0; i < ks.length; i++) {
      for (let j = i + 1; j < ks.length; j++) {
        const a = ks[i], b = ks[j];
        if (a.allies?.[b.id] != null) continue;
        const ca = this.bandById.get(a.capital), cb = this.bandById.get(b.capital);
        if (!ca || !cb || dist(ca, cb) > ALLY_REACH || !this.rng.chance(0.1)) continue;
        // a prince of one house and a princess of the other; she moves to his court
        const pairs: [Kingdom, Person, Kingdom, Person][] = [];
        const pa = this.heirs(a, 0), qb = this.heirs(b, 1), pb = this.heirs(b, 0), qa = this.heirs(a, 1);
        if (pa.length && qb.length) pairs.push([a, this.rng.pick(pa), b, this.rng.pick(qb)]);
        if (pb.length && qa.length) pairs.push([b, this.rng.pick(pb), a, this.rng.pick(qa)]);
        if (!pairs.length) continue;
        const [hk, groom, wk, bride] = this.rng.pick(pairs);
        groom.partnerId = bride.id;
        bride.partnerId = groom.id;
        bride.bandId = hk.capital;
        bride.x = groom.x; bride.y = groom.y;
        (a.allies ??= {})[b.id] = Math.floor(this.year);
        (b.allies ??= {})[a.id] = Math.floor(this.year);
        const y = formatYear(this.year);
        groom.deeds.push(`Царска сватба с принцесата на ${this.kBg(wk)} (${y})`);
        bride.deeds.push(`Царска сватба с принца на ${this.kBg(hk)} (${y})`);
        const g = this.bandById.get(hk.capital)!;
        this.emit('wedding', 2, `Царска сватба: принц ${this.nameOf(groom)} от ${this.kBg(hk)} и принцеса ${this.nameOf(bride)} от ${this.kBg(wk)}. Двете царства вече са съюзници.`,
          `Голяма царска сватба! ${this.nameOf(groom)} и ${this.nameOf(bride)} се ожениха, а двете царства станаха приятели.`, groom.id, g.id, [this.pRef(bride)],
          [`A royal wedding: Prince ${this.nameEn(groom)} of ${this.kEn(hk)} and Princess ${this.nameEn(bride)} of ${this.kEn(wk)}. The two kingdoms are now allies.`,
            `A big royal wedding! ${this.nameEn(groom)} and ${this.nameEn(bride)} got married, and the two kingdoms became friends.`],
          [`Königliche Hochzeit: Prinz ${this.nameDe(groom)} aus ${this.kDe(hk, 'dat')} und Prinzessin ${this.nameDe(bride)} aus ${this.kDe(wk, 'dat')}. Die beiden Königreiche sind jetzt verbündet.`,
            `Eine große königliche Hochzeit! ${this.nameDe(groom)} und ${this.nameDe(bride)} haben geheiratet, und die beiden Königreiche sind jetzt Freunde.`]);
      }
    }
  }

  /** realms allied for a generation sometimes become one: the smaller joins the bigger, peacefully */
  private unions(ks: Kingdom[]) {
    for (const a of [...ks]) {
      for (const [bid, since] of Object.entries(a.allies ?? {})) {
        const b = ks.find((k) => k.id === +bid);
        if (!b || !ks.includes(a) || this.year - since < 25 || a.members.length < b.members.length) continue;
        if (a.members.length + b.members.length > UNION_MAX || !this.rng.chance(0.015)) continue;
        for (const id of b.members) {
          const t = this.bandById.get(id);
          if (!t) continue;
          t.kingdom = a.id;
          a.members.push(id);
        }
        ks.splice(ks.indexOf(b), 1);
        for (const o of ks) {
          if (!o.allies?.[b.id]) continue;
          if (o !== a) o.allies[a.id] ??= o.allies[b.id];
          delete o.allies[b.id];
        }
        if (a.allies) delete a.allies[a.id];
        for (const [oid, y] of Object.entries(b.allies ?? {})) if (+oid !== a.id) (a.allies ??= {})[+oid] ??= y;
        const cap = this.bandById.get(a.capital)!;
        this.emit('kingdom', 3, `${this.kBg(b, true)} се присъедини към ${this.kBg(a)}. Двата царски рода отдавна са сродени и вече са едно царство.`,
          `${this.kBg(b, true)} и ${this.kBg(a)} вече са едно голямо царство!`, undefined, cap.id, [],
          [`${this.kEn(b, true)} joined ${this.kEn(a)}. The two royal houses had long been related and are now one kingdom.`,
            `${this.kEn(b, true)} and ${this.kEn(a)} are now one big kingdom!`],
          [`${this.kDe(b, 'nom', true)} schloss sich ${this.kDe(a, 'dat')} an. Die beiden Königshäuser waren schon lange verwandt und sind jetzt ein Königreich.`,
            `${this.kDe(b, 'nom', true)} und ${this.kDe(a, 'nom')} sind jetzt ein großes Königreich!`]);
        break;
      }
    }
  }

  private joinKingdom(k: Kingdom, b: Band) {
    k.members.push(b.id);
    b.kingdom = k.id;
    this.addTech(b, 'kingdom');
    this.emit('kingdom', 1, `${this.bandLabel(b, true)} прие поканата и стана част от ${this.kBg(k)}.`, undefined, undefined, b.id, [],
      [`${this.bandEnLabel(b, true)} accepted the invitation and joined ${this.kEn(k)}.`],
      [`${this.bDe(b, 'nom', true)} nahm die Einladung an und schloss sich ${this.kDe(k, 'dat')} an.`]);
  }

  /** once a year villages with carts beat a road to their neighbours; towns with walls pave theirs */
  private buildRoads() {
    const towns = this.s.bands.filter((b) => b.settled);
    if (towns.length < 2) return;
    const pairs = new Map<string, number>();
    for (const e of this.s.roadPairs ?? []) {
      const [k, l] = e.split(':');
      pairs.set(k, Number(l));
    }
    const alive = new Set(towns.map((b) => b.id));
    let built = 0;
    for (const a of this.rng.shuffle([...towns])) {
      if (built >= 12) break;
      if (!this.hasTech(a, 'wheel')) continue;
      const near = towns.filter((o) => o !== a && dist(a, o) < 36).sort((p, q) => dist(a, p) - dist(a, q)).slice(0, 2);
      for (const o of near) {
        const key = a.id < o.id ? `${a.id}-${o.id}` : `${o.id}-${a.id}`;
        const lvl = this.hasTech(a, 'walls') && this.hasTech(o, 'walls') ? 2 : 1;
        if ((pairs.get(key) ?? 0) >= lvl) continue;
        const ia = idx(Math.round(a.cx), Math.round(a.cy)), io = idx(Math.round(o.cx), Math.round(o.cy));
        const path = findRoad(this.t, this.roads, ia, io);
        pairs.set(key, path ? lvl : 9); // 9: no way there, do not try again
        built++;
        if (!path) continue;
        for (const i of path) this.setRoad(i, lvl);
      }
    }
    // pairs of villages that are gone are forgotten (their roads stay)
    this.s.roadPairs = [...pairs].filter(([k]) => k.split('-').every((id) => alive.has(Number(id)))).map(([k, l]) => `${k}:${l}`);
  }

  treesNear(x: number, y: number, R: number, min: number): number {
    const cx = Math.round(x), cy = Math.round(y);
    let n = 0;
    for (let yy = cy - R; yy <= cy + R; yy++) for (let xx = cx - R; xx <= cx + R; xx++) {
      if (inBounds(xx, yy) && this.trees[idx(xx, yy)] >= min) n++;
    }
    return n;
  }

  /** every month the trees grow a little and new saplings come up where the forest can be */
  private growTrees() {
    // no new saplings inside the camps and the fields
    const blocked = new Set<number>();
    for (const b of this.s.bands) {
      const R = b.settled ? 3 : 1, cx = Math.round(b.cx), cy = Math.round(b.cy);
      for (let y = cy - R; y <= cy + R; y++) for (let x = cx - R; x <= cx + R; x++) if (inBounds(x, y)) blocked.add(idx(x, y));
    }
    // villages tend the woods around them (from the New Stone Age): saplings come up and grow three times as fast
    const tended = new Set<number>();
    for (const b of this.s.bands) {
      if (!b.settled) continue;
      const R = 10, cx = Math.round(b.cx), cy = Math.round(b.cy);
      for (let y = cy - R; y <= cy + R; y++) for (let x = cx - R; x <= cx + R; x++) if (inBounds(x, y)) tended.add(idx(x, y));
    }
    const grow = 1 / (12 * 6); // about 6 years for each stage
    const seed = 1 / (12 * 10); // a bare spot gets a sapling in about 10 years
    const kinds = this.treeKind, trees = this.trees;
    for (let i = 0; i < kinds.length; i++) {
      if (!kinds[i]) continue;
      const st = trees[i];
      const k = tended.has(i) ? 3 : 1;
      if (st === 0) {
        if (this.rng.next() < seed * k && !blocked.has(i) && !this.roads[i]) this.setTree(i, 1);
      } else if (st < BIG && this.rng.next() < grow * k) this.setTree(i, st + 1);
    }
  }

  /** the band cuts what it needs for fires, tools and shelters: the nearest trees go first */
  private chop(b: Band, members: Person[]) {
    const n = members.length;
    const m = this.month;
    const winter = m === 11 || m <= 1 ? 2 : m === 2 || m === 10 ? 1.4 : 1;
    const fire = this.hasTech(b, 'fire') ? 1.4 : 1;
    b.wood = (b.wood ?? 0) + (0.08 + n * 0.004) * winter * fire * (b.settled ? (this.hasTech(b, 'mudbrick') ? 0.9 : 1.3) : 1);
    const R = b.settled ? 7 : 4;
    const cx = Math.round(b.cx), cy = Math.round(b.cy);
    for (let guard = 0; b.wood >= 1 && guard < 6; guard++) {
      let best = -1, bestD = Infinity;
      for (let y = cy - R; y <= cy + R; y++) for (let x = cx - R; x <= cx + R; x++) {
        if (!inBounds(x, y)) continue;
        const i = idx(x, y);
        if (this.trees[i] < (b.settled ? 3 : 2)) continue; // saplings are left to grow; a village waits for grown trees
        const d = (x - cx) ** 2 + (y - cy) ** 2 + this.rng.next() * 6;
        if (d < bestD && d <= R * R + 6) { bestD = d; best = i; }
      }
      if (best < 0) { b.wood = Math.min(b.wood, 3); break; }
      b.wood -= this.trees[best] - 1;
      // a village cuts the way a coppice is cut: the stump sprouts again
      this.setTree(best, b.settled ? 1 : 0);
    }
    // a woodcutter is seen at work by the nearest tree (or carrying the log home)
    let near = -1, nd = Infinity;
    for (let y = cy - R; y <= cy + R; y++) for (let x = cx - R; x <= cx + R; x++) {
      if (!inBounds(x, y) || this.trees[idx(x, y)] < 2) continue;
      const d = (x - cx) ** 2 + (y - cy) ** 2;
      if (d < nd) { nd = d; near = idx(x, y); }
    }
    if (near < 0) return;
    const men = members.filter((p) => p.sex === 0 && (p.task === 'gather' || p.task === 'hunt') && p.id !== b.chiefId);
    if (!men.length) return;
    const p = men[b.id % men.length];
    p.task = 'chop';
    // stand at the side of the trunk, not inside it
    p.x = (near % W) + 0.45;
    p.y = Math.floor(near / W) + 0.2;
  }

  treesB64(): string {
    return b64encode(this.trees);
  }

  private reindex() {
    this.byId.clear();
    this.bandById.clear();
    this.techSets.clear();
    for (const p of this.s.people) this.byId.set(p.id, p);
    for (const b of this.s.bands) {
      this.bandById.set(b.id, b);
      this.techSets.set(b.id, new Set(b.techs));
    }
  }

  // ---------- creation ----------

  private genesis() {
    // start on a big piece of land, not on a strip between two rivers
    const size = new Map<number, number>();
    for (const r of this.regions) if (r >= 0) size.set(r, (size.get(r) ?? 0) + 1);
    let start = findStart(this.t, this.rng);
    for (let k = 0; k < 20; k++) {
      const s0 = this.nearestLand(start.x, start.y);
      if ((size.get(this.regions[idx(s0.x, s0.y)]) ?? 0) >= 1500) { start = s0; break; }
      start = findStart(this.t, this.rng);
    }
    const home = this.regions[idx(start.x, start.y)];
    const usedB = new Set<string>();
    const offsets = [[0, 0], [9, -5], [-7, 7]];
    for (const [ox, oy] of offsets) {
      const c = this.nearestLand(start.x + ox, start.y + oy, home);
      const band = this.newBand(c.x, c.y, usedB);
      for (let k = 0; k < 12; k++) {
        const age = k < 8 ? this.rng.int(16, 35) : this.rng.int(1, 12);
        this.newPerson(band, null, null, -age * 12 - this.rng.int(0, 11), this.rng.chance(0.5) ? 1 : 0);
      }
      // pair up the adults
      const adults = this.s.people.filter((p) => p.bandId === band.id && this.ageOf(p) >= 16);
      const men = adults.filter((p) => p.sex === 0), women = adults.filter((p) => p.sex === 1);
      for (let i = 0; i < Math.min(men.length, women.length); i++) {
        men[i].partnerId = women[i].id;
        women[i].partnerId = men[i].id;
      }
    }
    this.s.usedBands = [...usedB];
    for (const b of this.s.bands) this.clearAround(b.cx, b.cy, 1);
    this.explore();
    this.emit('genesis', 3,
      `Летописът започва. ${this.s.people.length} души в три рода бродят из ${'земите край голямата река'}. Не знаят огъня, нямат имена на местата. Имат само един друг.`,
      'Началото! Няколко семейства живеят сред дивата природа. Нямат огън, нито къщи. Да видим докъде ще стигнат.', undefined, undefined, [],
      [`The chronicle begins. ${this.s.people.length} people in three clans roam the lands by the great river. They do not know fire and have no names for places. They have only each other.`,
        'The beginning! A few families live in the wild. They have no fire and no houses. Let us see how far they get.'],
      [`Die Chronik beginnt. ${this.s.people.length} Menschen in drei Clans ziehen durch das Land am großen Fluss. Sie kennen das Feuer nicht und haben keine Namen für die Orte. Sie haben nur einander.`,
        'Der Anfang! Ein paar Familien leben in der Wildnis. Sie haben kein Feuer und keine Häuser. Mal sehen, wie weit sie kommen.']);
  }

  /** dry land a camp can stand on: not sea, lake or a river big enough to be drawn as water */
  private campable(i: number): boolean {
    return this.walkable(i);
  }

  /** camps saved on a river channel step onto the nearest bank */
  private dryCamps() {
    for (const b of this.s.bands) {
      const cx = Math.round(b.cx), cy = Math.round(b.cy);
      if (inBounds(cx, cy) && this.campable(idx(cx, cy))) continue;
      search: for (let r = 1; r < 12; r++) {
        for (let oy = -r; oy <= r; oy++) for (let ox = -r; ox <= r; ox++) {
          if (Math.max(Math.abs(ox), Math.abs(oy)) !== r) continue;
          const x = cx + ox, y = cy + oy;
          if (inBounds(x, y) && this.campable(idx(x, y))) { b.cx = x; b.cy = y; break search; }
        }
      }
    }
  }

  private nearestLand(x: number, y: number, region = -1): { x: number; y: number } {
    for (let r = 0; r < 30; r++) {
      for (let k = 0; k < 20; k++) {
        const nx = Math.round(x + this.rng.range(-r, r)), ny = Math.round(y + this.rng.range(-r, r));
        if (inBounds(nx, ny) && this.campable(idx(nx, ny)) && this.t.height[idx(nx, ny)] < 0.6 && (region < 0 || this.regions[idx(nx, ny)] === region)) return { x: nx, y: ny };
      }
    }
    return { x, y };
  }

  private newBand(x: number, y: number, used?: Set<string>, techs: string[] = []): Band {
    const set = used ?? new Set(this.s.usedBands);
    const b: Band = {
      id: this.s.nextBandId++,
      name: bandName(this.rng, set),
      color: bandColor(this.rng),
      cx: x, cy: y,
      settled: false,
      settlementName: null,
      techs: [...techs],
      food: 20,
      founded: this.s.tick,
      lastProd: 0, lastNeed: 0,
      met: [],
    };
    if (!used) this.s.usedBands = [...set];
    this.s.bands.push(b);
    this.bandById.set(b.id, b);
    this.techSets.set(b.id, new Set(techs));
    return b;
  }

  private randomGenes(): Record<GeneKey, number> {
    const g = {} as Record<GeneKey, number>;
    for (const k of GENE_KEYS) g[k] = Math.min(1, Math.max(0, 0.5 + this.rng.gauss() * 0.15));
    return g;
  }

  private newPerson(band: Band, mother: Person | null, father: Person | null, bornTick: number, sex: 0 | 1): Person {
    let genes: Record<GeneKey, number>;
    if (mother && father) {
      genes = {} as Record<GeneKey, number>;
      for (const k of GENE_KEYS) {
        const v = (mother.genes[k] + father.genes[k]) / 2 + this.rng.gauss() * 0.06;
        genes[k] = Math.min(1, Math.max(0, v));
      }
    } else genes = this.randomGenes();
    const top = topGene(genes);
    const names = sex === 1 ? FEMALE : MALE;
    // early names come from the older part of the list
    const pool = this.s.era < 2 ? names.slice(0, 40) : names;
    let first = this.rng.pick(pool);
    const fatherFirst = father ? (father.fame ? father.first.replace(/^(Цар|Хан|Свети|Кралица|Патриарх) /, '').split(' ')[0] : father.first) : '';
    if (father && this.rng.chance(0.15)) first = sex === 0 ? fatherFirst : first; // named after the father
    const hasFamilies = this.s.era >= 1 && father;
    const p: Person = {
      id: this.s.nextPersonId++,
      first,
      nick: hasFamilies ? null : nickname(this.rng, sex === 1, top),
      family: hasFamilies ? familyFrom(fatherFirst, sex === 1) : null,
      sex,
      born: bornTick,
      motherId: mother?.id ?? null,
      fatherId: father?.id ?? null,
      partnerId: null,
      bandId: band.id,
      genes,
      x: band.cx + this.rng.range(-1, 1),
      y: band.cy + this.rng.range(-1, 1),
      task: 'child',
      children: [],
      deeds: [],
      gen: Math.max(mother?.gen ?? 0, father?.gen ?? 0) + 1,
      lastBirth: -999,
    };
    this.s.people.push(p);
    this.byId.set(p.id, p);
    this.s.totalBorn++;
    return p;
  }

  // ---------- helpers ----------

  ageOf(p: Person): number {
    return (this.s.tick - p.born) / 12;
  }

  nameOf(p: Person): string {
    if (p.family) return `${p.first} ${p.family}`;
    return p.nick ? `${p.first} ${p.nick}` : p.first;
  }

  /** 'рода на Орела' inside a sentence, 'Родът на Орела' as its subject */
  bandLabel(b: Band, subject = false): string {
    if (b.settlementName) return `${subject ? 'Селото' : 'селото'} ${b.settlementName}`;
    return subject ? b.name : b.name.replace(/^Родът/, 'рода');
  }

  /** the same in English */
  nameEn(p: Person): string {
    return personEn(this.nameOf(p));
  }

  bandEnLabel(b: Band, subject = false): string {
    return bandLabelEn(b.name, b.settlementName, subject);
  }

  /** German: the person (always in the nominative) and the band in a case */
  nameDe(p: Person): string {
    return personDe(this.nameOf(p));
  }
  bDe(b: Band, c: 'nom' | 'akk' | 'dat' | 'gen', capital = false): string {
    return bandLabelDe(b.name, b.settlementName, c, capital);
  }
  /** "aus dem Clan X", "im Dorf X", "vom Clan X", "beim Clan X" */
  bWith(prep: 'aus' | 'in' | 'von' | 'bei', b: Band, capital = false): string {
    return bandWithDe(prep, b.name, b.settlementName, capital);
  }

  techName(id: string, en = false): string {
    return en ? TECH_EN[id]?.name ?? id : TECH_BY_ID.get(id)?.name ?? id;
  }

  hasTech(b: Band, id: string): boolean {
    return this.techSets.get(b.id)!.has(id);
  }

  private addTech(b: Band, id: string) {
    const set = this.techSets.get(b.id)!;
    if (set.has(id)) return;
    set.add(id);
    b.techs.push(id);
  }

  get year(): number {
    return yearOf(this.s.tick);
  }

  get month(): number {
    return ((this.s.tick % 12) + 12) % 12;
  }

  private emit(kind: string, importance: number, text: string, kids?: string, personId?: number, bandId?: number, extra: ChronicleRef[] = [],
    en?: [string, string?], de?: [string, string?]) {
    // every name in the text that has more to show becomes a link
    const cand: ChronicleRef[] = [...extra];
    const p = personId ? this.byId.get(personId) : undefined;
    if (p) cand.push(this.pRef(p));
    const b = bandId ? this.bandById.get(bandId) : undefined;
    if (b) cand.push(...this.bRefs(b));
    const refs: ChronicleRef[] = [];
    for (const r of cand) {
      if (!r.n || refs.some((x) => x.n === r.n)) continue;
      if (text.includes(r.n) || kids?.includes(r.n)) refs.push(r);
    }
    this.events.push({
      id: this.s.nextEventId++,
      tick: this.s.tick,
      year: this.year,
      kind, importance, text, kids, personId, bandId,
      refs: refs.length ? refs : undefined,
      en: en ? { text: en[0], kids: en[1] } : undefined,
      de: de ? { text: de[0], kids: de[1] } : undefined,
    });
  }

  private pRef(p: Person): ChronicleRef {
    return { n: this.nameOf(p), p: p.id };
  }

  /** all the ways a band is written in the chronicle */
  private bRefs(b: Band): ChronicleRef[] {
    const out: ChronicleRef[] = [{ n: b.name, b: b.id }, { n: b.name.replace(/^Родът/, 'рода'), b: b.id }];
    if (b.settlementName) out.push({ n: b.settlementName, b: b.id });
    return out;
  }

  /** chance multiplier from the invisible director that keeps the story close to the ~3 month schedule */
  directorFactor(): number {
    const era = this.s.era;
    const next = ERAS[era + 1];
    if (!next) return 1;
    const cur = ERAS[era];
    const span = next.startYear - cur.startYear;
    const f = (this.year - cur.startYear) / span; // 0..1 expected to reach next era at 1
    if (f < 0.5) return 0.4;
    if (f < 1) return 0.4 + (f - 0.5) * 2;
    return Math.min(6, 1.6 + (f - 1) * 4);
  }

  tickMs(speed: number): number {
    const ypm = ERAS[Math.min(this.s.era, ERAS.length - 1)].yearsPerMin;
    return 60000 / (12 * ypm) / speed;
  }

  timeInfo(speed: number): TimeInfo {
    return {
      tick: this.s.tick,
      year: Math.floor(this.year),
      month: this.month,
      era: this.s.era,
      eraName: ERAS[this.s.era].name,
      tickMs: Math.round(this.tickMs(speed)),
      startedAt: this.s.startedAt,
    };
  }

  // ---------- the monthly step ----------

  step() {
    this.s.tick++;
    const members = new Map<number, Person[]>();
    for (const b of this.s.bands) members.set(b.id, []);
    for (const p of this.s.people) members.get(p.bandId)?.push(p);

    this.regrow();
    this.growTrees();
    if (this.month === 0) this.culturesYearly(members);
    for (const b of this.s.bands) {
      const m = members.get(b.id)!;
      if (m.length === 0) continue;
      this.work(b, m);
      this.chop(b, m);
      this.discover(b, m);
    }
    this.lifeAndDeath(members);
    if (!this.mars) this.famousBirths(members);
    if (this.month === 3) this.pairing(members);
    this.bandDynamics(members);
    this.contact();
    if (this.month === 6) { this.buildRoads(); this.buildRails(); }
    if (this.month === 7) this.kingdoms();
    if (this.month === 8) { this.growTowns(); this.gatherVillages(); this.joinWalls(); }
    if (this.s.tick % 6 === 0) this.explore();
    if (this.mars) this.marsEvents(); else { this.randomEvents(members); this.disasters(members); }
    if (this.month === 4) this.voyages(members);
    if (!this.mars) { this.sail(); if (this.month === 5) this.setSail(members); }
    this.checkEra();
    this.milestones();
    this.fixStrays();
    this.s.rng = this.rng.s;
  }

  /** a baby born the month its band merged or died out could be left with no band: it goes to its mother's, or the nearest */
  private fixStrays() {
    for (const p of this.s.people) {
      if (this.bandById.has(p.bandId)) continue;
      const mother = p.motherId ? this.byId.get(p.motherId) : undefined;
      let to = mother ? this.bandById.get(mother.bandId) : undefined;
      if (!to) {
        let best = Infinity;
        for (const b of this.s.bands) {
          const d = Math.hypot(b.cx - p.x, b.cy - p.y);
          if (d < best) { best = d; to = b; }
        }
      }
      if (to) p.bandId = to.id;
    }
  }

  private regrow() {
    const t = this.t;
    const m = this.month;
    const growing = m >= 2 && m <= 9;
    const pr = growing ? 0.1 : 0.02;
    for (let i = 0; i < t.plants.length; i++) {
      const cap = t.plantsCap[i];
      if (cap <= 0) continue;
      if (t.plants[i] < cap) t.plants[i] += (cap - t.plants[i]) * pr;
      const gc = t.gameCap[i];
      if (t.game[i] < gc) t.game[i] += (gc - t.game[i]) * 0.035 + 0.002;
    }
  }

  private seasonFactor(b: Band): number {
    const temp = this.t.temp[idx(Math.round(b.cx), Math.round(b.cy))];
    const m = this.month;
    const winter = m === 11 || m <= 1 ? 1 : m === 2 || m === 10 ? 0.5 : 0;
    // cold lands suffer more from winter
    return 1 - winter * (0.75 - temp * 0.5);
  }

  /** the culture of a clan, a new one for a clan that has none (the first clans, settlers, old worlds) */
  private cultureOf(b: Band, pop: number): number {
    const st = this.culs().st;
    if (b.culture === undefined || !st.cultures[b.culture]) b.culture = newCulture(st, b.name, this.s.tick, pop).id;
    return b.culture;
  }

  /** what the clan feels this month, through its culture's network: how much to lean towards every job */
  private cultureLean(b: Band, m: Person[], canFish: boolean, farms: boolean): number[] {
    const c = this.cultureOf(b, m.length);
    const a = (this.month / 12) * Math.PI * 2;
    const cx = Math.round(b.cx), cy = Math.round(b.cy);
    let game = 0, cap = 0;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      if (!inBounds(cx + dx, cy + dy)) continue;
      const i = idx(cx + dx, cy + dy);
      game += this.t.game[i]; cap += this.t.gameCap[i];
    }
    let crowd = 0;
    for (const o of this.s.bands) if (o !== b && Math.abs(o.cx - b.cx) < 10 && Math.abs(o.cy - b.cy) < 10) crowd++;
    const need = Math.max(1, b.lastNeed || m.length);
    const x = [
      Math.sin(a), Math.cos(a),
      Math.max(-1, Math.min(1, 1 - (b.fed ?? 1))),
      Math.tanh(b.food / need / 6),
      cap > 0 ? game / cap * 2 - 1 : -1,
      canFish ? 1 : -1,
      farms ? 1 : -1,
      1 - this.t.temp[idx(cx, cy)] * 2,
      Math.tanh(m.length / 60) * 2 - 1,
      b.settled ? 1 : -1,
      Math.tanh(crowd / 4) * 2 - 1,
      Math.max(-1, Math.min(1, (this.culs().st.cultures[c]?.last ?? 0) * 20)),
      ...(b.mem ?? new Array(MEM).fill(0)),
    ];
    const avail = [farms, this.hasTech(b, 'herding'), canFish, this.hasTech(b, 'stone_tools'), b.settled && this.hasTech(b, 'mudbrick'), true];
    const r = this.culs().lean(c, x, avail);
    b.mem = r.mem.map((v) => Math.round(v * 1000) / 1000);
    return r.lean;
  }

  /** once a year (January): the cultures learn, copy a better neighbour, split; the chronicle tells the new ways of life */
  private culturesYearly(members: Map<number, Person[]>) {
    const cu = this.culs();
    const pops = new Map<number, number>(), bandPop = new Map<number, number>();
    for (const b of this.s.bands) {
      const n = members.get(b.id)?.length ?? 0;
      bandPop.set(b.id, n);
      const c = this.cultureOf(b, n);
      pops.set(c, (pops.get(c) ?? 0) + n);
    }
    const near = new Map<number, Set<number>>();
    for (const b of this.s.bands) for (const o of this.s.bands) {
      if (b.culture === o.culture || Math.hypot(b.cx - o.cx, b.cy - o.cy) > 14) continue;
      (near.get(b.culture!) ?? near.set(b.culture!, new Set()).get(b.culture!)!).add(o.culture!);
    }
    const biggest = (cid: number) => {
      let best: Band | null = null;
      for (const b of this.s.bands) if (b.culture === cid && (!best || (bandPop.get(b.id) ?? 0) > (bandPop.get(best.id) ?? 0))) best = b;
      return best;
    };
    const { styled, taught } = cu.yearly(this.s.tick, pops, near);
    const year = Math.floor(this.year);
    for (const { c, style } of styled) {
      const b = biggest(c.id);
      if (!b || (pops.get(c.id) ?? 0) < 80 || (c.styleYear && year - c.styleYear < 60)) continue;
      c.styleYear = year;
      const st = STYLE[style as Job];
      this.emit('culture', 2, `${this.bandLabel(b, true)} и сродните му родове заживяха по нов начин: ${st[0]}.`, undefined, undefined, b.id, [],
        [`${this.bandEnLabel(b, true)} and its kindred clans took up a new way of life: ${st[1]}.`],
        [`${this.bDe(b, 'nom', true)} und die verwandten Clans leben jetzt vor allem ${st[2]}.`]);
    }
    for (const { c, from } of taught) {
      const b = biggest(c.id), t = biggest(from.id);
      if (!b || !t || (c.styleYear && year - c.styleYear < 60) || !this.rng.chance(0.1)) continue;
      c.styleYear = year;
      const st = STYLE[from.style as Job];
      this.emit('culture', 1, `${this.bandLabel(b, true)} се поучи от ${this.bandLabel(t)}: ${st[0]}.`, undefined, undefined, b.id, this.bRefs(t),
        [`${this.bandEnLabel(b, true)} learned from ${this.bandEnLabel(t)}: ${st[1]}.`],
        [`${this.bDe(b, 'nom', true)} lernte ${this.bWith('von', t)}: jetzt vor allem ${st[2]}.`]);
    }
    cu.split(this.s.tick, this.s.bands, bandPop, (id) => this.bandById.get(id)?.name ?? '');
  }

  /** the ways of life, for the chronicle: [bg, en, de] */
  cultureStyle(b: Band): Job | 'mixed' | undefined {
    return b.culture !== undefined ? this.culs().st.cultures[b.culture]?.style : undefined;
  }

  private work(b: Band, m: Person[]) {
    const t = this.t;
    const tool = this.hasTech(b, 'iron') ? 1.65 : this.hasTech(b, 'bronze') ? 1.5 : this.hasTech(b, 'copper') ? 1.35 : this.hasTech(b, 'stone_tools') ? 1.25 : 1;
    const fire = this.hasTech(b, 'fire') ? 1.1 : 1;
    // carts bring food from farther away
    const R = b.settled ? (this.hasTech(b, 'wheel') ? 5 : 4) : 6;
    const season = this.seasonFactor(b);
    const workers: Person[] = [];
    let need = 0;
    const chief = this.ensureChief(b, m);
    for (const p of m) {
      const a = this.ageOf(p);
      need += a < 12 ? 0.6 : a > 60 ? 0.8 : 1;
      if (a < 12) p.task = 'child';
      else if (a > 58) p.task = 'elder';
      else workers.push(p);
    }

    // choose jobs
    const canFish = this.hasTech(b, 'fishing') && this.areaHas(b, R, 'fish');
    const farms = this.hasTech(b, 'agriculture') && b.settled;
    const herds = this.hasTech(b, 'herding');
    // job weights: most people find food, a few make tools or build
    const jobs: [Task, number][] = [];
    if (farms) jobs.push(['farm', 5]);
    if (herds) jobs.push(['herd', 1.5]);
    if (canFish) jobs.push(['fish', 1.5]);
    if (this.hasTech(b, 'stone_tools')) jobs.push(['craft', 0.6]);
    if (b.settled && this.hasTech(b, 'mudbrick')) jobs.push(['build', 0.5]);
    jobs.push(['forage', farms ? 2 : 6] as unknown as [Task, number]);
    // the culture's network leans the work towards what has worked for its clans
    // (not while the world is only a few small clans: one bad try could end it)
    const lean = this.s.people.length >= 200 ? this.cultureLean(b, m, canFish, farms) : [];
    for (const j of jobs) j[1] *= lean[JOBS.indexOf(j[0] as Job)] ?? 1;
    // whatever it learns, at most a fifth of the clan makes things instead of food
    const sum = jobs.reduce((a, j) => a + j[1], 0), notFood = jobs.filter((j) => j[0] === 'craft' || j[0] === 'build').reduce((a, j) => a + j[1], 0);
    if (notFood > sum * 0.2) for (const j of jobs) if (j[0] === 'craft' || j[0] === 'build') j[1] *= (sum - notFood) * 0.25 / notFood;
    const total = jobs.reduce((s2, j) => s2 + j[1], 0);
    for (const p of workers) {
      let r = this.rng.next() * total;
      let job: string = 'forage';
      for (const [j, w] of jobs) { if (r < w) { job = j; break; } r -= w; }
      if (job === 'forage') job = (p.genes.str + this.rng.next() * 0.6) > (p.sex === 0 ? 0.7 : 0.95) ? 'hunt' : 'gather';
      p.task = job as Task;
    }
    let prod = 0;
    let gatherWant = 0, huntWant = 0, farmWant = 0;
    const craftBonus = 1 + Math.min(0.25, workers.filter((p) => p.task === 'craft').length * 0.04);
    for (const p of workers) {
      const skill = 0.8 + Math.min(0.4, (this.ageOf(p) - 12) * 0.015) + (p.genes.str - 0.5) * 0.3;
      let got = 0;
      const tx = Math.round(b.cx + this.rng.range(-R, R));
      const ty = Math.round(b.cy + this.rng.range(-R, R));
      const tile = this.reachable(b, tx, ty) ? idx(tx, ty) : idx(Math.round(b.cx), Math.round(b.cy));
      switch (p.task) {
        case 'gather': {
          gatherWant += 2.0 * skill * tool * season;
          break;
        }
        case 'hunt': {
          let mult = 2.0 * skill * tool;
          if (this.hasTech(b, 'spear')) mult *= 1.3;
          if (this.hasTech(b, 'bow')) mult *= 1.25;
          if (this.hasTech(b, 'dog')) mult *= 1.15;
          if (this.hasTech(b, 'horse')) mult *= 1.15;
          huntWant += mult * (0.6 + season * 0.4);
          if (!p.fame && this.rng.chance(this.hasTech(b, 'spear') ? 0.0002 : 0.0004)) this.die(p, 'загина на лов', m);
          break;
        }
        case 'fish': got = 1.4 * skill * (this.hasTech(b, 'boats') ? 1.3 : 1) * (this.hasTech(b, 'sailing') ? 1.25 : 1) * (this.hasTech(b, 'harbor') ? 1.15 : 1) * (0.7 + season * 0.3); break;
        case 'farm': {
          farmWant += 2.4 * this.farmSeason() * skill * tool * (this.hasTech(b, 'plough') ? 1.35 : 1) * (this.hasTech(b, 'calendar') ? 1.1 : 1) * (this.hasTech(b, 'watermill') ? 1.12 : 1) * (this.hasTech(b, 'heavy_plough') ? 1.15 : 1) * (this.hasTech(b, 'windmill') ? 1.1 : 1) * (this.hasTech(b, 'potato') ? 1.15 : 1) * (this.hasTech(b, 'fertilizer') ? 1.2 : 1) * (this.hasTech(b, 'green_revolution') ? 1.25 : 1) * (this.hasTech(b, 'vertical_farm') ? 1.2 : 1);
          break;
        }
        case 'herd': got = 1.7 * skill; break;
        case 'craft': got = 0.4; break;
        case 'build': got = 0.3; break;
      }
      prod += got * craftBonus * fire;
      // where they are seen on the map
      this.placeWorker(p, b, tile);
    }
    for (const p of m) if (p.task === 'child' || p.task === 'elder' || p.task === 'craft' || p.task === 'build') {
      // the old ones never go further than one tile from the hearth: they mind the children and tell stories
      const r = p.task === 'elder' ? 1 : 1.2;
      const x = b.cx + this.rng.range(-r, r), y = b.cy + this.rng.range(-r, r);
      // stay on dry land by the hearth
      const ok = this.reachable(b, Math.round(x), Math.round(y));
      p.x = ok ? x : b.cx + this.rng.range(-0.3, 0.3);
      p.y = ok ? y : b.cy + this.rng.range(-0.3, 0.3);
    }
    // the chief still brings food like everyone else, but he is seen by the camp (or out scouting)
    if (chief) this.lead(b, chief, m);
    prod += (this.harvest(t.plants, b, R, gatherWant, 0.07) + this.harvest(t.game, b, R + 2, huntWant, 0.045)) * craftBonus * fire;
    // the plough turns more land into fields, the calendar sows it at the right time
    const land = (this.hasTech(b, 'plough') ? 1.4 : 1) * (this.hasTech(b, 'calendar') ? 1.1 : 1) * (this.hasTech(b, 'three_field') ? 1.15 : 1) * (this.hasTech(b, 'potato') ? 1.1 : 1);
    if (farmWant > 0) prod += Math.min(farmWant, this.arable(b) * land * this.farmSeason()) * craftBonus;
    const spoil = this.hasTech(b, 'pottery') ? 0.05 : this.hasTech(b, 'grinding') ? 0.08 : 0.12;
    // on Mars the food grows under the domes, in the greenhouses and vertical farms
    // each dome feeds a few hundred people; a fuller one goes short and some families move on to build a new dome
    if (this.mars) prod = need * Math.max(0.75, Math.min(1.3, (1.3 * 450) / Math.max(1, m.length)));
    b.food = Math.max(0, b.food * (1 - spoil) + prod - need);
    // how well fed the band has been lately (smoothed over about a year)
    const cover = need > 0 ? Math.min(2, (prod + Math.min(b.food, need * 2)) / need) : 1;
    b.fed = (b.fed ?? 1.2) * 0.75 + cover * 0.25;
    b.lastProd = prod;
    b.lastNeed = need;
  }

  private farmSeason(): number {
    const m = this.month;
    return m >= 6 && m <= 8 ? 1.8 : m >= 3 && m <= 9 ? 0.9 : 0.4;
  }

  /** fields the village can plough: fertile land close to home */
  private arable(b: Band): number {
    const cx = Math.round(b.cx), cy = Math.round(b.cy);
    let n = 0;
    for (let y = cy - 4; y <= cy + 4; y++) for (let x = cx - 4; x <= cx + 4; x++) {
      if (!inBounds(x, y)) continue;
      const bi = this.t.biome[idx(x, y)];
      if (bi === Biome.Grassland || bi === Biome.Plains) n += 1;
      else if (bi === Biome.Forest || bi === Biome.Marsh || bi === Biome.Hills) n += 0.4;
    }
    return n;
  }

  private placeWorker(p: Person, b: Band, tile: number) {
    let x = tile % W, y = Math.floor(tile / W);
    if (p.task === 'fish') {
      // walk to a bank of a river or a lake (not out into the fields where a stream only feeds the fish)
      const wetAt = (j: number) => j >= 0 && j < W * H && !this.walkable(j);
      const near = this.findNear(b, 8, (i) => this.walkable(i) && (wetAt(i + 1) || wetAt(i - 1) || wetAt(i + W) || wetAt(i - W)));
      if (near >= 0) {
        x = near % W; y = Math.floor(near / W);
        // at the very edge, facing the water
        const [ex, ey] = wetAt(near + 1) ? [1, 0] : wetAt(near - 1) ? [-1, 0] : wetAt(near + W) ? [0, 1] : [0, -1];
        p.x = x + ex * 0.3 + this.rng.range(-0.15, 0.15);
        p.y = y + ey * 0.3 + this.rng.range(-0.15, 0.15);
        return;
      }
      // no bank close by: fish from home, where the trap is
      x = Math.round(b.cx); y = Math.round(b.cy);
    } else if (p.task === 'farm' || p.task === 'herd') {
      const fx = Math.round(b.cx + this.rng.range(-3, 3)), fy = Math.round(b.cy + this.rng.range(-3, 3));
      if (this.reachable(b, fx, fy)) { x = fx; y = fy; }
    }
    p.x = x + this.rng.range(-0.4, 0.4);
    p.y = y + this.rng.range(-0.4, 0.4);
  }

  private findNear(b: Band, R: number, pred: (i: number) => boolean): number {
    for (let k = 0; k < 25; k++) {
      const x = Math.round(b.cx + this.rng.range(-R, R)), y = Math.round(b.cy + this.rng.range(-R, R));
      if (!inBounds(x, y)) continue;
      const i = idx(x, y);
      if (pred(i) && this.reachable(b, x, y)) return i;
    }
    return -1;
  }

  /** take up to `want` from the area around the camp, never more than `maxFrac` of what grows there */
  private harvest(res: Float32Array, b: Band, R: number, want: number, maxFrac: number): number {
    if (want <= 0) return 0;
    const cx = Math.round(b.cx), cy = Math.round(b.cy);
    let avail = 0;
    for (let y = cy - R; y <= cy + R; y++) for (let x = cx - R; x <= cx + R; x++) {
      if (!inBounds(x, y) || (x - cx) ** 2 + (y - cy) ** 2 > R * R) continue;
      avail += res[idx(x, y)];
    }
    const got = Math.min(want, avail * maxFrac);
    if (avail <= 0) return 0;
    const keep = 1 - got / avail;
    for (let y = cy - R; y <= cy + R; y++) for (let x = cx - R; x <= cx + R; x++) {
      if (!inBounds(x, y) || (x - cx) ** 2 + (y - cy) ** 2 > R * R) continue;
      res[idx(x, y)] *= keep;
    }
    return got;
  }

  private areaHas(b: Band, R: number, need: string): boolean {
    const t = this.t;
    const cx = Math.round(b.cx), cy = Math.round(b.cy);
    for (let y = cy - R; y <= cy + R; y++) for (let x = cx - R; x <= cx + R; x++) {
      if (!inBounds(x, y)) continue;
      const i = idx(x, y);
      switch (need) {
        case 'flint': if (t.flint[i]) return true; break;
        case 'clay': if (t.clay[i]) return true; break;
        case 'grain': if (t.grain[i]) return true; break;
        case 'wildHerd': if (t.wildHerd[i]) return true; break;
        case 'fish': if (t.fish[i] > 0) return true; break;
        case 'forest': if (t.biome[i] === Biome.Forest || t.biome[i] === Biome.Taiga) return true; break;
        // copper and tin show in the rocks of hills and mountains
        case 'ore': if (t.biome[i] === Biome.Hills || t.biome[i] === Biome.Mountain) return true; break;
      }
    }
    return false;
  }

  private discover(b: Band, m: Person[]) {
    const known = this.techSets.get(b.id)!;
    const candidates: Tech[] = [];
    const worldEra = Math.max(this.s.era, eraOf(known));
    for (const tech of TECHS) {
      if (known.has(tech.id)) continue;
      if (!techOpen(tech, worldEra)) continue;
      if (!tech.prereq.every((r) => known.has(r))) continue;
      if (tech.need && !this.areaHas(b, b.settled ? 5 : 7, tech.need)) continue;
      candidates.push(tech);
    }
    if (!candidates.length) return;
    const adults = m.filter((p) => this.ageOf(p) >= 12);
    if (!adults.length) return;
    const crowd = Math.sqrt(adults.length / 8);
    for (const tech of candidates) {
      // the person who might have the idea this month: a famous one makes their own discovery
      const star = this.year >= tech.target - 5 ? adults.find((q) => q.fame && FAMOUS[q.fame - 1].tech === tech.id && this.ageOf(q) >= 18) : undefined;
      const p = star ?? this.rng.pick(adults);
      const g = p.genes[tech.gene] * 0.5 + p.genes.int * 0.25 + p.genes.cur * 0.25;
      // already known somewhere else: rediscovery is easier
      const seen = this.s.discovered.includes(tech.id);
      const again = seen ? 1.6 : 1;
      // a first discovery happens somewhere in the world: many bands do not make it come sooner
      const world = seen ? 1 : Math.min(1, 4 / this.s.bands.length);
      const written = (this.hasTech(b, 'alphabet') ? 1.3 : this.hasTech(b, 'writing') ? 1.15 : 1) * (this.hasTech(b, 'library') ? 1.2 : 1)
        * (this.hasTech(b, 'monastery') ? 1.15 : 1) * (this.hasTech(b, 'university') ? 1.2 : 1) * (this.hasTech(b, 'academy') ? 1.2 : 1) * (this.hasTech(b, 'school') ? 1.2 : 1) * (this.hasTech(b, 'computer') ? 1.2 : 1) * (this.hasTech(b, 'ai') ? 1.25 : 1);
      const chance = star ? 0.08 * Math.max(1, this.techPace(tech))
        : written * world * GLOBAL_DISCOVERY * Math.sqrt(tech.base / 0.0025) * this.techPace(tech) * again * crowd * Math.pow(g * 2, 2);
      if (!this.rng.chance(chance)) continue;
      this.addTech(b, tech.id);
      const first = !this.s.discovered.includes(tech.id);
      const name = this.nameOf(p);
      const fill = (s: string) => s.replace('{name}', name).replace('{band}', this.bandLabel(b)).replace('{Band}', this.bandLabel(b, true));
      const nameE = this.nameEn(p);
      const fillEn = (s: string) => s.replace('{name}', nameE).replace('{band}', this.bandEnLabel(b)).replace('{Band}', this.bandEnLabel(b, true));
      const te = TECH_EN[tech.id];
      const td = TECH_DE[tech.id];
      const fillDe = (s: string) => fillTechDe(s, this.nameDe(p), b.name, b.settlementName);
      if (first) {
        this.s.discovered.push(tech.id);
        if (!(this.s.firsts ??= []).some((f) => f.tech === tech.id)) {
          this.s.firsts.push({ tech: tech.id, pid: p.id, name, band: this.bandLabel(b, true), year: Math.floor(this.year) });
        }
        p.deeds.push(`Откри „${tech.name}“ (${formatYear(this.year)})`);
        this.emit('discovery', 3, fill(tech.text), fill(tech.kids), p.id, b.id, [], te ? [fillEn(te.text), fillEn(te.kids)] : undefined,
          td ? [fillDe(td.text), fillDe(td.kids)] : undefined);
      } else {
        p.deeds.push(`Преоткри „${tech.name}“ за своя род`);
        this.emit('rediscovery', 1, `${name} от ${this.bandLabel(b)} откри наново „${tech.name}“, без да знае, че другаде вече го умеят.`, undefined, p.id, b.id, [],
          [`${nameE} of ${this.bandEnLabel(b)} discovered “${this.techName(tech.id, true)}” anew, not knowing that others already have it.`],
          [`${this.nameDe(p)} ${this.bWith('aus', b)} entdeckte „${td?.name ?? tech.name}“ neu, ohne zu wissen, dass andere es längst beherrschen.`]);
      }
      if (tech.id === 'agriculture') this.settle(b, m);
      return; // one discovery per band per month
    }
  }

  /** ideas come rarely before their time and more and more often after it: keeps the story near the real calendar */
  private techPace(tech: Tech): number {
    const d = (this.year - tech.target) / (tech.era >= 5 ? 90 : 250);
    // 250 years early: 2%, 500 years: 0.03%; from the middle ages on the prerequisites wait for centuries, so early is rarer still
    if (d < 0) return Math.exp((tech.era >= 4 ? 6 : 4) * d);
    return Math.min(8, 1 + d * 2);
  }

  private settle(b: Band, m: Person[]) {
    if (b.settled) return;
    if (this.mars) { this.settleNew(b); return; }
    b.settled = true;
    const used = new Set(this.s.usedPlaces);
    b.settlementName = placeName(this.rng, used);
    this.s.usedPlaces = [...used];
    b.scout = null;
    this.clearAround(b.cx, b.cy, 3);
    const chief = b.chiefId ? this.byId.get(b.chiefId) : undefined;
    const elder = chief ?? m.reduce((a, p) => (this.ageOf(p) > this.ageOf(a) ? p : a), m[0]);
    this.emit('settle', 3,
      `${b.name} спря да скита и основа селото ${b.settlementName}. ${chief ? `Старейшината ${this.nameOf(elder)}` : `Най-възрастният в рода, ${this.nameOf(elder)},`} избра мястото край водата.`,
      `${b.name} построи село и го нарече ${b.settlementName}!`, elder.id, b.id, [],
      [`${bandThe(b.name, true)} stopped wandering and founded the village of ${villageEn(b.settlementName)}. ${chief ? `The elder ${this.nameEn(elder)}` : `The oldest of the clan, ${this.nameEn(elder)},`} chose the place by the water.`,
        `${bandThe(b.name, true)} built a village and named it ${villageEn(b.settlementName)}!`],
      [`${bandLabelDe(b.name, null, 'nom', true)} zog nicht mehr umher und gründete das Dorf ${villageDe(b.settlementName)}. ${chief ? `${elder.sex ? 'Die Älteste' : 'Der Älteste'} ${this.nameDe(elder)}` : `${elder.sex ? 'Die Älteste' : 'Der Älteste'} im Clan, ${this.nameDe(elder)},`} wählte den Platz am Wasser.`,
        `${bandLabelDe(b.name, null, 'nom', true)} hat ein Dorf gebaut und es ${villageDe(b.settlementName)} genannt!`]);
  }

  /** famous people come into the world in the year they were born in reality, in a band with a young mother */
  private famousBirths(members: Map<number, Person[]>) {
    const year = Math.floor(this.year);
    for (let i = 0; i < FAMOUS.length; i++) {
      const f = FAMOUS[i];
      // never in January: someone who died before their birthday must still be the right age in the January of that year
      if (f.born !== year || this.month !== Math.max(1, (i * 5) % 12)) continue;
      if ((this.s.famous ??= []).some((r) => r.i === i)) continue;
      const mothers: [Band, Person][] = [];
      for (const b of this.s.bands) for (const q of members.get(b.id) ?? []) {
        const a = this.ageOf(q);
        if (q.sex === 1 && q.partnerId && a >= 17 && a <= 40 && this.byId.has(q.id) && this.byId.has(q.partnerId)) mothers.push([b, q]);
      }
      if (!mothers.length) continue;
      const [b, mother] = this.rng.pick(mothers);
      const father = this.byId.get(mother.partnerId!) ?? null;
      const p = this.newPerson(b, mother, father, this.s.tick, f.sex);
      p.first = f.bg; p.nick = null; p.family = null; p.fame = i + 1;
      p.genes.int = Math.max(p.genes.int, 0.8); p.genes.cur = Math.max(p.genes.cur, 0.8);
      p.x = mother.x; p.y = mother.y;
      mother.children.push(p.id); father?.children.push(p.id);
      mother.lastBirth = this.s.tick;
      members.get(b.id)?.push(p);
      this.s.famous.push({ i, id: p.id, band: this.bandLabel(b, true) });
      const he = f.sex ? 'я' : 'го';
      this.emit('famous', 3, `★ В ${this.bandLabel(b)} ${this.nameOf(mother)} роди ${f.sex ? 'дъщеря' : 'син'}: ${f.bg}${f.bg.endsWith('.') ? '' : '.'} Светът ще ${he} помни като ${fameRole(f, 'bg')}.`,
        `★ В ${this.bandLabel(b)} се роди ${f.bg}! Някой ден всички ще ${he} познават.`, p.id, b.id, [this.pRef(mother)],
        [`★ In ${this.bandEnLabel(b)}, ${this.nameEn(mother)} gave birth to a ${f.sex ? 'daughter' : 'son'}: ${f.en}${f.en.endsWith('.') ? '' : '.'} The world will remember ${f.sex ? 'her' : 'him'} as ${/^[aeiou]/.test(fameRole(f, 'en')) ? 'an' : 'a'} ${fameRole(f, 'en')}.`,
          `★ ${f.en} was born in ${this.bandEnLabel(b)}! One day everybody will know ${f.sex ? 'her' : 'him'}.`],
        [`★ ${this.bWith('in', b, true)} brachte ${this.nameDe(mother)} ${f.sex ? 'eine Tochter' : 'einen Sohn'} zur Welt: ${f.de}${f.de.endsWith('.') ? '' : '.'} Die Welt wird ${f.sex ? 'sie' : 'ihn'} als ${fameRole(f, 'de')} in Erinnerung behalten.`,
          `★ ${this.bWith('in', b, true)} wurde ${f.de} geboren! Eines Tages werden alle ${f.sex ? 'sie' : 'ihn'} kennen.`]);
    }
  }

  famousList(): { i: number; id: number; band: string; died?: number }[] {
    return this.s.famous ?? [];
  }

  /** how many people the world can hold this year: the real world's people then (millions, roughly), taken to the
   *  power 0.4 so that the stone age is not empty and today does not need billions, for each open map */
  peopleCap(): number {
    const m = realPeople(this.year) / 1e6;
    const perMap = Math.max(800, 16000 * (m / 8100) ** 0.4);
    const maps = this.s.grid?.open.length ?? 1;
    return Math.min(60000, Math.round(perMap * (1 + 0.6 * (maps - 1))));
  }

  private lifeAndDeath(members: Map<number, Person[]>) {
    // a gentle hand that keeps a tiny humanity from vanishing too early
    const pop = this.s.people.length;
    const guardian = pop < 40 ? 0.45 : pop < 80 ? 0.65 : pop < 150 ? 0.85 : 1;
    // the world holds about as many people as the real one did in that year, in its own scale: near that number
    // fewer children are born, above it hardly any
    const full = this.mars ? 0 : pop / this.peopleCap();
    const crowd = Math.max(0.03, Math.min(1, 1 - (full - 0.85) / 0.3));
    const babies: [Band, Person, Person | null][] = [];
    for (const b of this.s.bands) {
      const m = members.get(b.id)!;
      if (!m.length) continue;
      const ratio = b.fed ?? 1.2;
      const now = b.lastNeed > 0 ? (b.lastProd + b.food) / b.lastNeed : 1;
      const hungry = now < 1 ? 1 - now : 0;
      const temp = this.t.temp[idx(Math.round(b.cx), Math.round(b.cy))];
      const winter = this.month === 11 || this.month <= 1;
      const coldRisk = winter && temp < 0.4 ? (0.4 - temp) * (this.hasTech(b, 'clothing') ? 0.15 : 1) * (this.hasTech(b, 'fire') ? 0.4 : 1) * 0.02 : 0;
      const medicine = (this.hasTech(b, 'medicine') ? 0.65 : this.hasTech(b, 'herb_lore') ? 0.8 : 1) * (this.hasTech(b, 'aqueduct') ? 0.85 : 1) * (this.hasTech(b, 'monastery') ? 0.9 : 1) * (this.hasTech(b, 'microscope') ? 0.85 : 1)
        * (this.hasTech(b, 'antibiotics') ? 0.6 : this.hasTech(b, 'vaccine') ? 0.75 : 1) * (this.hasTech(b, 'sewer') ? 0.85 : 1) * (this.hasTech(b, 'genome') ? 0.9 : 1) * (this.hasTech(b, 'gene_therapy') ? 0.75 : 1);
      const settledDisease = b.settled ? 1.4 : 1;
      for (const p of m) {
        const a = this.ageOf(p);
        const lon = p.genes.lon, hea = p.genes.hea;
        // annual mortality
        let q: number;
        if (a < 1) q = 0.16;
        else if (a < 5) q = 0.05;
        else if (a < 15) q = 0.012;
        // hard lives: most adults die before 60, only a few see 70
        else q = 0.012 + 0.00055 * Math.exp(0.09 * (a - 10 * (lon - 0.5) * 2));
        q *= medicine * settledDisease * (1.3 - hea * 0.6) * guardian;
        let pm = q / 12 + guardian * coldRisk * (a < 5 || a > 55 ? 2 : 1) + hungry * 0.015 * (a < 5 || a > 55 ? 2 : 0.6);
        if (p.fame) {
          // a famous person lives exactly as long as in reality
          const f = FAMOUS[p.fame - 1];
          // the right age, and in the year of death they really died in (the world has a year 0, history does not)
          pm = a >= f.age && (f.born < 0 && f.died > 0 || Math.floor(this.year) >= f.died) ? 1 : 0;
        }
        if (this.rng.chance(pm)) {
          const cause = p.fame ? (a >= 60 ? 'почина от старост' : 'почина от болест') : hungry > 0.25 && this.rng.chance(0.6) ? 'почина в гладна година'
            : coldRisk > 0.004 && this.rng.chance(0.5) ? 'почина в лютата зима'
            : a > 55 ? 'почина от старост' : a < 5 ? 'почина като дете' : 'почина от болест';
          this.die(p, cause, m);
          continue;
        }
        // a rare long life: the band honours its old ones
        if (Math.floor(a) === 70 && Math.floor(a - 1 / 12) === 69 && (p.deeds.length > 0 || b.chiefId === p.id || pop < 400)) {
          p.deeds.push(`Доживя до 70 години (${formatYear(this.year)})`);
          this.emit('elder', 1, `${this.nameOf(p)} от ${this.bandLabel(b)} навърши 70 години, рядкост в тези сурови времена. Сега гледа децата край огъня и им разказва истории.`,
            `${this.nameOf(p)} стана на 70! Сега разказва приказки на децата край огъня.`, p.id, b.id, [],
            [`${this.nameEn(p)} of ${this.bandEnLabel(b)} turned 70, a rare thing in these harsh times. Now ${p.sex ? 'she' : 'he'} watches the children by the fire and tells them stories.`,
              `${this.nameEn(p)} turned 70! Now ${p.sex ? 'she' : 'he'} tells stories to the children by the fire.`],
            [`${this.nameDe(p)} ${this.bWith('aus', b)} wurde 70 Jahre alt, eine Seltenheit in diesen harten Zeiten. Jetzt hütet ${p.sex ? 'sie' : 'er'} die Kinder am Feuer und erzählt ihnen Geschichten.`,
              `${this.nameDe(p)} ist 70 geworden! Jetzt erzählt ${p.sex ? 'sie' : 'er'} den Kindern am Feuer Geschichten.`]);
        }
        // births
        if (p.sex === 1 && p.partnerId && a >= 16 && a <= 42) {
          const interval = b.settled ? 26 : 36;
          if (this.s.tick - p.lastBirth >= interval) {
            // well fed families have children, hungry ones wait
            const fed = Math.max(0, Math.min(1, (ratio - 0.95) / 0.3));
            const chance = (pop < 80 ? 0.075 : 0.05) * fed * (0.6 + hea * 0.8) * (a > 35 ? 0.5 : 1) * crowd;
            if (this.rng.chance(chance)) {
              const father = this.byId.get(p.partnerId) ?? null;
              babies.push([b, p, father]);
              p.lastBirth = this.s.tick;
            }
          }
        }
      }
    }
    for (const [b, mother, father] of babies) {
      if (!this.byId.has(mother.id)) continue;
      const twins = this.rng.chance(0.012);
      for (let k = 0; k < (twins ? 2 : 1); k++) {
        const child = this.newPerson(b, mother, father, this.s.tick, this.rng.chance(0.5) ? 1 : 0);
        mother.children.push(child.id);
        father?.children.push(child.id);
        child.x = mother.x; child.y = mother.y;
        if (twins && k === 1) {
          this.emit('twins', 1, `В ${this.bandLabel(b)} ${this.nameOf(mother)} роди близнаци.`, `В ${this.bandLabel(b)} се родиха близнаци!`, child.id, b.id, [this.pRef(mother)],
            [`In ${this.bandEnLabel(b)}, ${this.nameEn(mother)} gave birth to twins.`, `Twins were born in ${this.bandEnLabel(b)}!`],
            [`${this.bWith('in', b, true)} brachte ${this.nameDe(mother)} Zwillinge zur Welt.`, `${this.bWith('in', b, true)} wurden Zwillinge geboren!`]);
        }
      }
    }
  }

  private die(p: Person, cause: string, bandMembers?: Person[], quiet = false) {
    if (!this.byId.has(p.id)) return;
    const b = this.bandById.get(p.bandId);
    this.byId.delete(p.id);
    const i = this.s.people.indexOf(p);
    if (i >= 0) this.s.people.splice(i, 1);
    if (bandMembers) {
      const j = bandMembers.indexOf(p);
      if (j >= 0) bandMembers.splice(j, 1);
    }
    if (p.partnerId) {
      const partner = this.byId.get(p.partnerId);
      if (partner) partner.partnerId = null;
    }
    this.s.totalDied++;
    const age = Math.floor(this.ageOf(p));
    this.deadQueue.push({
      id: p.id, name: this.nameOf(p), sex: p.sex, born: p.born, died: this.s.tick, cause,
      motherId: p.motherId, fatherId: p.fatherId, partnerId: p.partnerId, children: p.children,
      deeds: p.deeds, genes: p.genes, bandName: b ? this.bandLabel(b, true) : '', gen: p.gen,
    });
    const me = [this.pRef(p)];
    const nE = this.nameEn(p), he = p.sex ? 'she' : 'he', ofB = b ? this.bandEnLabel(b) : 'the clan';
    const nD = this.nameDe(p), er = p.sex ? 'sie' : 'er', ausB = b ? this.bWith('aus', b) : 'aus dem Clan';
    const found = p.deeds.find((d) => d.startsWith('Откри'));
    // a disaster names its dead all at once, village by village
    if (quiet && !p.fame) return;
    if (p.fame) {
      const f = FAMOUS[p.fame - 1];
      const rec = this.s.famous?.find((r) => r.id === p.id);
      if (rec) rec.died = Math.floor(this.year);
      this.emit('famous', 3, `★ ${this.nameOf(p)} ${cause} на ${age} години. Светът ще ${p.sex ? 'я' : 'го'} помни като ${fameRole(f, 'bg')}.`,
        `★ ${this.nameOf(p)} си отиде на ${age} години. Всички ще ${p.sex ? 'я' : 'го'} помнят.`, p.id, p.bandId, me,
        [`★ ${nE} ${causeEn(cause)} at ${age}. The world will remember ${p.sex ? 'her' : 'him'} as ${/^[aeiou]/.test(fameRole(f, 'en')) ? 'an' : 'a'} ${fameRole(f, 'en')}.`,
          `★ ${nE} passed away at ${age}. Everyone will remember ${p.sex ? 'her' : 'him'}.`],
        [`★ ${nD} ${causeDe(cause, age)}. Die Welt wird ${p.sex ? 'sie' : 'ihn'} als ${fameRole(f, 'de')} in Erinnerung behalten.`,
          `★ ${nD} ist mit ${age} Jahren gestorben. Alle werden sich an ${p.sex ? 'sie' : 'ihn'} erinnern.`]);
    } else if (found) {
      this.emit('death', 2, `${this.nameOf(p)} ${cause} на ${age} години. Родът ще помни, че тя/той ${found.toLowerCase()}.`.replace('тя/той', p.sex ? 'тя' : 'той'),
        `${this.nameOf(p)} си отиде на ${age} години. Всички помнят какво е открил${p.sex ? 'а' : ''}.`, p.id, p.bandId, me,
        [`${nE} ${causeEn(cause)} at ${age}. The clan will remember that ${he} ${deedEn(found).replace(/^D/, 'd')}.`,
          `${nE} passed away at ${age}. Everyone remembers what ${he} discovered.`],
        [`${nD} ${causeDe(cause, age)}. Der Clan wird nicht vergessen, dass ${er} „${techDe(/„(.+)“/.exec(found)?.[1] ?? '')}“ entdeckt hat.`,
          `${nD} ist mit ${age} Jahren gestorben. Alle erinnern sich daran, was ${er} entdeckt hat.`]);
    } else if (age >= 70) {
      this.emit('death', 1, `${this.nameOf(p)} от ${b ? this.bandLabel(b) : 'рода'} ${cause} на почтените ${age} години.`, undefined, p.id, p.bandId, me,
        [`${nE} of ${ofB} ${causeEn(cause)} at the venerable age of ${age}.`],
        [`${nD} ${ausB} ${causeDe(cause, age)}. Ein gesegnetes Alter.`]);
    } else if (cause === 'загина на лов') {
      this.emit('death', 1, `${this.nameOf(p)} от ${b ? this.bandLabel(b) : 'рода'} не се върна от лова.`, `${this.nameOf(p)} не се върна от лова. Родът е тъжен.`, p.id, p.bandId, me,
        [`${nE} of ${ofB} did not come back from the hunt.`, `${nE} did not come back from the hunt. The clan is sad.`],
        [`${nD} ${ausB} kehrte nicht von der Jagd zurück.`, `${nD} ist nicht von der Jagd zurückgekommen. Alle sind traurig.`]);
    }
  }

  private isKin(a: Person, b: Person): boolean {
    if (a.motherId && (a.motherId === b.motherId || a.motherId === b.id)) return true;
    if (a.fatherId && (a.fatherId === b.fatherId || a.fatherId === b.id)) return true;
    if (b.motherId === a.id || b.fatherId === a.id) return true;
    return false;
  }

  private pairing(members: Map<number, Person[]>) {
    for (const b of this.s.bands) {
      const m = members.get(b.id)!;
      // a king keeps his young children and grandchildren free for a royal wedding with a neighbouring house
      const royal = this.isCapital(b) ? this.royalBlood(b) : null;
      const single = (p: Person) => !p.partnerId && this.ageOf(p) >= 16 && this.ageOf(p) <= 55 && !(royal?.has(p.id) && this.ageOf(p) < 28);
      const men = m.filter((p) => p.sex === 0 && single(p));
      for (const man of men) {
        if (!this.rng.chance(0.7)) continue;
        let pool = m.filter((p) => p.sex === 1 && single(p) && !this.isKin(man, p));
        let other: Band | null = null;
        if (!pool.length || this.rng.chance(0.3)) {
          // look to a neighbouring band
          for (const ob of this.s.bands) {
            if (ob.id === b.id || dist(ob, b) > (pool.length ? 25 : 45)) continue;
            const cand = (members.get(ob.id) ?? []).filter((p) => p.sex === 1 && single(p));
            if (cand.length) { pool = cand; other = ob; break; }
          }
        }
        if (!pool.length) continue;
        const woman = this.rng.pick(pool);
        man.partnerId = woman.id;
        woman.partnerId = man.id;
        if (other) {
          // she moves to his band (or he to hers)
          const moveHer = this.rng.chance(0.65);
          const mover = moveHer ? woman : man;
          const from = moveHer ? other : b;
          const to = moveHer ? b : other;
          const fromList = members.get(from.id)!;
          fromList.splice(fromList.indexOf(mover), 1);
          members.get(to.id)!.push(mover);
          mover.bandId = to.id;
          if (this.rng.chance(0.15)) {
            this.emit('marriage', 1, `${this.nameOf(man)} и ${this.nameOf(woman)} събраха ${this.bandLabel(b)} и ${this.bandLabel(other)} в едно семейство.`, undefined, man.id, b.id,
              [this.pRef(woman), ...this.bRefs(other)],
              [`${this.nameEn(man)} and ${this.nameEn(woman)} joined ${this.bandEnLabel(b)} and ${this.bandEnLabel(other)} into one family.`],
              [`${this.nameDe(man)} und ${this.nameDe(woman)} verbanden ${this.bDe(b, 'akk')} und ${this.bDe(other, 'akk')} zu einer Familie.`]);
          }
        }
      }
    }
  }

  private bandDynamics(members: Map<number, Person[]>) {
    const t = this.t;
    for (const b of [...this.s.bands]) {
      const m = members.get(b.id)!;
      if (m.length === 0) {
        this.removeBand(b);
        continue;
      }
      // merge tiny bands into a neighbour
      if (m.length < 5 && this.s.bands.length > 1) {
        const near = this.s.bands.filter((o) => o.id !== b.id && dist(o, b) < 20 && (members.get(o.id)?.length ?? 0) > 0)
          .sort((x, y) => dist(x, b) - dist(y, b))[0];
        if (near) {
          for (const p of m) { p.bandId = near.id; members.get(near.id)!.push(p); }
          for (const tech of b.techs) this.addTech(near, tech);
          this.emit('merge', 1, `Последните ${m.length} от ${this.bandLabel(b)} се присъединиха към ${this.bandLabel(near)}.`, undefined, undefined, near.id, this.bRefs(b),
            [`The last ${m.length} of ${this.bandEnLabel(b)} joined ${this.bandEnLabel(near)}.`],
            [`Die letzten ${m.length} ${this.bWith('aus', b)} schlossen sich ${this.bDe(near, 'dat')} an.`]);
          members.set(b.id, []);
          this.removeBand(b, near);
          continue;
        }
      }
      // on Mars nobody wanders: a group that leaves builds its own dome at once
      if (this.mars && !b.settled) this.settleNew(b);
      // nomads move with the seasons and the game
      // nomads stay while there is wood around the camp; only a real famine drives them off earlier
      if (!b.settled && !b.scout) {
        const noWood = this.treesNear(b.cx, b.cy, 4, 2) === 0;
        const starving = (b.fed ?? 1) < 0.7 && this.rng.chance(0.08);
        if (noWood || starving) this.moveCamp(b, m, noWood ? 22 : 16);
      }
      // split: rare, a band has to grow big first
      // a walled town holds more people before some leave to found a new village
      const limit = this.mars ? 450 : b.settled ? this.townLimit(b) : 40 + Math.round(avg(m, (p) => p.genes.soc) * 20);
      // too many mouths for this land: some leave to find their own
      const crowded = !b.settled && m.length >= 24 && (b.fed ?? 1) < 1.05 && this.rng.chance(0.012);
      if (m.length > limit || crowded) this.split(b, m, members);
      // a big harbour town that knows colonies now and then sends a ship of settlers to a far shore
      else if (b.settled && m.length > limit * 0.6 && this.hasTech(b, 'colonies') && this.rng.chance(0.002)) {
        const dest = this.colonySite(b);
        if (dest) this.split(b, m, members, dest);
      }
    }
    void t;
  }

  private removeBand(b: Band, into: Band | null = null) {
    const merged = !!into;
    this.goneQueue.push({
      id: b.id, name: b.name, settlementName: b.settlementName, color: b.color,
      foundedYear: Math.floor(yearOf(b.founded)), endedYear: Math.floor(this.year),
      end: into ? this.bandLabel(into, true) : 'extinct',
      techs: b.techs.map((x) => TECH_BY_ID.get(x)?.name ?? x),
      founder: b.founder ?? null, from: b.from ?? null,
    });
    const gone = this.bRefs(b);
    const i = this.s.bands.indexOf(b);
    if (i >= 0) this.s.bands.splice(i, 1);
    this.bandById.delete(b.id);
    this.techSets.delete(b.id);
    // a name is never given twice in one world, even after the band is gone
    if (!merged) {
      this.emit('extinct', 2, `${this.bandLabel(b, true)} угасна. Няма кой да запали огъня на тяхното място.`, `${this.bandLabel(b, true)} изчезна. Няма останали хора от този род.`, undefined, b.id, gone,
        [`${this.bandEnLabel(b, true)} has died out. No one is left to light a fire in their place.`, `${this.bandEnLabel(b, true)} is gone. No one from this clan is left.`],
        [`${this.bDe(b, 'nom', true)} ist erloschen. Niemand ist mehr da, der dort ein Feuer entzündet.`, `${this.bDe(b, 'nom', true)} ist verschwunden. Von diesem Clan ist niemand mehr übrig.`]);
    }
    // knowledge lost forever?
    for (const tech of b.techs) {
      if (!this.s.bands.some((o) => this.techSets.get(o.id)?.has(tech))) {
        const name = TECH_BY_ID.get(tech)?.name ?? tech;
        this.s.discovered = this.s.discovered.filter((x) => x !== tech);
        this.emit('lost', 2, `Заедно с ${this.bandLabel(b)} изчезна и знанието за „${name}“. Някой ще трябва да го открие наново.`, undefined, undefined, b.id, gone,
          [`With ${this.bandEnLabel(b)}, the knowledge of “${this.techName(tech, true)}” vanished too. Someone will have to discover it anew.`],
          [`Mit ${this.bDe(b, 'dat')} ging auch das Wissen um „${TECH_DE[tech]?.name ?? name}“ verloren. Jemand wird es neu entdecken müssen.`]);
      }
    }
  }

  private campScore(x: number, y: number, R: number, self: Band): number {
    const t = this.t;
    if (!inBounds(x, y)) return -1;
    const c = idx(x, y);
    if (!this.campable(c) || t.height[c] > 0.62) return -1;
    // a new camp must be reachable: across water only with boats
    if (!this.reachable(self, x, y)) return -1;
    for (const o of this.s.bands) {
      if (o.id === self.id) continue;
      if (Math.hypot(o.cx - x, o.cy - y) < 7) return -1;
      // a place another chief is already walking to is taken
      if (o.scout && Math.hypot(o.scout.x - x, o.scout.y - y) < 7) return -1;
    }
    // a new camp needs wood: at least five big trees close by
    const big = this.treesNear(x, y, 4, BIG);
    if (big < 5) return -1;
    let s = Math.min(12, big) * 0.3;
    for (let oy = -R; oy <= R; oy += 2) for (let ox = -R; ox <= R; ox += 2) {
      if (!inBounds(x + ox, y + oy)) continue;
      const i = idx(x + ox, y + oy);
      s += t.plants[i] + t.game[i] * 1.2 + (this.hasTech(self, 'fishing') ? t.fish[i] * 0.8 : 0);
    }
    const temp = t.temp[c];
    if (temp < 0.3) s *= this.hasTech(self, 'clothing') ? 0.85 : 0.5;
    if (t.fish[c]) s *= 1.15;
    return s;
  }

  /** the band's head: the oldest man; a new one when he dies or leaves */
  private ensureChief(b: Band, m: Person[]): Person | null {
    const cur = b.chiefId ? this.byId.get(b.chiefId) : undefined;
    // a king reigns for life; other chiefs hand over at 70
    const capital = this.isCapital(b);
    if (cur && cur.bandId === b.id && (this.ageOf(cur) < 70 || capital)) return cur;
    // at 70 the old chief stays by the fire with the children and hands over to the oldest man after him
    let best: Person | null = null;
    // in a capital the crown goes to the king's eldest son, then his eldest grandson, then anyone of royal blood
    if (capital && b.chiefId) {
      const oldId = b.chiefId;
      const men = m.filter((p) => p.sex === 0 && this.ageOf(p) >= 16).sort((x, y) => x.born - y.born);
      const kings = this.s.kingIds ?? [];
      best = men.find((p) => p.fatherId === oldId)
        ?? men.find((p) => p.fatherId != null && this.byId.get(p.fatherId)?.fatherId === oldId)
        ?? men.find((p) => p.fatherId != null && kings.includes(p.fatherId) && this.ageOf(p) < 70) ?? null;
    }
    if (!best) for (const p of m) if (p.sex === 0 && this.ageOf(p) >= 16 && this.ageOf(p) < 70 && (!best || p.born < best.born)) best = p;
    const had = !!b.chiefId;
    b.chiefId = best?.id ?? null;
    if (!best) { b.scout = null; return null; }
    if (had && b.settled) { // nomad bands change elders too often to write each one down
      this.emit('chief', 1, `${this.nameOf(best)} стана ${this.chiefTitleOf(b).toLowerCase()} на ${this.bandLabel(b)}.`,
        `${this.nameOf(best)} е новият ${this.chiefTitleOf(b).toLowerCase()} на ${this.bandLabel(b)}.`, best.id, b.id, [],
        [`${this.nameEn(best)} became ${chiefEn(this.chiefTitleOf(b)).toLowerCase()} of ${this.bandEnLabel(b)}.`],
        [`${this.nameDe(best)} ist jetzt ${chiefDe(this.chiefTitleOf(b), best.sex === 1)} ${this.bDe(b, 'gen')}.`]);
    }
    return best;
  }

  /** the chief of a capital is a king */
  chiefTitleOf(b: Band | undefined): string {
    return b && this.isCapital(b) ? 'Цар' : this.chiefTitle();
  }

  isCapital(b: Band): boolean {
    return b.kingdom != null && !!this.s.kingdoms?.some((k) => k.id === b.kingdom && k.capital === b.id);
  }

  chiefTitle(): string {
    return CHIEF_TITLES[Math.min(this.s.era, CHIEF_TITLES.length - 1)];
  }

  /** the chief stays within two tiles of the camp, or walks ahead to a new place and calls the band after him */
  private lead(b: Band, chief: Person, m: Person[]) {
    if (b.scout) {
      chief.task = 'scout';
      // where he walked to so far (starts at the camp)
      const sc = b.scout;
      const px = sc.px ?? b.cx, py = sc.py ?? b.cy;
      const dx = sc.x - px, dy = sc.y - py;
      const d = Math.hypot(dx, dy);
      if (d > 0.6) {
        const v = Math.min(d, Math.max(6, d / 2)); // at most two months ahead of the band: he looks, then calls them
        sc.px = px + (dx / d) * v;
        sc.py = py + (dy / d) * v;
        chief.x = sc.px;
        chief.y = sc.py;
        return;
      }
      // someone else got there first: he gives up and walks back
      if (this.s.bands.some((o) => o.id !== b.id && Math.hypot(o.cx - sc.x, o.cy - sc.y) < 5)) {
        b.scout = null;
        chief.x = b.cx;
        chief.y = b.cy;
        chief.task = 'lead';
        return;
      }
      // he is there and likes it: the camp, the banner and everyone follow
      chief.x = sc.x;
      chief.y = sc.y;
      b.cx = sc.x;
      b.cy = sc.y;
      b.scout = null;
      this.clearAround(b.cx, b.cy, 1);
      for (const p of m) if (p !== chief) p.task = 'travel';
      return;
    }
    chief.task = 'lead';
    for (let k = 0; k < 6; k++) {
      const x = b.cx + this.rng.range(-2, 2), y = b.cy + this.rng.range(-2, 2);
      if (this.reachable(b, Math.round(x), Math.round(y))) { chief.x = x; chief.y = y; return; }
    }
    chief.x = b.cx + this.rng.range(-0.3, 0.3);
    chief.y = b.cy + this.rng.range(-0.3, 0.3);
  }

  private moveCamp(b: Band, m: Person[], range: number) {
    if (b.scout) return; // the chief is still looking
    let best = { x: b.cx, y: b.cy }, bestS = this.campScore(Math.round(b.cx), Math.round(b.cy), 4, b) * 1.05;
    for (let k = 0; k < 24; k++) {
      const x = Math.round(b.cx + this.rng.range(-range, range)), y = Math.round(b.cy + this.rng.range(-range, range));
      const s = this.campScore(x, y, 4, b);
      // -1 means "no camp possible here" (off the map, water, too close to others): never pick it,
      // even when the current camp scores -1 itself
      if (s > 0 && s > bestS) { bestS = s; best = { x, y }; }
    }
    if (best.x === b.cx && best.y === b.cy) return;
    // the chief goes first to look at the place; without one the whole band just goes
    if (b.chiefId && this.byId.get(b.chiefId)?.bandId === b.id) {
      b.scout = best;
      return;
    }
    b.cx = best.x; b.cy = best.y;
    this.clearAround(b.cx, b.cy, 1);
    for (const p of m) p.task = 'travel';
  }

  /** an empty, good place far over the sea for a colony: another island if there is one */
  private colonySite(b: Band): { x: number; y: number } | null {
    const home = this.regions[idx(Math.round(b.cx), Math.round(b.cy))];
    let best: { x: number; y: number } | null = null, bestS = 0;
    for (let k = 0; k < 60; k++) {
      const x = Math.floor(this.rng.range(0, W)), y = Math.floor(this.rng.range(0, H));
      if (!inBounds(x, y) || Math.hypot(x - b.cx, y - b.cy) < 40) continue;
      if (this.s.bands.some((o) => Math.hypot(o.cx - x, o.cy - y) < 14)) continue;
      let sc = this.campScore(x, y, 4, b);
      if (sc <= 0) continue;
      if (this.regions[idx(x, y)] !== home) sc *= 1.5;
      if (sc > bestS) { bestS = sc; best = { x, y }; }
    }
    return best;
  }

  private split(b: Band, m: Person[], members: Map<number, Person[]>, colony?: { x: number; y: number }) {
    // a founding couple leaves with their children and some friends
    // the founder is a man in his prime: he becomes the elder of the new band
    const adults = m.filter((p) => p.sex === 0 && p.id !== b.chiefId && this.ageOf(p) >= 20 && this.ageOf(p) <= 45 && p.partnerId);
    if (!adults.length) return;
    const leader = adults.reduce((a, p) => (p.genes.cur + p.genes.str > a.genes.cur + a.genes.str ? p : a), adults[0]);
    const leaving = new Set<Person>([leader]);
    const partner = leader.partnerId ? this.byId.get(leader.partnerId) : undefined;
    if (partner && partner.bandId === b.id) leaving.add(partner);
    const target = Math.floor(m.length * 0.4);
    const families = [leader, partner].filter(Boolean) as Person[];
    for (const f of families) for (const c of f.children) { const ch = this.byId.get(c); if (ch && ch.bandId === b.id) leaving.add(ch); }
    for (const p of m) {
      if (leaving.size >= target) break;
      if (this.rng.chance(0.3)) {
        leaving.add(p);
        const pp = p.partnerId ? this.byId.get(p.partnerId) : undefined;
        if (pp && pp.bandId === b.id) leaving.add(pp);
      }
    }
    // where to go
    let best: { x: number; y: number } | null = colony ?? null, bestS = 0;
    for (let k = 0; k < (colony ? 0 : 30); k++) {
      const r = this.rng.range(9, b.settled ? 22 : 16);
      const a = this.rng.range(0, Math.PI * 2);
      const x = Math.round(b.cx + Math.cos(a) * r), y = Math.round(b.cy + Math.sin(a) * r);
      // on Mars any flat ground away from the other domes will do
      const s = this.mars ? (inBounds(x, y) && this.t.biome[idx(x, y)] !== Biome.Mountain && !this.s.bands.some((o) => Math.hypot(o.cx - x, o.cy - y) < 8) ? 1 + this.rng.next() : 0)
        : this.campScore(x, y, 4, b);
      if (s > bestS) { bestS = s; best = { x, y }; }
    }
    if (!best) return;
    const nb = this.newBand(best.x, best.y, undefined, b.techs);
    nb.culture = b.culture;
    nb.chiefId = leader.id;
    nb.founder = { id: leader.id, name: this.nameOf(leader) };
    nb.from = { id: b.id, name: this.bandLabel(b, true) };
    this.clearAround(nb.cx, nb.cy, 1);
    nb.food = b.food * 0.35;
    b.food *= 0.65;
    const list = members.get(b.id)!;
    const newList: Person[] = [];
    for (const p of leaving) {
      p.bandId = nb.id;
      p.task = 'travel';
      // colonists come by ship: they step off on the new shore
      if (colony) { p.x = nb.cx + this.rng.range(-1.5, 1.5); p.y = nb.cy + this.rng.range(-1.5, 1.5); }
      list.splice(list.indexOf(p), 1);
      newList.push(p);
    }
    members.set(nb.id, newList);
    leader.deeds.push(`Основа ${nb.name} и стана негов ${this.chiefTitle().toLowerCase()} (${formatYear(this.year)})`);
    // no chronicle line: the band's card tells who founded it and where they came from
    if (b.settled && this.hasTech(b, 'agriculture')) this.settleNew(nb);
    if (colony) {
      nb.colony = true;
      const k = this.kingdomOf(b);
      if (k && nb.settled) { k.members.push(nb.id); nb.kingdom = k.id; }
      leader.deeds.push(`Отплава с кораб и основа колония на далечен бряг (${formatYear(this.year)})`);
      this.emit('colony', 2, `Кораб от ${this.bandLabel(b)} прекоси морето. ${this.nameOf(leader)} и ${leaving.size} души основаха на далечен бряг ${this.bandLabel(nb)}.`,
        `${this.nameOf(leader)} отплава с кораб и основа ново село на далечен бряг!`, leader.id, nb.id, this.bRefs(b),
        [`A ship from ${this.bandEnLabel(b)} crossed the sea. ${this.nameEn(leader)} and ${leaving.size} people founded ${this.bandEnLabel(nb)} on a distant shore.`,
          `${this.nameEn(leader)} sailed away and founded a new village on a distant shore!`],
        [`Ein Schiff ${this.bWith('aus', b)} überquerte das Meer. ${this.nameDe(leader)} und ${leaving.size} Menschen gründeten an einer fernen Küste ${this.bDe(nb, 'akk')}.`,
          `${this.nameDe(leader)} ist davongesegelt und hat an einer fernen Küste ein neues Dorf gegründet!`]);
    }
  }

  private settleNew(b: Band) {
    b.settled = true;
    this.clearAround(b.cx, b.cy, 3);
    const used = new Set(this.s.usedPlaces);
    b.settlementName = placeName(this.rng, used);
    this.s.usedPlaces = [...used];
  }

  private contact() {
    const bands = this.s.bands;
    for (let i = 0; i < bands.length; i++) {
      for (let j = i + 1; j < bands.length; j++) {
        const a = bands[i], b = bands[j];
        const d = dist(a, b);
        // horses and carts bring far neighbours together
        const reach = this.hasTech(a, 'jet') && this.hasTech(b, 'jet') ? 160 : this.hasTech(a, 'aviation') && this.hasTech(b, 'aviation') ? 100 : (this.hasTech(a, 'railway') || this.hasTech(a, 'automobile')) && (this.hasTech(b, 'railway') || this.hasTech(b, 'automobile')) ? 70 : this.hasTech(a, 'steamship') && this.hasTech(b, 'steamship') ? 60 : this.hasTech(a, 'caravel') && this.hasTech(b, 'caravel') ? 50 : this.hasTech(a, 'post') && this.hasTech(b, 'post') ? 45 : this.hasTech(a, 'compass') && this.hasTech(b, 'compass') ? 38 : this.hasTech(a, 'harbor') && this.hasTech(b, 'harbor') ? 30 : this.hasTech(a, 'horse') || this.hasTech(b, 'horse') ? 24 : 16;
        if (d > reach && !(a.kingdom != null && b.kingdom != null && (a.kingdom === b.kingdom || this.kingdomOf(a)?.allies?.[b.kingdom] != null))) continue;
        // traders even out a good and a bad harvest between neighbours
        if (this.hasTech(a, 'trade') && this.hasTech(b, 'trade')) {
          const give = (a.food - b.food) * (this.hasTech(a, 'internet') && this.hasTech(b, 'internet') ? 0.2 : this.hasTech(a, 'factory') && this.hasTech(b, 'factory') ? 0.15 : this.hasTech(a, 'banking') && this.hasTech(b, 'banking') ? 0.12 : this.hasTech(a, 'guilds') && this.hasTech(b, 'guilds') ? 0.1 : this.hasTech(a, 'coins') && this.hasTech(b, 'coins') ? 0.08 : 0.05);
          a.food -= give;
          b.food += give;
        }
        if (!a.met.includes(b.id)) {
          a.met.push(b.id);
          b.met.push(a.id);
          if (this.rng.chance(0.4)) {
            this.emit('meet', 1, `${this.bandLabel(a, true)} и ${this.bandLabel(b)} се срещнаха край ${this.featureNear(a)}. Размениха си кремък и истории.`, undefined, undefined, a.id, this.bRefs(b),
              [`${this.bandEnLabel(a, true)} and ${this.bandEnLabel(b)} met by ${FEATURE_EN[this.featureNear(a)] ?? 'the river'}. They traded flint and stories.`],
              [`${this.bDe(a, 'nom', true)} und ${this.bDe(b, 'nom')} trafen sich ${FEATURE_DE[this.featureNear(a)] ?? 'am Fluss'}. Sie tauschten Feuerstein und Geschichten.`]);
          }
        }
        // knowledge travels between neighbours
        const sa = this.techSets.get(a.id)!, sb = this.techSets.get(b.id)!;
        const share = 0.012 * (this.hasTech(a, 'cave_art') || this.hasTech(b, 'cave_art') ? 1.6 : 1)
          * (this.hasTech(a, 'alphabet') || this.hasTech(b, 'alphabet') ? 1.8 : this.hasTech(a, 'writing') || this.hasTech(b, 'writing') ? 1.5 : 1)
          * (this.hasTech(a, 'library') || this.hasTech(b, 'library') ? 1.2 : 1) * (this.hasTech(a, 'theatre') || this.hasTech(b, 'theatre') ? 1.1 : 1)
          * (this.hasTech(a, 'printing') || this.hasTech(b, 'printing') ? 1.6 : this.hasTech(a, 'paper') || this.hasTech(b, 'paper') ? 1.15 : 1)
          * (this.hasTech(a, 'newspaper') || this.hasTech(b, 'newspaper') ? 1.3 : 1) * (this.hasTech(a, 'coffeehouse') || this.hasTech(b, 'coffeehouse') ? 1.1 : 1)
          * (this.hasTech(a, 'radio') || this.hasTech(b, 'radio') ? 1.5 : 1) * (this.hasTech(a, 'telegraph') && this.hasTech(b, 'telegraph') ? 1.5 : 1) * (this.hasTech(a, 'television') || this.hasTech(b, 'television') ? 1.3 : 1) * (this.hasTech(a, 'internet') && this.hasTech(b, 'internet') ? 2 : 1);
        for (const tech of a.techs) if (!sb.has(tech) && this.canUse(b, tech) && this.rng.chance(share)) {
          this.addTech(b, tech);
          this.emit('learn', 1, `${this.bandLabel(b, true)} научи „${TECH_BY_ID.get(tech)!.name}“ от ${this.bandLabel(a)}.`, undefined, undefined, b.id, this.bRefs(a),
            [`${this.bandEnLabel(b, true)} learned “${this.techName(tech, true)}” from ${this.bandEnLabel(a)}.`],
            [`${this.bDe(b, 'nom', true)} lernte „${TECH_DE[tech]?.name ?? tech}“ ${this.bWith('von', a)}.`]);
          if (tech === 'agriculture') this.settle(b, this.s.people.filter((p) => p.bandId === b.id));
        }
        for (const tech of b.techs) if (!sa.has(tech) && this.canUse(a, tech) && this.rng.chance(share)) {
          this.addTech(a, tech);
          this.emit('learn', 1, `${this.bandLabel(a, true)} научи „${TECH_BY_ID.get(tech)!.name}“ от ${this.bandLabel(b)}.`, undefined, undefined, a.id, this.bRefs(b),
            [`${this.bandEnLabel(a, true)} learned “${this.techName(tech, true)}” from ${this.bandEnLabel(b)}.`],
            [`${this.bDe(a, 'nom', true)} lernte „${TECH_DE[tech]?.name ?? tech}“ ${this.bWith('von', b)}.`]);
          if (tech === 'agriculture') this.settle(a, this.s.people.filter((p) => p.bandId === a.id));
        }
      }
    }
  }

  private canUse(b: Band, tech: string): boolean {
    const def = TECH_BY_ID.get(tech);
    if (!def) return false;
    const set = this.techSets.get(b.id)!;
    if (!def.prereq.every((r) => set.has(r))) return false;
    // you can only farm where grain grows
    if (tech === 'agriculture' || tech === 'grinding') return this.areaHas(b, 7, 'grain');
    return true;
  }

  private featureNear(b: Band): string {
    const t = this.t;
    const i = idx(Math.round(b.cx), Math.round(b.cy));
    if (this.mars) return t.biome[i] === Biome.Hills ? 'хълмовете' : 'кратера';
    if (t.river[i]) return 'реката';
    const bi = t.biome[i];
    if (bi === Biome.Forest || bi === Biome.Taiga) return 'гората';
    if (bi === Biome.Hills) return 'хълмовете';
    if (bi === Biome.Beach) return 'морето';
    return 'голямата поляна';
  }

  private explore() {
    for (const b of this.s.bands) {
      const R = b.settled ? 6 : 8;
      const cx = Math.round(b.cx), cy = Math.round(b.cy);
      for (let y = cy - R; y <= cy + R; y++) for (let x = cx - R; x <= cx + R; x++) {
        if (!inBounds(x, y)) continue;
        if ((x - cx) ** 2 + (y - cy) ** 2 > R * R) continue;
        const i = idx(x, y);
        if (!this.t.explored[i]) { this.t.explored[i] = 1; this.exploredDirty = true; }
      }
    }
  }

  private randomEvents(members: Map<number, Person[]>) {
    if (!this.s.bands.length) return;
    // a great hunt
    if (this.rng.chance(0.004)) {
      const b = this.rng.pick(this.s.bands);
      const hunters = (members.get(b.id) ?? []).filter((p) => p.task === 'hunt');
      if (hunters.length) {
        const h = hunters.reduce((a, p) => (p.genes.str > a.genes.str ? p : a), hunters[0]);
        const beast = this.rng.pick(['мамут', 'пещерна мечка', 'огромен зубър', 'стадо диви коне', 'гигантски елен']);
        b.food += 40;
        h.deeds.push(`Поведе лова на ${beast}`);
        this.emit('hunt', 2, `${this.nameOf(h)} поведе ловците на ${this.bandLabel(b)} срещу ${beast}. Месото стигна за цял сезон.`,
          `${this.nameOf(h)} и ловците хванаха ${beast}! Цяло угощение!`, h.id, b.id, [],
          [`${this.nameEn(h)} led the hunters of ${this.bandEnLabel(b)} against ${BEAST_EN[beast] ?? beast}. The meat lasted a whole season.`,
            `${this.nameEn(h)} and the hunters caught ${BEAST_EN[beast] ?? beast}! A real feast!`],
          [`${this.nameDe(h)} führte die Jäger ${this.bDe(b, 'gen')} gegen ${BEAST_DE[beast] ?? beast}. Das Fleisch reichte für eine ganze Jahreszeit.`,
            `${this.nameDe(h)} und die Jäger haben ${BEAST_DE[beast] ?? beast} erlegt! Ein richtiges Festmahl!`]);
      }
    }
    // a hard winter
    if (this.month === 0 && this.rng.chance(0.06)) {
      const b = this.rng.pick(this.s.bands);
      b.food *= 0.4;
      this.emit('winter', 1, `Люта зима сполетя ${this.bandLabel(b)}. Запасите се стопиха.`, `Много студена зима при ${this.bandLabel(b)}. Сняг до колене!`, undefined, b.id, [],
        [`A bitter winter struck ${this.bandEnLabel(b)}. The stores melted away.`, `A very cold winter for ${this.bandEnLabel(b)}. Snow up to the knees!`],
        [`Ein bitterkalter Winter traf ${this.bDe(b, 'akk')}. Die Vorräte schmolzen dahin.`, `Ein sehr kalter Winter ${this.bWith('bei', b)}. Schnee bis zu den Knien!`]);
    }
    // drought in summer
    if (this.month === 6 && this.rng.chance(0.03)) {
      const b = this.rng.pick(this.s.bands);
      const cx = Math.round(b.cx), cy = Math.round(b.cy);
      for (let y = cy - 12; y <= cy + 12; y++) for (let x = cx - 12; x <= cx + 12; x++) if (inBounds(x, y)) this.t.plants[idx(x, y)] *= 0.4;
      this.emit('drought', 1, `Суша изгори тревите около ${this.bandLabel(b)}. Плодовете тази година са малко.`, undefined, undefined, b.id, [],
        [`Drought burned the grass around ${this.bandEnLabel(b)}. There is little fruit this year.`],
        [`Eine Dürre verbrannte das Gras rund um ${this.bDe(b, 'akk')}. In diesem Jahr gibt es wenig Früchte.`]);
    }
    this.seasonEvents();
  }

  // ---------- disasters: a flood, a drought, a plague, a cattle plague over a whole region ----------

  private disasters(members: Map<number, Person[]>) {
    if (this.s.bands.length < 4) return;
    const settled = this.s.bands.filter((b) => b.settled);
    let kind: 'flood' | 'drought' | 'epidemic' | 'murrain' | null = null;
    if (this.month === 3 && this.rng.chance(0.04)) kind = 'flood';
    else if (this.month === 6 && this.rng.chance(0.02)) kind = 'drought';
    else if (this.month === 4 && this.rng.chance(0.025)) kind = 'murrain';
    else if (this.s.era >= 1 && settled.length >= 3 && this.rng.chance(0.0025)) kind = 'epidemic';
    if (!kind) return;
    const pool = kind === 'flood' ? settled.filter((b) => this.areaHas(b, 3, 'fish'))
      : kind === 'murrain' ? this.s.bands.filter((b) => this.hasTech(b, 'herding'))
      : kind === 'epidemic' ? settled.filter((b) => (members.get(b.id)?.length ?? 0) >= 30) : this.s.bands;
    if (!pool.length) return;
    const c = this.rng.pick(pool);
    const R = kind === 'drought' ? 14 : kind === 'flood' ? 8 : 11;
    const hit = pool.filter((b) => Math.hypot(b.cx - c.cx, b.cy - c.cy) <= R).slice(0, 12);
    const dead = new Map<Band, number>();
    for (const b of hit) {
      const m = members.get(b.id) ?? [];
      let rate = 0, cause = '';
      if (kind === 'flood') {
        b.food *= 0.6;
        rate = 0.025;
        cause = 'загина при наводнение';
      } else if (kind === 'drought') {
        b.food *= 0.4;
        const cx = Math.round(b.cx), cy = Math.round(b.cy);
        for (let y = cy - 6; y <= cy + 6; y++) for (let x = cx - 6; x <= cx + 6; x++) if (inBounds(x, y)) this.t.plants[idx(x, y)] *= 0.5;
        // an aqueduct carries a village through a dry year
        rate = this.hasTech(b, 'aqueduct') ? 0.004 : b.settled ? 0.012 : 0.02;
        cause = 'почина в гладна година';
      } else if (kind === 'murrain') {
        b.food *= 0.7;
      } else {
        // crowded towns suffer most; every step of medicine makes it milder
        rate = 0.06 + Math.min(0.08, m.length / 4000);
        for (const [t, f] of [['herb_lore', 0.85], ['medicine', 0.6], ['vaccine', 0.45], ['antibiotics', 0.4], ['genome', 0.5]] as const) if (this.hasTech(b, t)) rate *= f;
        rate *= 0.6 + this.rng.next() * 0.8;
        cause = 'почина при епидемията';
      }
      if (!rate) continue;
      let n = 0;
      for (const p of [...m]) {
        if (p.fame) continue;
        const a = this.ageOf(p);
        if (this.rng.chance(rate * (a < 5 || a > 60 ? 2 : 1))) { this.die(p, cause, m, true); n++; }
      }
      if (n) dead.set(b, n);
    }
    const total = [...dead.values()].reduce((x, y) => x + y, 0);
    this.s.disasterDead = (this.s.disasterDead ?? 0) + total;
    const worst = [...dead].sort((a, b) => b[1] - a[1]);
    const top = worst.slice(0, 5), more = worst.length - top.length;
    const listBg = top.map(([b, n]) => `${this.bandLabel(b)} (${n})`).join(', ') + (more > 0 ? ` и още ${more} ${more === 1 ? 'място' : 'места'}` : '');
    const listEn = top.map(([b, n]) => `${this.bandEnLabel(b)} (${n})`).join(', ') + (more > 0 ? ` and ${more} more ${more === 1 ? 'place' : 'places'}` : '');
    const listDe = top.map(([b, n]) => `${this.bDe(b, 'nom')} (${n})`).join(', ') + (more > 0 ? ` und ${more} weitere ${more === 1 ? 'Ort' : 'Orte'}` : '');
    const deadBg = total ? ` Загинаха ${total} души: ${listBg}.` : '';
    const deadEn = total ? ` ${total} ${total === 1 ? 'person' : 'people'} died: ${listEn}.` : '';
    const deadDe = total ? ` ${total} ${total === 1 ? 'Mensch starb' : 'Menschen starben'}: ${listDe}.` : '';
    const where = this.bandLabel(c), whereEn = this.bandEnLabel(c), places = hit.length;
    const refs = hit.flatMap((b) => this.bRefs(b));
    const imp = total >= 20 ? 3 : 2;
    if (kind === 'flood') {
      this.emit('flood', imp, `Голямо наводнение около ${where}: реката излезе от бреговете си и заля ${places === 1 ? 'селото' : `${places} села`}. Водата отнесе къщи, ниви и запаси.${deadBg}`,
        `Реката преля около ${where}. Хората се качиха на хълма и чакаха водата да се оттегли.`, undefined, c.id, refs,
        [`A great flood around ${whereEn}: the river broke its banks and covered ${places === 1 ? 'the village' : `${places} villages`}. The water took houses, fields and stores.${deadEn}`,
          `The river overflowed around ${whereEn}. People climbed the hill and waited for the water to go down.`],
        [`Ein großes Hochwasser rund um ${this.bDe(c, 'akk')}: Der Fluss trat über die Ufer und überschwemmte ${places === 1 ? 'das Dorf' : `${places} Dörfer`}. Das Wasser riss Häuser, Felder und Vorräte mit.${deadDe}`,
          `Rund um ${this.bDe(c, 'akk')} ist der Fluss über die Ufer getreten. Die Menschen stiegen auf den Hügel und warteten, bis das Wasser zurückging.`]);
    } else if (kind === 'drought') {
      this.emit('drought', imp, `Велика суша около ${where}. Цяло лято не капна дъжд, изворите пресъхнаха, а нивите изгоряха.${deadBg}`,
        `Цяло лято не валя около ${where}. Всички пестят водата и чакат дъжда.`, undefined, c.id, refs,
        [`A great drought around ${whereEn}. Not a drop of rain fell all summer, the springs dried up and the fields burned.${deadEn}`,
          `It did not rain all summer around ${whereEn}. Everyone saves water and waits for the rain.`],
        [`Eine große Dürre rund um ${this.bDe(c, 'akk')}. Den ganzen Sommer fiel kein Tropfen Regen, die Quellen versiegten und die Felder verbrannten.${deadDe}`,
          `Rund um ${this.bDe(c, 'akk')} hat es den ganzen Sommer nicht geregnet. Alle sparen Wasser und warten auf Regen.`]);
    } else if (kind === 'murrain') {
      this.emit('murrain', 1, `Мор по добитъка около ${where}. В ${places === 1 ? 'селото' : `${places} села`} умряха кози, овце и крави, а млякото и месото не стигат.`,
        `Животните около ${where} се разболяха. Овчарите ги лекуват с билки.`, undefined, c.id, refs,
        [`A cattle plague around ${whereEn}. In ${places === 1 ? 'the village' : `${places} villages`} goats, sheep and cows died, and there is not enough milk and meat.`,
          `The animals around ${whereEn} fell ill. The shepherds treat them with herbs.`],
        [`Eine Viehseuche rund um ${this.bDe(c, 'akk')}. In ${places === 1 ? 'dem Dorf' : `${places} Dörfern`} starben Ziegen, Schafe und Kühe, und Milch und Fleisch reichen nicht.`,
          `Rund um ${this.bDe(c, 'akk')} sind die Tiere krank geworden. Die Hirten behandeln sie mit Kräutern.`]);
    } else {
      const modern = this.hasTech(c, 'computer');
      this.emit('epidemic', imp, `${modern ? 'Пандемия' : 'Мор'} плъзна от ${where} към съседните места. Болестта влизаше от къща в къща.${deadBg}`,
        `Много хора около ${where} се разболяха. Лечителите не спят, а всички стоят по домовете си.`, undefined, c.id, refs,
        [`${modern ? 'A pandemic' : 'A plague'} spread from ${whereEn} to the places nearby. The sickness went from house to house.${deadEn}`,
          `Many people around ${whereEn} fell ill. The healers do not sleep, and everyone stays at home.`],
        [`${modern ? 'Eine Pandemie' : 'Eine Seuche'} breitete sich ${this.bWith('von', c)} in die Orte ringsum aus. Die Krankheit ging von Haus zu Haus.${deadDe}`,
          `Rund um ${this.bDe(c, 'akk')} sind viele Menschen krank geworden. Die Heiler schlafen nicht, und alle bleiben zu Hause.`]);
    }
  }

  /** the year turning: an early spring, a spring flood, locusts, a rich harvest, a harvest feast */
  private seasonEvents() {
    const farmers = () => this.s.bands.filter((b) => b.settled && this.hasTech(b, 'agriculture'));
    // early spring (March): the snow goes early and the first greens come
    if (this.month === 2 && this.rng.chance(0.04)) {
      const b = this.rng.pick(this.s.bands);
      b.food *= 1.15;
      this.emit('spring', 1, `Пролетта дойде рано при ${this.bandLabel(b)}. Снегът се стопи, а първите билки поникнаха седмици по-рано.`,
        `При ${this.bandLabel(b)} пролетта дойде рано. Навсякъде цъфтят цветя!`, undefined, b.id, [],
        [`Spring came early to ${this.bandEnLabel(b)}. The snow melted and the first herbs came up weeks ahead.`, `Spring came early to ${this.bandEnLabel(b)}. Flowers are blooming everywhere!`],
        [`Der Frühling kam früh ${this.bWith(b.settled ? 'in' : 'bei', b)}. Der Schnee schmolz, und die ersten Kräuter sprossen Wochen früher.`, `${this.bWith(b.settled ? 'in' : 'bei', b, true)} kam der Frühling früh. Überall blühen Blumen!`]);
    }
    // spring flood (April): a village by the water loses part of its fields
    if (this.month === 3 && this.rng.chance(0.03)) {
      const wet = farmers().filter((b) => this.areaHas(b, 3, 'fish'));
      if (wet.length) {
        const b = this.rng.pick(wet);
        b.food *= 0.7;
        this.emit('flood', 1, `Пролетното пълноводие заля нивите на ${this.bandLabel(b)}. Хората спасиха зърното, но сеитбата трябва да започне отначало.`,
          `Реката преля и заля нивите на ${this.bandLabel(b)}. Всички помагат да се засее наново.`, undefined, b.id, [],
          [`The spring flood covered the fields of ${this.bandEnLabel(b)}. People saved the grain, but the sowing has to start over.`, `The river overflowed and covered the fields of ${this.bandEnLabel(b)}. Everyone helps to sow again.`],
          [`Das Frühjahrshochwasser überschwemmte die Felder ${this.bDe(b, 'gen')}. Die Menschen retteten das Korn, aber die Aussaat muss von vorn beginnen.`,
            `Der Fluss trat über die Ufer und überschwemmte die Felder ${this.bDe(b, 'gen')}. Alle helfen, neu zu säen.`]);
      }
    }
    // locusts (July): rare, a cloud eats a village's fields
    if (this.month === 6 && this.rng.chance(0.012)) {
      const f = farmers();
      if (f.length) {
        const b = this.rng.pick(f);
        b.food *= 0.6;
        this.emit('locusts', 1, `Облак скакалци се спусна над нивите на ${this.bandLabel(b)}. За един ден от житото останаха само стъбла.`,
          `Хиляди скакалци изядоха житото на ${this.bandLabel(b)}. Догодина ще е по-добре!`, undefined, b.id, [],
          [`A cloud of locusts came down on the fields of ${this.bandEnLabel(b)}. In one day only stalks were left of the wheat.`, `Thousands of locusts ate the wheat of ${this.bandEnLabel(b)}. Next year will be better!`],
          [`Eine Wolke Heuschrecken fiel über die Felder ${this.bDe(b, 'gen')} her. An einem einzigen Tag blieben vom Weizen nur die Halme.`,
            `Tausende Heuschrecken haben den Weizen ${this.bDe(b, 'gen')} gefressen. Nächstes Jahr wird es besser!`]);
      }
    }
    // a rich harvest (September)
    if (this.month === 8 && this.rng.chance(0.06)) {
      const f = farmers();
      if (f.length) {
        const b = this.rng.pick(f);
        b.food *= 1.3;
        this.emit('harvest', 1, `Богата реколта при ${this.bandLabel(b)}. Хамбарите са пълни догоре, а зърното ще стигне и за съседите.`,
          `При ${this.bandLabel(b)} житото порасна високо. Хамбарите са пълни!`, undefined, b.id, [],
          [`A rich harvest for ${this.bandEnLabel(b)}. The granaries are full to the top, with grain to spare for the neighbours.`, `The wheat grew tall at ${this.bandEnLabel(b)}. The granaries are full!`],
          [`Eine reiche Ernte ${this.bWith('in', b)}. Die Speicher sind bis oben voll, und das Korn reicht auch für die Nachbarn.`, `${this.bWith('in', b, true)} wuchs der Weizen hoch. Die Speicher sind voll!`]);
      }
    }
    // a harvest feast (October): a village that keeps a calendar celebrates the end of the harvest
    if (this.month === 9 && this.rng.chance(0.04)) {
      const f = farmers().filter((b) => this.hasTech(b, 'calendar'));
      if (f.length) {
        const b = this.rng.pick(f);
        this.emit('feast', 1, `${this.bandLabel(b, true)} отпразнува края на жътвата с песни и хора край огъня до зори.`,
          `${this.bandLabel(b, true)} празнува: песни, танци и пита с мед!`, undefined, b.id, [],
          [`${this.bandEnLabel(b, true)} celebrated the end of the harvest with songs and dancing round the fire until dawn.`, `${this.bandEnLabel(b, true)} is having a feast: songs, dancing and honey bread!`],
          [`${this.bDe(b, 'nom', true)} feierte das Ende der Ernte mit Liedern und Tänzen am Feuer bis zum Morgengrauen.`, `${this.bDe(b, 'nom', true)} feiert: Lieder, Tänze und Honigbrot!`]);
      }
    }
  }

  private checkEra() {
    let era = 0;
    for (const b of this.s.bands) era = Math.max(era, eraOf(this.techSets.get(b.id)!));
    if (era > this.s.era) {
      this.s.era = era;
      const why = ERA_WHY[era] ?? ['', ''];
      this.emit('era', 3, `Започва ${ERAS[era].name}.${why[0] ? ` ${why[0]}` : ''}`, `Нова епоха: ${ERAS[era].name}!`, undefined, undefined, [],
        [`The ${ERAS_EN[era]} begins.${why[1] ? ` ${why[1]}` : ''}`, `A new age: the ${ERAS_EN[era]}!`],
        [`${ERAS_DE_ART[era] === 'das' ? 'Das' : 'Die'} ${ERAS_DE[era]} beginnt.${ERA_WHY_DE[era] ? ` ${ERA_WHY_DE[era]}` : ''}`, `Ein neues Zeitalter: ${ERAS_DE_ART[era]} ${ERAS_DE[era]}!`]);
    }
  }

  private milestones() {
    const marks = [50, 100, 250, 500, 1000, 2500, 5000, 10000, 25000, 50000, 100000];
    const pop = this.s.people.length;
    for (const mk of marks) {
      if (pop >= mk && this.s.milestone < mk) {
        this.s.milestone = mk;
        if (mk > 50) this.emit('milestone', 2, `Хората по света вече са ${mk.toLocaleString('bg-BG')}.`, `Вече има ${mk} души на света!`, undefined, undefined, [],
          [`There are now ${mk.toLocaleString('en-US')} people in the world.`, `There are ${mk} people in the world now!`],
          [`Auf der Welt leben jetzt ${numDe(mk)} Menschen.`, `Jetzt gibt es schon ${numDe(mk)} Menschen auf der Welt!`]);
      }
    }
  }

  // ---------- views ----------

  bandViews(): BandView[] {
    const counts = new Map<number, number>();
    for (const p of this.s.people) counts.set(p.bandId, (counts.get(p.bandId) ?? 0) + 1);
    return this.s.bands.map((b) => ({
      id: b.id, name: b.name, color: b.color, x: b.cx, y: b.cy, settled: b.settled, settlementName: b.settlementName,
      techs: b.techs.map((x) => TECH_BY_ID.get(x)?.name ?? x),
      techIds: b.techs,
      chief: this.chiefView(b),
      founder: b.founder ?? null,
      from: b.from ?? null,
      size: counts.get(b.id) ?? 0,
      food: Math.round(b.food),
      founded: Math.floor(yearOf(b.founded)),
      hasFire: this.hasTech(b, 'fire'),
      dwelling: this.hasTech(b, 'mudbrick') ? 'house' : b.settled ? 'hut' : this.hasTech(b, 'shelter') ? 'tent' : 'none',
      colony: b.colony || undefined,
      isle: b.isle || undefined,
      kingdom: this.kingdomView(b),
      style: this.cultureStyle(b),
    }));
  }

  private chiefView(b: Band): BandView['chief'] {
    const c = b.chiefId ? this.byId.get(b.chiefId) : undefined;
    return c ? { id: c.id, name: this.nameOf(c), title: this.chiefTitleOf(b) } : null;
  }

  personRows(): PersonRow[] {
    const chiefs = new Set(this.s.bands.map((b) => b.chiefId));
    return this.s.people.map((p) => [
      p.id, Math.round(p.x * 10), Math.round(p.y * 10), TASKS.indexOf(p.task), p.bandId, Math.floor(this.ageOf(p)), p.sex, chiefs.has(p.id) ? 1 : 0, p.fame ?? 0,
    ]);
  }

  exploredB64(): string {
    const n = this.t.explored.length;
    const bytes = new Uint8Array((n + 7) >> 3);
    for (let i = 0; i < n; i++) if (this.t.explored[i]) bytes[i >> 3] |= 1 << (i & 7);
    return b64encode(bytes);
  }

  private ref(id: number | null): { id: number; name: string } | null {
    if (!id) return null;
    const p = this.byId.get(id);
    if (p) return { id, name: this.nameOf(p) };
    const d = this.lookupDead(id);
    return d ? { id, name: d.name } : null;
  }

  personDetail(id: number): PersonDetail | null {
    const p = this.byId.get(id);
    if (p) {
      const b = this.bandById.get(p.bandId);
      return {
        id, name: this.nameOf(p), sex: p.sex, bornYear: Math.floor(yearOf(p.born)), diedYear: null,
        age: Math.floor(this.ageOf(p)), cause: null, bandName: b ? this.bandLabel(b, true) : '',
        task: TASK_NAMES[p.task], genes: geneView(p.genes),
        mother: this.ref(p.motherId), father: this.ref(p.fatherId), partner: this.ref(p.partnerId),
        children: p.children.map((c) => ({ ...(this.ref(c) ?? { id: c, name: '?' }), alive: this.byId.has(c) })),
        deeds: p.deeds, generation: p.gen,
        title: b && b.chiefId === p.id ? `${this.chiefTitleOf(b)} на ${b.settlementName ? `${b.settlementName}` : b.name.replace(/^Родът на /, 'рода на ')}` : null,
      };
    }
    const d = this.lookupDead(id);
    if (!d) return null;
    return {
      id, name: d.name, sex: d.sex, bornYear: Math.floor(yearOf(d.born)), diedYear: Math.floor(yearOf(d.died)),
      age: Math.floor((d.died - d.born) / 12), cause: d.cause, bandName: d.bandName, task: '',
      genes: geneView(d.genes as Record<GeneKey, number>),
      mother: this.ref(d.motherId), father: this.ref(d.fatherId), partner: this.ref(d.partnerId),
      children: d.children.map((c) => ({ ...(this.ref(c) ?? { id: c, name: '?' }), alive: this.byId.has(c) })),
      deeds: d.deeds, generation: d.gen, title: null,
    };
  }

  /** a person alive or dead, with the ids of the parents */
  private kin(id: number | null): (TreeNode & { motherId: number | null; fatherId: number | null; partnerId: number | null; kids: number[] }) | null {
    if (!id) return null;
    const p = this.byId.get(id);
    if (p) {
      return { id, name: this.nameOf(p), sex: p.sex, bornYear: Math.floor(yearOf(p.born)), diedYear: null, generation: p.gen, motherId: p.motherId, fatherId: p.fatherId,
        partnerId: p.partnerId, kids: p.children, royal: this.royalOf(id, p.motherId, p.fatherId, p.partnerId) };
    }
    const d = this.lookupDead(id);
    if (!d) return null;
    return { id, name: d.name, sex: d.sex, bornYear: Math.floor(yearOf(d.born)), diedYear: Math.floor(yearOf(d.died)), generation: d.gen, motherId: d.motherId, fatherId: d.fatherId,
      partnerId: d.partnerId, kids: d.children ?? [], royal: this.royalOf(id, d.motherId, d.fatherId, d.partnerId) };
  }

  /** a node without the ids used to walk the tree */
  private node(nid: number | null): TreeNode | null {
    const k = this.kin(nid);
    if (!k) return null;
    const { motherId: _m, fatherId: _f, partnerId: _p, kids: _k, ...node } = k;
    return node;
  }

  /** ancestors `depth` generations up, plus the straight mother and father lines back to the first people */
  familyTree(id: number, depth = 3): FamilyTree | null {
    const up = (nid: number | null, left: number): TreeNode | null => {
      const k = this.kin(nid);
      if (!k) return null;
      const { motherId, fatherId, partnerId: _p, kids: _k, ...node } = k;
      if (left > 0) { node.mother = up(motherId, left - 1); node.father = up(fatherId, left - 1); }
      return node;
    };
    const root = up(id, depth);
    if (!root) return null;
    // downwards: the partner, the children and their children
    const me = this.kin(id)!;
    root.partner = this.node(me.partnerId);
    root.children = me.kids.slice(0, 16).map((c) => {
      const kc = this.kin(c);
      if (!kc) return null;
      const n = this.node(c)!;
      n.children = kc.kids.slice(0, 12).map((g) => this.node(g)).filter((x): x is TreeNode => !!x);
      return n;
    }).filter((x): x is TreeNode => !!x);
    const line = (side: 'motherId' | 'fatherId'): TreeNode[] => {
      const out: TreeNode[] = [];
      let k = this.kin(id);
      for (let n = 0; k && n < 5000; n++) {
        k = this.kin(k[side]);
        if (!k) break;
        const { motherId: _m, fatherId: _f, partnerId: _p, kids: _k, ...node } = k;
        out.push(node);
      }
      return out;
    };
    return { root, motherLine: line('motherId'), fatherLine: line('fatherId') };
  }

  /** finds so far, oldest first */
  secretFinds(): SecretFind[] {
    return (this.s.secrets ?? []).map((f) => (typeof f === 'number' ? { k: f, at: 0 } : f));
  }

  /** someone watching found secret k: the first find goes into the chronicle */
  findSecret(k: number): { first: boolean; found: number; at: number } | null {
    if (!Number.isInteger(k) || k < 0 || k >= SECRET_COUNT) return null;
    const list = this.secretFinds();
    const had = list.find((f) => f.k === k);
    if (had) return { first: false, found: list.length, at: had.at };
    const at = Date.now();
    list.push({ k, at });
    this.s.secrets = list;
    const kind = SECRET_KINDS[k % SECRET_KINDS.length];
    const hero = SECRET_HEROES[k];
    this.emit('secret', 2, `Тайна №${k + 1}, ${hero}: някой, който гледа отгоре, забеляза ${kind.name}. Намерени тайни: ${list.length} от ${SECRET_COUNT}.`,
      `Ура! Намерена е тайна №${k + 1}, ${hero}: ${kind.name}! Тайни: ${list.length} от ${SECRET_COUNT}.`, undefined, undefined, [],
      [`Secret #${k + 1}, ${SECRET_HEROES_EN[k]}: someone watching from above spotted ${SECRET_KINDS_EN[kind.id]?.name ?? kind.name}. Secrets found: ${list.length} of ${SECRET_COUNT}.`,
        `Hooray! Secret #${k + 1} is found, ${SECRET_HEROES_EN[k]}: ${SECRET_KINDS_EN[kind.id]?.name ?? kind.name}! Secrets: ${list.length} of ${SECRET_COUNT}.`],
      [`Geheimnis Nr. ${k + 1}, ${SECRET_HEROES_DE[k]}: Jemand, der von oben zuschaut, hat ${SECRET_KINDS_DE[kind.id]?.akk ?? kind.name} entdeckt. Gefundene Geheimnisse: ${list.length} von ${SECRET_COUNT}.`,
        `Hurra! Geheimnis Nr. ${k + 1} ist gefunden, ${SECRET_HEROES_DE[k]}: ${SECRET_KINDS_DE[kind.id]?.name ?? kind.name}! Geheimnisse: ${list.length} von ${SECRET_COUNT}.`]);
    return { first: true, found: list.length, at };
  }

  /** notable living people: discoverers, leaders, the oldest */
  heroes(): { id: number; name: string; age: number; band: string; deeds: string[] }[] {
    return this.s.people
      .filter((p) => p.deeds.length > 0 || this.ageOf(p) > 60)
      .sort((a, b) => b.deeds.length - a.deeds.length || this.ageOf(b) - this.ageOf(a))
      .slice(0, 30)
      .map((p) => ({ id: p.id, name: this.nameOf(p), age: Math.floor(this.ageOf(p)), band: this.bandById.has(p.bandId) ? this.bandLabel(this.bandById.get(p.bandId)!, true) : '', deeds: p.deeds }));
  }

  /** prepare state for saving */
  serialize(): SimState {
    this.s.rng = this.rng.s;
    this.s.plants = Array.from(this.t.plants, (v) => Math.round(v * 100));
    this.s.game = Array.from(this.t.game, (v) => Math.round(v * 100));
    this.s.explored = this.exploredB64();
    this.s.trees = Buffer.from(this.trees).toString('base64');
    this.s.roads = Buffer.from(this.roads).toString('base64');
    return this.s;
  }

  get mars(): boolean {
    return this.s.planet === 'mars';
  }

  /** the second world: empty until the first ship lands; the same size and calendar as the Earth */
  static newMars(earth: Simulation): Simulation {
    const seed = (earth.s.seed ^ 0x6d617273) >>> 0;
    const st: SimState = {
      version: 1, worldId: `${earth.s.worldId}-mars`, seed, size: earth.s.size ?? OLD_SIZE, tick: earth.s.tick,
      rng: new Rng(seed).s, nextPersonId: 1, nextBandId: 1, nextEventId: 1, people: [], bands: [], usedPlaces: [], usedBands: [],
      discovered: [...earth.s.discovered], totalBorn: 0, totalDied: 0, era: earth.s.era, startedAt: Date.now(), milestone: 0,
      plants: [], game: [], explored: '', planet: 'mars',
    };
    return new Simulation(st);
  }

  /** ships leaving for the other world this year, for the server to carry over */
  outbox: Voyage[] = [];

  /** a family-sized group leaves: whole couples with their small children */
  private takeFamilies(from: Band[], members: Map<number, Person[]>, want: number): Person[] {
    const out = new Set<Person>();
    for (const b of this.rng.shuffle([...from])) {
      for (const p of this.rng.shuffle([...(members.get(b.id) ?? [])])) {
        if (out.size >= want) break;
        const a = this.ageOf(p);
        if (out.has(p) || p.fame || a < 18 || a > 45 || b.chiefId === p.id) continue;
        out.add(p);
        const partner = p.partnerId ? this.byId.get(p.partnerId) : undefined;
        if (partner && !partner.fame && partner.bandId === p.bandId) out.add(partner);
        for (const cid of p.children) {
          const c = this.byId.get(cid);
          if (c && !c.fame && c.bandId === p.bandId && this.ageOf(c) < 14) out.add(c);
        }
      }
      if (out.size >= want) break;
    }
    return [...out];
  }

  /** tiles of every land region, for telling a small island from a big land */
  private regionTiles?: Map<number, number>;
  private regionSize(r: number): number {
    if (!this.regionTiles) {
      this.regionTiles = new Map();
      for (const x of this.regions) if (x >= 0) this.regionTiles.set(x, (this.regionTiles.get(x) ?? 0) + 1);
    }
    return this.regionTiles.get(r) ?? 0;
  }

  /** open sea a ship can sail on: no land, and not a map nobody has reached yet */
  private sea(i: number): boolean {
    return isWater(this.t.biome[i]) && !this.t.closed?.[i];
  }

  /** a water tile next to the town, or -1 */
  private harbour(b: Band): number {
    const bx = Math.round(b.cx), by = Math.round(b.cy);
    for (let d = 1; d <= 4; d++) for (let dy = -d; dy <= d; dy++) for (let dx = -d; dx <= d; dx++) {
      if (inBounds(bx + dx, by + dy) && this.sea(idx(bx + dx, by + dy))) return idx(bx + dx, by + dy);
    }
    return -1;
  }

  /** every sea tile reachable from `start`, with the way back to it */
  private seaFrom(start: number): { prev: Int32Array; seen: number[] } {
    const prev = new Int32Array(W * H).fill(-2);
    prev[start] = -1;
    const q = [start];
    for (let qi = 0; qi < q.length; qi++) {
      const c = q[qi], cx = c % W, cy = (c - cx) / W;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
        const nx = cx + dx, ny = cy + dy;
        if (!inBounds(nx, ny)) continue;
        const n = idx(nx, ny);
        if (prev[n] !== -2 || !this.sea(n)) continue;
        if (dx && dy && (!this.sea(idx(cx + dx, cy)) || !this.sea(idx(cx, cy + dy)))) continue;
        prev[n] = c;
        q.push(n);
      }
    }
    return { prev, seen: q };
  }

  private wayTo(prev: Int32Array, end: number): number[] {
    const path: number[] = [];
    for (let c = end; c !== -1; c = prev[c]) path.push(c);
    return path.reverse();
  }

  /** a way over the sea to an empty shore of another land (on map `only` if given), or null */
  private seaRoute(start: number, home: number, self: Band, only?: [number, number]): { path: number[]; dest: [number, number]; region: number } | null {
    const { prev, seen } = this.seaFrom(start);
    const taken = new Set<number>();
    for (const o of this.s.bands) if (inBounds(Math.round(o.cx), Math.round(o.cy))) taken.add(this.regions[idx(Math.round(o.cx), Math.round(o.cy))]);
    for (const sh of this.s.fleet ?? []) if (sh.dest[0] >= 0) taken.add(this.regions[idx(sh.dest[0], sh.dest[1])]);
    // landings on lands nobody lives on: the first water tile reached next to each of them
    const shores = new Map<number, [number, number]>();
    for (const c of seen) {
      const cx = c % W, cy = (c - cx) / W;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = cx + dx, ny = cy + dy;
        if (!inBounds(nx, ny)) continue;
        const n = idx(nx, ny), r = this.regions[n];
        if (r < 0 || r === home || taken.has(r) || shores.has(r)) continue;
        if (only) { const [mx, my] = this.mapAt(nx, ny); if (mx !== only[0] || my !== only[1]) continue; }
        shores.set(r, [c, n]);
      }
    }
    // the best of a few new lands: room for a village and wood, the nearer the better
    let best: { path: number[]; dest: [number, number]; region: number } | null = null, bestS = 0;
    for (const [r, [w, land]] of this.rng.shuffle([...shores]).slice(0, 12)) {
      const lx = land % W, ly = (land - lx) / W;
      let spot: [number, number] | null = null, sc = 0;
      for (let k = 0; k < 20; k++) {
        const x = lx + this.rng.int(-4, 4), y = ly + this.rng.int(-4, 4);
        if (!inBounds(x, y) || this.regions[idx(x, y)] !== r) continue;
        const v = this.campScore(x, y, 3, self);
        if (v > sc) { sc = v; spot = [x, y]; }
      }
      if (!spot) continue;
      const path = this.wayTo(prev, w);
      const v = sc / (1 + path.length / this.mapSize);
      if (v > bestS) { bestS = v; best = { path, dest: spot, region: r }; }
    }
    return best;
  }

  /** a way to the edge of the known world, where a map nobody has seen yet begins; the map behind it, or null */
  private edgeRoute(start: number): { path: number[]; map: [number, number] } | null {
    const { prev, seen } = this.seaFrom(start);
    const ends: { c: number; map: [number, number] }[] = [];
    for (const c of seen) {
      const cx = c % W, cy = (c - cx) / W;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = cx + dx, ny = cy + dy;
        if (inBounds(nx, ny) && !this.t.closed?.[idx(nx, ny)]) continue;
        const map = this.mapAt(nx, ny);
        if (Math.abs(map[0]) > GRID_REACH || Math.abs(map[1]) > GRID_REACH || this.isOpen(map[0], map[1])) continue;
        ends.push({ c, map });
      }
    }
    if (!ends.length) return null;
    // one unknown direction, then the nearest way to it
    const maps = [...new Set(ends.map((e) => mapKey(e.map[0], e.map[1])))];
    const pick = this.rng.pick(maps);
    const end = ends.find((e) => mapKey(e.map[0], e.map[1]) === pick)!;
    return { path: this.wayTo(prev, end.c), map: end.map };
  }

  private newShip(b: Band, list: Person[], path: number[], dest: [number, number], isle: boolean, explore?: [number, number]): Sea {
    const sh: Sea = {
      id: (this.s.ships = (this.s.ships ?? 0) + 1), x: path[0] % W, y: Math.floor(path[0] / W), way: [], path,
      people: list, techs: [...b.techs], from: b.id, fromBg: this.bandLabel(b), fromEn: this.bandEnLabel(b), fromDe: this.bDe(b, 'dat'),
      dest, isle, culture: b.culture, color: b.color, explore,
    };
    (this.s.fleet ??= []).push(sh);
    return sh;
  }

  /** once a year a big town that knows the sail may send a ship of families to a land of their own; when there is no
   *  free land left within reach, now and then a ship sails off to the edge of the known world */
  private setSail(members: Map<number, Person[]>) {
    const fleet = (this.s.fleet ??= []);
    for (const b of this.rng.shuffle(this.s.bands.filter((o) => o.settled && this.hasTech(o, 'sailing') && (members.get(o.id)?.length ?? 0) >= 60))) {
      if (fleet.length >= 3) return;
      if (!this.rng.chance(0.04)) continue;
      const start = this.harbour(b);
      if (start < 0) continue;
      const route = this.seaRoute(start, this.regions[idx(Math.round(b.cx), Math.round(b.cy))], b);
      // the edge of the world: one ship at a time, and a new map at most every 25 years or so
      const exploring = fleet.some((x) => x.explore) || this.year - (this.s.lastMapYear ?? -1e9) < 25;
      const edge = !route && !exploring && this.rng.chance(0.3) ? this.edgeRoute(start) : null;
      if (!route && !edge) continue;
      const list = this.takeFamilies([b], members, this.rng.int(12, 30));
      if (list.length < 8) continue;
      this.depart(list);
      if (route) this.newShip(b, list, route.path, route.dest, this.regionSize(route.region) < 700);
      else this.newShip(b, list, edge!.path, [-1, -1], false, edge!.map);
      this.emit('sail', 1, `Кораб от ${this.bandLabel(b)} отплава с ${list.length} души да търси нова земя ${edge ? 'отвъд края на познатия свят' : 'отвъд морето'}.`,
        `${list.length} души от ${this.bandLabel(b)} отплаваха с кораб да търсят нова земя!`, undefined, b.id, [],
        [`A ship from ${this.bandEnLabel(b)} set sail with ${list.length} people to find a new land ${edge ? 'beyond the edge of the known world' : 'over the sea'}.`, `${list.length} people from ${this.bandEnLabel(b)} sailed away to find a new land!`],
        [`Ein Schiff ${this.bWith('aus', b)} stach mit ${list.length} Menschen in See, um ein neues Land ${edge ? 'jenseits des Randes der bekannten Welt' : 'übers Meer'} zu finden.`, `${list.length} Menschen ${this.bWith('aus', b)} segeln los, um ein neues Land zu finden!`]);
    }
  }

  /** the ships at sea: slow, so that crossing one map takes two years; they see the coasts they pass */
  private sail() {
    const fleet = this.s.fleet;
    if (!fleet?.length) return;
    const stepTiles = Math.max(4, Math.round(this.mapSize / 24));
    for (const sh of [...fleet]) {
      sh.way = sh.path.splice(0, stepTiles);
      for (const c of sh.way) {
        const cx = c % W, cy = (c - cx) / W;
        for (let y = cy - 4; y <= cy + 4; y++) for (let x = cx - 4; x <= cx + 4; x++) {
          if (!inBounds(x, y) || (x - cx) ** 2 + (y - cy) ** 2 > 16) continue;
          const i = idx(x, y);
          if (!this.t.explored[i] && !this.t.closed?.[i]) { this.t.explored[i] = 1; this.exploredDirty = true; }
        }
      }
      const last = sh.way[sh.way.length - 1];
      if (last !== undefined) { sh.x = last % W; sh.y = Math.floor(last / W); }
      if (sh.path.length) continue;
      if (sh.explore) this.beyond(sh);
      else this.landfall(sh);
    }
    this.s.fleet = (this.s.fleet ?? []).filter((x) => x.path.length);
  }

  /** a ship at the edge of the known world: the next map opens, and the ship goes on to a shore there */
  private beyond(sh: Sea) {
    const [gx, gy] = sh.explore!;
    sh.explore = undefined;
    const opened = this.openMap(gx, gy);
    if (opened) this.s.lastMapYear = this.year;
    const self = this.bandById.get(sh.from) ?? this.s.bands[0];
    const here = idx(sh.x, sh.y);
    const route = self ? this.seaRoute(here, -2, self, [gx, gy]) ?? this.seaRoute(here, -2, self) : null;
    if (opened) {
      const dir = this.dirName(gx, gy);
      this.emit('newland', 3, `Кораб от ${sh.fromBg} стигна до края на познатия свят и продължи на ${dir[0]}. Отвъд него се откриха нови морета и брегове.`,
        `Кораб отплава отвъд края на картата и откри нов свят на ${dir[0]}!`, undefined, sh.from, [],
        [`A ship from ${sh.fromEn} reached the edge of the known world and sailed on to the ${dir[1]}. New seas and shores lay beyond.`, `A ship sailed past the edge of the map and found a new world to the ${dir[1]}!`],
        [`Ein Schiff aus ${sh.fromDe} erreichte den Rand der bekannten Welt und segelte weiter nach ${dir[2]}. Dahinter lagen neue Meere und Küsten.`, `Ein Schiff ist über den Rand der Karte gesegelt und hat im ${dir[3]} eine neue Welt gefunden!`]);
      this.spreadOut(gx, gy);
    }
    if (route) {
      sh.path = route.path.slice(1);
      sh.dest = route.dest;
      sh.isle = this.regionSize(route.region) < 700;
      if (!sh.path.length) this.landfall(sh);
      return;
    }
    // nowhere to land: they go home
    const home = this.bandById.get(sh.from);
    if (home) {
      for (const p of sh.people) { p.bandId = home.id; p.x = home.cx; p.y = home.cy; p.task = 'travel'; this.s.people.push(p); this.byId.set(p.id, p); }
    }
  }

  private dirName(gx: number, gy: number): [string, string, string, string] {
    const ns = gy < 0 ? 0 : gy > 0 ? 1 : -1, ew = gx < 0 ? 0 : gx > 0 ? 1 : -1;
    const bg = [ns === 0 ? 'север' : ns === 1 ? 'юг' : '', ew === 0 ? 'запад' : ew === 1 ? 'изток' : ''].filter(Boolean).join('о');
    const en = [ns === 0 ? 'north' : ns === 1 ? 'south' : '', ew === 0 ? 'west' : ew === 1 ? 'east' : ''].filter(Boolean).join('-');
    const de = [ns === 0 ? 'Norden' : ns === 1 ? 'Süden' : '', ew === 0 ? 'Westen' : ew === 1 ? 'Osten' : ''].filter(Boolean).join('');
    const deIn = de.replace('NordenWesten', 'Nordwesten').replace('NordenOsten', 'Nordosten').replace('SüdenWesten', 'Südwesten').replace('SüdenOsten', 'Südosten');
    return [bg, en, deIn, deIn];
  }

  /** a new world was found: some of the smallest villages by the sea pack up and sail there, so the people spread out */
  private spreadOut(gx: number, gy: number) {
    const size = new Map<number, number>();
    for (const p of this.s.people) size.set(p.bandId, (size.get(p.bandId) ?? 0) + 1);
    const small = this.s.bands
      .filter((b) => (size.get(b.id) ?? 0) >= 6 && !b.kingdom && !b.colony && this.harbour(b) >= 0)
      .sort((a, b) => (size.get(a.id) ?? 0) - (size.get(b.id) ?? 0))
      .slice(0, Math.max(2, Math.min(8, Math.round(this.s.bands.length * 0.08))));
    let n = 0;
    for (const b of small) {
      if ((this.s.fleet?.length ?? 0) >= 12) break;
      const route = this.seaRoute(this.harbour(b), this.regions[idx(Math.round(b.cx), Math.round(b.cy))], b, [gx, gy]);
      if (!route) continue;
      // the whole village goes: its people and its name, it is the same village on a new shore
      const list = this.s.people.filter((p) => p.bandId === b.id);
      this.depart(list);
      const sh = this.newShip(b, list, route.path, route.dest, this.regionSize(route.region) < 700);
      sh.band = b;
      this.s.bands.splice(this.s.bands.indexOf(b), 1);
      this.bandById.delete(b.id);
      this.techSets.delete(b.id);
      n++;
    }
    const one = n === 1;
    if (n) this.emit('sail', 2, one ? 'Едно малко село по брега натовари лодките си и отплава към новия свят.' : `${n} малки села по брега натовариха лодките си и отплаваха към новия свят.`,
      one ? 'Едно малко село отплава към новия свят!' : `${n} малки села отплаваха към новия свят!`, undefined, undefined, [],
      [one ? 'A small village by the sea loaded its boats and sailed for the new world.' : `${n} small villages by the sea loaded their boats and sailed for the new world.`, one ? 'A small village sailed off to the new world!' : `${n} small villages sailed off to the new world!`],
      [one ? 'Ein kleines Dorf an der Küste belud seine Boote und segelte in die neue Welt.' : `${n} kleine Dörfer an der Küste beluden ihre Boote und segelten in die neue Welt.`, one ? 'Ein kleines Dorf ist in die neue Welt gesegelt!' : `${n} kleine Dörfer sind in die neue Welt gesegelt!`]);
  }

  /** the ship reaches the new land: the families found a village (on a small island it stays a village) */
  private landfall(sh: Sea) {
    let [x, y] = sh.dest;
    const free = (fx: number, fy: number) => inBounds(fx, fy) && this.walkable(idx(fx, fy)) && !this.s.bands.some((o) => Math.hypot(o.cx - fx, o.cy - fy) < 7);
    if (!free(x, y)) {
      // somebody got there first: any free spot on the same land
      const r = this.regions[idx(x, y)];
      for (let k = 0; k < 40; k++) {
        const nx = x + this.rng.int(-8, 8), ny = y + this.rng.int(-8, 8);
        if (free(nx, ny) && this.regions[idx(nx, ny)] === r) { x = nx; y = ny; break; }
      }
    }
    // a whole village that moved keeps its name; settlers found a new one
    const moved = sh.band;
    let nb: Band;
    if (moved) {
      nb = moved;
      nb.cx = x; nb.cy = y; nb.scout = null; nb.kingdom = null;
      this.s.bands.push(nb);
      this.bandById.set(nb.id, nb);
      this.techSets.set(nb.id, new Set(nb.techs));
    } else {
      nb = this.newBand(x, y, undefined, sh.techs);
      nb.culture = sh.culture;
      nb.color = sh.color;
      const from = this.bandById.get(sh.from);
      if (from) nb.from = { id: from.id, name: this.bandLabel(from, true) };
      nb.food = sh.people.length * 6;
    }
    nb.colony = true;
    nb.isle = sh.isle || undefined;
    this.clearAround(nb.cx, nb.cy, 1);
    const year = formatYear(this.year);
    for (const p of sh.people) {
      p.bandId = nb.id;
      p.x = nb.cx + this.rng.range(-1.5, 1.5);
      p.y = nb.cy + this.rng.range(-1.5, 1.5);
      p.task = 'travel';
      p.deeds.push(moved ? `Отплава с цялото село към нова земя (${year})` : `Преплава морето и основа ново село (${year})`);
      this.s.people.push(p);
      this.byId.set(p.id, p);
    }
    const n = sh.people.length;
    if (moved) {
      this.emit('colony', 2, `${this.bandLabel(nb, true)} стигна с лодките си до нова земя и се засели там.${sh.isle ? ' Островът е малък: тук ще има само село.' : ''}`,
        `${this.bandLabel(nb, true)} се засели на нова земя!`, undefined, nb.id, [],
        [`${this.bandEnLabel(nb, true)} reached a new land in its boats and settled there.${sh.isle ? ' The island is small: there will only ever be a village here.' : ''}`, `${this.bandEnLabel(nb, true)} settled in a new land!`],
        [`${this.bDe(nb, 'nom', true)} erreichte mit seinen Booten ein neues Land und ließ sich dort nieder.${sh.isle ? ' Die Insel ist klein: Hier wird es immer nur ein Dorf geben.' : ''}`, `${this.bDe(nb, 'nom', true)} hat sich in einem neuen Land niedergelassen!`]);
      return;
    }
    const leader = sh.people.filter((p) => p.sex === 0).sort((a, b) => a.born - b.born)[0];
    if (leader) { nb.chiefId = leader.id; nb.founder = { id: leader.id, name: this.nameOf(leader) }; }
    if (this.hasTech(nb, 'agriculture')) this.settleNew(nb);
    const small = sh.isle ? ' Островът е малък: тук ще има само село.' : '';
    this.emit('colony', 2, `Кораб от ${sh.fromBg} стигна до непозната земя. ${n} души слязоха на брега и основаха ${this.bandLabel(nb)}.${small}`,
      `Кораб стигна до нова земя! ${n} души основаха там ${this.bandLabel(nb)}.`, leader?.id, nb.id, [],
      [`A ship from ${sh.fromEn} reached an unknown land. ${n} people went ashore and founded ${this.bandEnLabel(nb)}.${sh.isle ? ' The island is small: there will only ever be a village here.' : ''}`,
        `A ship reached a new land! ${n} people founded ${this.bandEnLabel(nb)} there.`],
      [`Ein Schiff aus ${sh.fromDe} erreichte ein unbekanntes Land. ${n} Menschen gingen an Land und gründeten ${this.bDe(nb, 'akk')}.${sh.isle ? ' Die Insel ist klein: Hier wird es immer nur ein Dorf geben.' : ''}`,
        `Ein Schiff hat ein neues Land erreicht! ${n} Menschen gründeten dort ${this.bDe(nb, 'akk')}.`]);
  }

  /** the ships at sea, for the map */
  seaViews(): { id: number; x: number; y: number; way: [number, number][]; techs: string[] }[] {
    return (this.s.fleet ?? []).map((sh) => ({ id: sh.id, x: sh.x, y: sh.y, way: sh.way.map((c) => [c % W, Math.floor(c / W)] as [number, number]), techs: sh.techs }));
  }

  /** they leave this world: not dead, just gone (families that stay behind lose a partner) */
  private depart(list: Person[]) {
    const going = new Set(list.map((p) => p.id));
    for (const p of list) {
      this.byId.delete(p.id);
      const b = this.bandById.get(p.bandId);
      if (b && b.chiefId === p.id) b.chiefId = null;
    }
    this.s.people = this.s.people.filter((p) => !going.has(p.id));
    for (const p of this.s.people) if (p.partnerId && going.has(p.partnerId)) p.partnerId = null;
  }

  /** once a year: from the spaceports of the Earth a ship to Mars, and now and then one comes back */
  private voyages(members: Map<number, Person[]>) {
    if (this.mars) {
      if (this.s.people.length < 300 || !this.rng.chance(0.06)) return;
      const from = this.s.bands.filter((b) => (members.get(b.id)?.length ?? 0) > 40);
      if (!from.length) return;
      const list = this.takeFamilies(from, members, this.rng.int(6, 24));
      if (!list.length) return;
      const b = this.bandById.get(list[0].bandId)!;
      this.depart(list);
      this.s.ships = (this.s.ships ?? 0) + 1;
      this.outbox.push({ people: list, techs: b.techs, from: this.bandLabel(b), fromEn: this.bandEnLabel(b), fromDe: this.bDe(b, 'dat'), first: false });
      this.emit('ship', 2, `Кораб излетя от ${this.bandLabel(b)} към Земята с ${list.length} души. Някои се връщат при роднините си, а други искат да видят морето.`,
        `${list.length} души от ${this.bandLabel(b)} полетяха към Земята. Ще видят истинско море!`, undefined, b.id, [],
        [`A ship took off from ${this.bandEnLabel(b)} for the Earth with ${list.length} people. Some go back to their families, others want to see the sea.`,
          `${list.length} people from ${this.bandEnLabel(b)} flew to the Earth. They will see a real sea!`],
        [`Ein Schiff startete ${this.bWith('von', b)} zur Erde, mit ${list.length} Menschen an Bord. Manche kehren zu ihren Familien zurück, andere wollen das Meer sehen.`,
          `${list.length} Menschen ${this.bWith('aus', b)} sind zur Erde geflogen. Sie werden ein echtes Meer sehen!`]);
      return;
    }
    const ports = this.s.bands.filter((b) => b.settled && this.hasTech(b, 'mars_colony') && (members.get(b.id)?.length ?? 0) >= 40);
    if (!ports.length) return;
    const first = !this.s.ships;
    const star = ports.some((b) => this.hasTech(b, 'starship'));
    if (!first && !this.rng.chance(star ? 0.5 : 0.25)) return;
    const want = first ? 100 : star ? this.rng.int(60, 150) : this.rng.int(20, 60);
    const port = this.rng.pick(ports);
    const list = this.takeFamilies([port, ...ports.filter((b) => b !== port)], members, want);
    if (list.length < 10) return;
    this.depart(list);
    this.s.ships = (this.s.ships ?? 0) + 1;
    this.outbox.push({ people: list, techs: port.techs, from: this.bandLabel(port), fromEn: this.bandEnLabel(port), fromDe: this.bDe(port, 'dat'), first });
    if (first) {
      this.emit('ship', 3, `Първият кораб към Марс излетя от ${this.bandLabel(port)}. На борда му има ${list.length} души, цели семейства с децата си. Те няма да се върнат скоро: отиват да построят нов свят под куполи.`,
        `Ракета отнесе ${list.length} души от ${this.bandLabel(port)} до Марс! Там ще живеят под голям стъклен купол.`, undefined, port.id, [],
        [`The first ship to Mars took off from ${this.bandEnLabel(port)}. On board are ${list.length} people, whole families with their children. They will not come back soon: they are going to build a new world under domes.`,
          `A rocket took ${list.length} people from ${this.bandEnLabel(port)} to Mars! They will live there under a big glass dome.`],
        [`Das erste Schiff zum Mars startete ${this.bWith('von', port)}. An Bord sind ${list.length} Menschen, ganze Familien mit ihren Kindern. Sie kommen so bald nicht zurück: Sie bauen eine neue Welt unter Kuppeln.`,
          `Eine Rakete hat ${list.length} Menschen ${this.bWith('aus', port)} zum Mars gebracht! Dort leben sie unter einer großen Glaskuppel.`]);
    } else {
      this.emit('ship', 2, `Още един кораб излетя от ${this.bandLabel(port)} към Марс с ${list.length} души.`,
        `${list.length} души от ${this.bandLabel(port)} полетяха към Марс!`, undefined, port.id, [],
        [`Another ship took off from ${this.bandEnLabel(port)} for Mars with ${list.length} people.`, `${list.length} people from ${this.bandEnLabel(port)} flew to Mars!`],
        [`Wieder startete ein Schiff ${this.bWith('von', port)} zum Mars, mit ${list.length} Menschen an Bord.`, `${list.length} Menschen ${this.bWith('aus', port)} sind zum Mars geflogen!`]);
    }
  }

  /** a ship from the other world lands: new ids here, families stay families */
  receive(v: Voyage) {
    if (!v.people.length) return;
    let b: Band;
    const fresh = this.mars && (v.first || !this.s.bands.length || this.rng.chance(0.35));
    if (fresh) {
      // a new dome on flat ground, away from the others
      let at = { x: Math.floor(W / 2), y: Math.floor(H / 2) };
      for (let k = 0; k < 60; k++) {
        const x = this.rng.int(20, W - 20), y = this.rng.int(20, H - 20);
        if (this.t.biome[idx(x, y)] !== Biome.Desert) continue;
        if (this.s.bands.some((o) => Math.hypot(o.cx - x, o.cy - y) < 14)) continue;
        if (!this.s.bands.length && Math.hypot(x - W / 2, y - H / 2) > W / 4) continue;
        at = { x, y };
        break;
      }
      b = this.newBand(at.x, at.y, undefined, v.techs);
      this.settleNew(b);
    } else {
      const homes = this.mars ? this.s.bands : this.s.bands.filter((o) => o.settled && this.hasTech(o, 'mars_colony'));
      b = this.rng.pick(homes.length ? homes : this.s.bands.filter((o) => o.settled).length ? this.s.bands.filter((o) => o.settled) : this.s.bands);
      for (const tech of v.techs) if (!this.hasTech(b, tech)) this.addTech(b, tech);
    }
    const ids = new Map<number, number>();
    for (const p of v.people) ids.set(p.id, this.s.nextPersonId++);
    const map = (id: number | null) => (id != null ? ids.get(id) ?? null : null);
    for (const p of v.people) {
      const np: Person = {
        ...p, id: ids.get(p.id)!, bandId: b.id, motherId: map(p.motherId), fatherId: map(p.fatherId), partnerId: map(p.partnerId),
        children: p.children.map((c) => ids.get(c)).filter((c): c is number => c != null), x: b.cx, y: b.cy, task: 'travel',
        deeds: [...p.deeds, this.mars ? `Отлетя за Марс (${formatYear(this.year)})` : `Върна се от Марс (${formatYear(this.year)})`],
      };
      this.s.people.push(np);
      this.byId.set(np.id, np);
    }
    for (const tech of v.techs) if (!this.s.discovered.includes(tech)) this.s.discovered.push(tech);
    this.s.ships = (this.s.ships ?? 0) + 1;
    const n = v.people.length;
    if (this.mars && fresh) {
      this.emit('ship', 3, `${v.first ? 'Първият кораб' : 'Кораб'} от Земята кацна на Марс. ${n} души от ${v.from} построиха купол и основаха ${this.bandLabel(b)}.${v.first ? ' Тук започва летописът на червената планета.' : ''}`,
        `${n} души пристигнаха от Земята и построиха голям стъклен купол: ${this.bandLabel(b)}!`, undefined, b.id, [],
        [`${v.first ? 'The first ship' : 'A ship'} from the Earth landed on Mars. ${n} people from ${v.fromEn} built a dome and founded ${this.bandEnLabel(b)}.${v.first ? ' Here the chronicle of the red planet begins.' : ''}`,
          `${n} people came from the Earth and built a big glass dome: ${this.bandEnLabel(b, true)}!`],
        [`${v.first ? 'Das erste Schiff' : 'Ein Schiff'} von der Erde landete auf dem Mars. ${n} Menschen aus ${v.fromDe} bauten eine Kuppel und gründeten ${this.bDe(b, 'akk')}.${v.first ? ' Hier beginnt die Chronik des roten Planeten.' : ''}`,
          `${n} Menschen sind von der Erde gekommen und haben eine große Glaskuppel gebaut: ${this.bDe(b, 'nom')}!`]);
    } else if (this.mars) {
      this.emit('ship', 2, `Кораб от Земята кацна при ${this.bandLabel(b)}. ${n} души от ${v.from} заживяха под купола.`,
        `${n} нови хора пристигнаха от Земята в ${this.bandLabel(b)}!`, undefined, b.id, [],
        [`A ship from the Earth landed at ${this.bandEnLabel(b)}. ${n} people from ${v.fromEn} now live under the dome.`, `${n} new people came from the Earth to ${this.bandEnLabel(b)}!`],
        [`Ein Schiff von der Erde landete ${this.bWith('bei', b)}. ${n} Menschen leben jetzt unter der Kuppel.`, `${n} neue Menschen sind von der Erde ${this.bWith('in', b)} angekommen!`]);
    } else {
      this.emit('ship', 2, `Кораб от Марс кацна в ${this.bandLabel(b)}. ${n} души от ${v.from} се върнаха на Земята.`,
        `${n} души се върнаха от Марс в ${this.bandLabel(b)}. Разказват за червения пясък!`, undefined, b.id, [],
        [`A ship from Mars landed at ${this.bandEnLabel(b)}. ${n} people from ${v.fromEn} came back to the Earth.`, `${n} people came back from Mars to ${this.bandEnLabel(b)}. They tell of the red sand!`],
        [`Ein Schiff vom Mars landete ${this.bWith('in', b)}. ${n} Menschen sind zur Erde zurückgekehrt.`, `${n} Menschen sind vom Mars ${this.bWith('in', b)} zurückgekommen. Sie erzählen vom roten Sand!`]);
    }
  }

  /** life under the domes: dust storms and a good year in the greenhouses */
  private marsEvents() {
    if (!this.s.bands.length) return;
    if (this.rng.chance(0.006)) {
      const b = this.rng.pick(this.s.bands);
      b.food *= 0.7;
      this.emit('storm', 1, `Прашна буря покри ${this.bandLabel(b)}. Седмици наред слънцето не се виждаше, а хората чистеха прозорците на оранжериите.`,
        `Голяма прашна буря при ${this.bandLabel(b)}. Всички си стоят под купола и играят игри!`, undefined, b.id, [],
        [`A dust storm covered ${this.bandEnLabel(b)}. For weeks the sun could not be seen, and people kept cleaning the greenhouse windows.`,
          `A big dust storm at ${this.bandEnLabel(b)}. Everyone stays under the dome and plays games!`],
        [`Ein Staubsturm bedeckte ${this.bDe(b, 'akk')}. Wochenlang war die Sonne nicht zu sehen, und die Menschen putzten die Fenster der Gewächshäuser.`,
          `Ein großer Staubsturm ${this.bWith('bei', b)}. Alle bleiben unter der Kuppel und spielen Spiele!`]);
    }
  }

  get extinct(): boolean {
    return this.s.people.length === 0;
  }
}

function dist(a: Band, b: Band): number {
  return Math.hypot(a.cx - b.cx, a.cy - b.cy);
}

function avg<T>(arr: T[], f: (x: T) => number): number {
  return arr.length ? arr.reduce((s, x) => s + f(x), 0) / arr.length : 0;
}

function topGene(g: Record<GeneKey, number>): string | null {
  let best: string | null = null, v = 0.62;
  for (const k of ['str', 'int', 'cur', 'soc', 'hea'] as const) if (g[k] > v) { v = g[k]; best = k; }
  return best;
}

function geneView(g: Record<GeneKey, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const k of GENE_KEYS) out[GENE_NAMES[k]] = Math.round((g[k] ?? 0.5) * 100);
  return out;
}

export { H, W };
