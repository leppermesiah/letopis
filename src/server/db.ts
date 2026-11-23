import { DatabaseSync } from 'node:sqlite';
import { ChronicleEntry, GoneBand } from '../shared/types';
import type { DeadRecord } from './sim/sim';

export class Store {
  db: DatabaseSync;

  constructor(file: string) {
    this.db = new DatabaseSync(file);
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA synchronous = NORMAL;
      CREATE TABLE IF NOT EXISTS chronicle (
        world TEXT NOT NULL, id INTEGER NOT NULL, tick INTEGER, year INTEGER, kind TEXT, importance INTEGER,
        text TEXT, kids TEXT, person INTEGER, band INTEGER, PRIMARY KEY (world, id)
      );
      CREATE INDEX IF NOT EXISTS chronicle_imp ON chronicle (world, importance, id);
      CREATE INDEX IF NOT EXISTS chronicle_year ON chronicle (world, year);
      CREATE TABLE IF NOT EXISTS dead (world TEXT NOT NULL, id INTEGER NOT NULL, json TEXT, PRIMARY KEY (world, id));
      CREATE TABLE IF NOT EXISTS stats (
        world TEXT NOT NULL, tick INTEGER, year INTEGER, population INTEGER, bands INTEGER, era INTEGER, techs INTEGER,
        PRIMARY KEY (world, tick)
      );
      CREATE TABLE IF NOT EXISTS gone_bands (world TEXT NOT NULL, id INTEGER NOT NULL, json TEXT, PRIMARY KEY (world, id));
      CREATE TABLE IF NOT EXISTS worlds (id TEXT PRIMARY KEY, started INTEGER, ended INTEGER, summary TEXT);
    `);
    // v1.11: names in the chronicle link to people and bands
    const cols = this.db.prepare('PRAGMA table_info(chronicle)').all() as { name: string }[];
    // v1.80: more numbers for the charts
    const sc = this.db.prepare('PRAGMA table_info(stats)').all() as { name: string }[];
    for (const c of ['villages', 'born', 'died', 'kingdoms', 'disaster']) if (!sc.some((x) => x.name === c)) this.db.exec(`ALTER TABLE stats ADD COLUMN ${c} INTEGER`);
    if (!cols.some((c) => c.name === 'refs')) this.db.exec('ALTER TABLE chronicle ADD COLUMN refs TEXT');
    // v1.15: every entry is also written in English
    if (!cols.some((c) => c.name === 'en')) this.db.exec('ALTER TABLE chronicle ADD COLUMN en TEXT');
    // v1.33: and in German
    if (!cols.some((c) => c.name === 'de')) this.db.exec('ALTER TABLE chronicle ADD COLUMN de TEXT');
    // v1.14: new bands are no longer written in the chronicle (their card says who founded them)
    this.db.exec("DELETE FROM chronicle WHERE kind IN ('split', 'colony')");
  }

  /** the chronicle keeps only the last `years` years; the great moments (importance 3) and found secrets stay forever */
  prune(world: string, beforeYear: number): number {
    const r = this.db.prepare("DELETE FROM chronicle WHERE world = ? AND year < ? AND importance < 3 AND kind NOT IN ('secret', 'end')")
      .run(world, beforeYear) as { changes: number | bigint };
    return Number(r.changes);
  }

    /** first discoveries as the chronicle wrote them (for worlds older than the discoveries list) */
  discoveryRows(world: string): { text: string; year: number; person: number | null }[] {
    return this.db.prepare("SELECT text, year, person FROM chronicle WHERE world = ? AND kind = 'discovery' ORDER BY id")
      .all(world) as { text: string; year: number; person: number | null }[];
  }

  addGoneBands(world: string, gone: GoneBand[]) {
    if (!gone.length) return;
    const st = this.db.prepare('INSERT OR REPLACE INTO gone_bands VALUES (?,?,?)');
    for (const g of gone) st.run(world, g.id, JSON.stringify(g));
  }

  getGoneBand(world: string, id: number): GoneBand | null {
    const row = this.db.prepare('SELECT json FROM gone_bands WHERE world = ? AND id = ?').get(world, id) as { json: string } | undefined;
    return row ? JSON.parse(row.json) : null;
  }

  addEvents(world: string, events: ChronicleEntry[]) {
    if (!events.length) return;
    const st = this.db.prepare('INSERT OR REPLACE INTO chronicle (world, id, tick, year, kind, importance, text, kids, person, band, refs, en, de) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)');
    this.db.exec('BEGIN');
    for (const e of events) {
      st.run(world, e.id, e.tick, Math.floor(e.year), e.kind, e.importance, e.text, e.kids ?? null, e.personId ?? null, e.bandId ?? null,
        e.refs?.length ? JSON.stringify(e.refs) : null, e.en ? JSON.stringify(e.en) : null, e.de ? JSON.stringify(e.de) : null);
    }
    this.db.exec('COMMIT');
  }

  addDead(world: string, dead: DeadRecord[]) {
    if (!dead.length) return;
    const st = this.db.prepare('INSERT OR REPLACE INTO dead VALUES (?,?,?)');
    this.db.exec('BEGIN');
    for (const d of dead) st.run(world, d.id, JSON.stringify(d));
    this.db.exec('COMMIT');
  }

  /**
   * A step of the slow cleaning of the dead: the rows from `from` on (a few thousand at a time, so the world never waits).
   * Gone are the dead of worlds that no longer live, and the plain dead of this world who died before `beforeTick`:
   * the ones with deeds, the famous and the kings stay for ever. Returns where the next step starts (0: from the top again).
   */
  pruneDeadStep(worlds: string[], world: string, beforeTick: number, keepIds: number[], from: number, rows = 20000): number {
    const top = from + rows;
    this.db.prepare(`DELETE FROM dead WHERE rowid >= ? AND rowid < ? AND (
        world NOT IN (SELECT value FROM json_each(?))
        OR (world = ? AND json_extract(json, '$.died') < ? AND json_array_length(json, '$.deeds') = 0 AND id NOT IN (SELECT value FROM json_each(?))))`)
      .run(from, top, JSON.stringify(worlds), world, beforeTick, JSON.stringify(keepIds));
    const max = (this.db.prepare('SELECT MAX(rowid) m FROM dead').get() as { m: number | null }).m ?? 0;
    return top > max ? 0 : top;
  }

  /** the chronicle, the charts and the gone clans of worlds that no longer live */
  dropOldWorlds(worlds: string[]): number {
    const w = JSON.stringify(worlds);
    let n = 0;
    for (const t of ['chronicle', 'stats', 'gone_bands']) {
      const r = this.db.prepare(`DELETE FROM ${t} WHERE world NOT IN (SELECT value FROM json_each(?))`).run(w) as { changes: number | bigint };
      n += Number(r.changes);
    }
    return n;
  }

  /** once: the file gives back the room the cleaning freed and from then on can do it bit by bit */
  compactOnce(): boolean {
    const v = (this.db.prepare('PRAGMA user_version').get() as { user_version: number }).user_version;
    if (v >= 1) return false;
    this.db.exec('PRAGMA auto_vacuum = INCREMENTAL');
    this.db.exec('VACUUM');
    this.db.exec('PRAGMA user_version = 1');
    return true;
  }

  /** the room freed since the last time goes back to the disk */
  compact() {
    this.db.exec('PRAGMA incremental_vacuum');
    this.db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
  }

  getDead(world: string, id: number): DeadRecord | null {
    const row = this.db.prepare('SELECT json FROM dead WHERE world = ? AND id = ?').get(world, id) as { json: string } | undefined;
    return row ? JSON.parse(row.json) : null;
  }

  addStat(world: string, s: { tick: number; year: number; population: number; bands: number; era: number; techs: number; villages: number; born: number; died: number; kingdoms: number; disaster: number }) {
    this.db.prepare('INSERT OR REPLACE INTO stats (world, tick, year, population, bands, era, techs, villages, born, died, kingdoms, disaster) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)')
      .run(world, s.tick, s.year, s.population, s.bands, s.era, s.techs, s.villages, s.born, s.died, s.kingdoms, s.disaster);
  }

  /** the first and the last year with numbers */
  statsSpan(world: string): { first: number; last: number } {
    const r = this.db.prepare('SELECT MIN(year) a, MAX(year) b FROM stats WHERE world = ?').get(world) as { a: number | null; b: number | null };
    return { first: r.a ?? 0, last: r.b ?? 0 };
  }

  stats(world: string, max = 400, from = -1e9, to = 1e9) {
    const rows = this.db.prepare('SELECT tick, year, population, bands, era, techs, villages, born, died, kingdoms, disaster FROM stats WHERE world = ? AND year >= ? AND year <= ? ORDER BY tick').all(world, from, to) as Record<string, number>[];
    if (rows.length <= max) return rows;
    const step = rows.length / max;
    const out = [];
    for (let i = 0; i < max; i++) out.push(rows[Math.floor(i * step)]);
    out.push(rows[rows.length - 1]);
    return out;
  }

  chronicle(world: string, opts: { before?: number; after?: number; min?: number; limit?: number; fromYear?: number }): ChronicleEntry[] {
    const limit = Math.min(500, opts.limit ?? 60);
    const min = opts.min ?? 1;
    let rows: Record<string, unknown>[];
    if (opts.after !== undefined) {
      rows = this.db.prepare('SELECT * FROM chronicle WHERE world = ? AND importance >= ? AND id > ? ORDER BY id ASC LIMIT ?')
        .all(world, min, opts.after, limit) as Record<string, unknown>[];
    } else {
      rows = this.db.prepare('SELECT * FROM chronicle WHERE world = ? AND importance >= ? AND id < ? AND year >= ? ORDER BY id DESC LIMIT ?')
        .all(world, min, opts.before ?? 2 ** 31, opts.fromYear ?? -1e9, limit) as Record<string, unknown>[];
    }
    return rows.map((r) => ({
      id: r.id as number, tick: r.tick as number, year: r.year as number, kind: r.kind as string,
      importance: r.importance as number, text: r.text as string, kids: (r.kids as string) ?? undefined,
      personId: (r.person as number) ?? undefined, bandId: (r.band as number) ?? undefined,
      refs: r.refs ? JSON.parse(r.refs as string) : undefined,
      en: r.en ? JSON.parse(r.en as string) : undefined,
      de: r.de ? JSON.parse(r.de as string) : undefined,
    }));
  }

  countSince(world: string, after: number): { total: number; big: number } {
    const r = this.db.prepare('SELECT COUNT(*) AS total, SUM(importance >= 2) AS big FROM chronicle WHERE world = ? AND id > ?').get(world, after) as { total: number; big: number | null };
    return { total: r.total, big: r.big ?? 0 };
  }

  startWorld(id: string) {
    this.db.prepare('INSERT OR IGNORE INTO worlds VALUES (?,?,NULL,NULL)').run(id, Date.now());
  }

  endWorld(id: string, summary: string) {
    this.db.prepare('UPDATE worlds SET ended = ?, summary = ? WHERE id = ?').run(Date.now(), summary, id);
  }

  worlds() {
    return this.db.prepare('SELECT * FROM worlds ORDER BY started DESC').all();
  }
}
