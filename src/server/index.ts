import http from 'node:http';
import { createReadStream, existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { createGzip, gunzipSync, gzipSync } from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer, WebSocket } from 'ws';
import { Simulation, SimState } from './sim/sim';
import { setWorldSize } from './sim/world';
import { Store } from './db';
import { Discovery, SnapshotMessage, TickMessage, WorldInfo, b64encode, formatYear } from '../shared/types';
import { TECHS } from './sim/tech';

const PORT = Number(process.env.LETOPIS_PORT ?? 2222);
const DATA = path.resolve(process.env.LETOPIS_DATA ?? '/data');
// set by the image build: 'dev' for the test image, empty for the real one
const CHANNEL = (process.env.LETOPIS_CHANNEL ?? '').trim();
const SPEED = Math.max(0.01, Number(process.env.LETOPIS_SPEED ?? 1)); // only for testing: 100 = 100x faster
const SAVE_EVERY_MS = 2 * 60 * 1000;
const here = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(here, 'public');

mkdirSync(path.join(DATA, 'archive'), { recursive: true });
const STATE_FILE = path.join(DATA, 'world.json.gz');
const MARS_FILE = path.join(DATA, 'mars.json.gz');
const store = new Store(path.join(DATA, 'letopis.db'));

function log(...a: unknown[]) {
  console.log(new Date().toISOString(), ...a);
}

function loadOrCreate(): Simulation {
  if (existsSync(STATE_FILE)) {
    try {
      const st = JSON.parse(gunzipSync(readFileSync(STATE_FILE)).toString('utf8')) as SimState;
      const sim = new Simulation(st);
      log(`Продължава свят ${st.worldId}, година ${Math.floor(sim.year)}, ${st.people.length} души`);
      return sim;
    } catch (e) {
      log('Неуспешно зареждане, архивирам повредения файл и започвам нов свят', e);
      renameSync(STATE_FILE, path.join(DATA, 'archive', `broken-${Date.now()}.json.gz`));
    }
  }
  const seed = process.env.LETOPIS_SEED ? Number(process.env.LETOPIS_SEED) : undefined;
  const sim = new Simulation(null, seed);
  log(`Нов свят ${sim.s.worldId}`);
  return sim;
}

let sim = loadOrCreate();
store.startWorld(sim.s.worldId);
/** the second world: there once the first ship has landed (same map size as the Earth) */
let mars: Simulation | null = loadMars();
let worldInfo = makeWorldInfo(sim);
let marsInfo = mars ? makeWorldInfo(mars) : null;

function loadMars(): Simulation | null {
  if (!existsSync(MARS_FILE)) return null;
  try {
    const st = JSON.parse(gunzipSync(readFileSync(MARS_FILE)).toString('utf8')) as SimState;
    if (!st.worldId.startsWith(sim.s.worldId)) return null;
    const m = new Simulation(st);
    setWorldSize(sim.s.size ?? m.t.w);
    log(`Марс: ${st.people.length} души`);
    return m;
  } catch (e) {
    log('Марс не се зареди', e);
    return null;
  }
}

function makeWorldInfo(sm: Simulation): WorldInfo {
  const t = sm.t;
  const n = t.w * t.h;
  const height = new Uint8Array(n), temp = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    height[i] = Math.max(0, Math.min(255, Math.round((t.height[i] + 1) * 127.5)));
    temp[i] = Math.round(t.temp[i] * 255);
  }
  return {
    worldId: sm.s.worldId, seed: sm.s.seed, w: t.w, h: t.h,
    height: b64encode(height), biome: b64encode(t.biome), river: b64encode(t.river), temp: b64encode(temp),
    treeKinds: b64encode(sm.treeKind), planet: sm.s.planet,
  };
}

function bindLookup() {
  sim.lookupDead = (id) => store.getDead(sim.s.worldId, id);
  if (mars) { const m = mars; m.lookupDead = (id) => store.getDead(m.s.worldId, id); }
}
bindLookup();

function save() {
  const tmp = STATE_FILE + '.tmp';
  writeFileSync(tmp, gzipSync(JSON.stringify(sim.serialize())));
  renameSync(tmp, STATE_FILE);
  if (mars) {
    writeFileSync(MARS_FILE + '.tmp', gzipSync(JSON.stringify(mars.serialize())));
    renameSync(MARS_FILE + '.tmp', MARS_FILE);
  }
}

function flush(sm: Simulation = sim) {
  store.addEvents(sm.s.worldId, sm.events);
  store.addDead(sm.s.worldId, sm.deadQueue);
  sm.deadQueue = [];
  store.addGoneBands(sm.s.worldId, sm.goneQueue);
  sm.goneQueue = [];
}

function addStat(sm: Simulation) {
  store.addStat(sm.s.worldId, {
    tick: sm.s.tick, year: Math.floor(sm.year), population: sm.s.people.length, bands: sm.s.bands.length,
    era: sm.s.era, techs: sm.s.discovered.length, villages: sm.s.bands.filter((b) => b.settled).length,
    born: sm.s.totalBorn, died: sm.s.totalDied, kingdoms: sm.s.kingdoms?.length ?? 0, disaster: sm.s.disasterDead ?? 0,
  });
}

/** ships between the worlds: the first one to Mars makes the second world */
function carry() {
  for (const v of sim.outbox) {
    if (!mars) {
      mars = Simulation.newMars(sim);
      store.startWorld(mars.s.worldId);
      marsInfo = makeWorldInfo(mars);
      bindLookup();
      log('Първият кораб кацна на Марс');
    }
    mars.receive(v);
  }
  sim.outbox = [];
  if (mars) {
    for (const v of mars.outbox) sim.receive(v);
    mars.outbox = [];
  }
}

// ---------- the endless loop ----------

const CHRONICLE_YEARS = 100;
let lastSave = Date.now();
let pendingEvents: TickMessage['events'] = [];
let marsPending: TickMessage['events'] = [];

function tick() {
  const started = Date.now();
  try {
    sim.step();
    if (mars) mars.step();
    carry();
    pendingEvents = sim.events;
    flush();
    sim.events = [];
    if (mars) {
      marsPending = mars.events;
      flush(mars);
      mars.events = [];
    }
    // a short chronicle: the last 100 years, plus the great discoveries and moments for ever
    if (sim.s.tick % 12 === 6) {
      store.prune(sim.s.worldId, Math.floor(sim.year) - CHRONICLE_YEARS);
      if (mars) store.prune(mars.s.worldId, Math.floor(mars.year) - CHRONICLE_YEARS);
    }
    if (sim.s.tick % 12 === 0) {
      addStat(sim);
      if (mars) addStat(mars);
    }
    broadcast(sim, clients, pendingEvents);
    pendingEvents = [];
    if (mars) { broadcast(mars, marsClients, marsPending); marsPending = []; }
    if (sim.extinct) return restartWorld();
    if (Date.now() - lastSave > SAVE_EVERY_MS) {
      save();
      lastSave = Date.now();
    }
  } catch (e) {
    log('Грешка в симулацията', e);
  }
  const wait = Math.max(5, sim.tickMs(SPEED) - (Date.now() - started));
  setTimeout(tick, wait);
}

function restartWorld() {
  const old = sim.s.worldId;
  const summary = `Угасна в ${Math.floor(sim.year)} г. след ${sim.s.totalBorn} родени.`;
  store.addEvents(old, [{
    id: sim.s.nextEventId++, tick: sim.s.tick, year: sim.year, kind: 'end', importance: 3,
    text: 'Последният човек на този свят си отиде. Летописът се затваря. Скоро ще започне нов свят.',
    kids: 'Хората на този свят изчезнаха. Но скоро ще започне нов свят!',
    en: { text: 'The last person of this world has passed away. The chronicle closes. A new world will begin soon.',
      kids: 'The people of this world are gone. But a new world will begin soon!' },
    de: { text: 'Der letzte Mensch dieser Welt ist gestorben. Die Chronik schließt sich. Bald beginnt eine neue Welt.',
      kids: 'Die Menschen dieser Welt sind verschwunden. Aber bald beginnt eine neue Welt!' },
  }]);
  store.endWorld(old, summary);
  save();
  renameSync(STATE_FILE, path.join(DATA, 'archive', `${old}.json.gz`));
  if (existsSync(MARS_FILE)) renameSync(MARS_FILE, path.join(DATA, 'archive', `${old}-mars.json.gz`));
  mars = null;
  marsInfo = null;
  log(`Светът ${old} угасна. Започвам нов след 1 минута.`);
  setTimeout(() => {
    sim = new Simulation(null);
    bindLookup();
    store.startWorld(sim.s.worldId);
    worldInfo = makeWorldInfo(sim);
    flush();
    sim.events = [];
    save();
    for (const ws of clients) ws.send(JSON.stringify({ t: 'newworld' }));
    tick();
  }, 60_000);
}

// ---------- web ----------

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.png': 'image/png', '.webp': 'image/webp', '.ogg': 'audio/ogg', '.svg': 'image/svg+xml', '.json': 'application/json', '.map': 'application/json', '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
};

function json(res: http.ServerResponse, data: unknown, status = 200) {
  const body = JSON.stringify(data);
  // the world and the people are big: packed they are about ten times smaller over a slow line
  const zip = body.length > 16384 && /\bgzip\b/.test(String(res.req?.headers['accept-encoding'] ?? ''));
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...(zip ? { 'content-encoding': 'gzip', vary: 'accept-encoding' } : {}) });
  res.end(zip ? gzipSync(body, { level: 4 }) : body);
}

/** every first discovery: what, who and when; old worlds are read back from the chronicle text */
function discoveries(sim: Simulation): Discovery[] {
  const out: Discovery[] = [];
  const firsts = sim.s.firsts ?? [];
  const rows = firsts.length < TECHS.length ? store.discoveryRows(sim.s.worldId) : [];
  for (const tech of TECHS) {
    const f = firsts.find((x) => x.tech === tech.id);
    if (f) { out.push({ tech: tech.id, name: tech.name, pid: f.pid, who: f.name, band: f.band, year: f.year }); continue; }
    const esc = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp('^' + esc(tech.text).replace(esc('{name}'), '(.+?)').replace(esc('{band}'), '(.+?)').replace(esc('{Band}'), '(.+?)') + '$');
    for (const r of rows) {
      const m = r.text.match(re);
      if (!m) continue;
      const nameFirst = tech.text.indexOf('{name}') < tech.text.search(/\{[Bb]and\}/) || !/\{[Bb]and\}/.test(tech.text);
      out.push({ tech: tech.id, name: tech.name, pid: r.person, who: nameFirst ? m[1] : m[2] ?? m[1], band: nameFirst ? m[2] ?? '' : m[1], year: r.year });
      break;
    }
  }
  return out.sort((a, b) => a.year - b.year);
}

function snapshot(sim: Simulation): SnapshotMessage {
  return {
    t: 'snapshot', time: sim.timeInfo(SPEED), bands: sim.bandViews(), people: sim.personRows(), explored: sim.exploredB64(), trees: sim.treesB64(), roads: sim.roadsB64(),
    population: sim.s.people.length, totalBorn: sim.s.totalBorn, totalDied: sim.s.totalDied,
  };
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://x');
  // /mars/...: the same pages and questions, about the second world
  const onMars = url.pathname === '/mars' || url.pathname.startsWith('/mars/');
  const p = onMars ? url.pathname.slice(5) || '/' : url.pathname;
  const q = (k: string) => (url.searchParams.has(k) ? Number(url.searchParams.get(k)) : undefined);
  const sm = onMars && mars && p.startsWith('/api/') ? mars : sim;
  const world = sm.s.worldId;
  const sim2 = sm;
  try {
    if (p === '/api/planets') return json(res, { mars: !!mars, marsPeople: mars?.s.people.length ?? 0 });
    if (onMars && !mars && p.startsWith('/api/')) return json(res, { error: 'Марс още е пуст' }, 404);
    if (p === '/api/health') return json(res, { ok: true, world, year: Math.floor(sim2.year), population: sim2.s.people.length });
    if (p === '/api/world') return json(res, (onMars ? marsInfo! : worldInfo));
    if (p === '/api/snapshot') return json(res, snapshot(sim2));
    if (p === '/api/chronicle') return json(res, store.chronicle(world, { before: q('before'), after: q('after'), min: q('min'), limit: q('limit'), fromYear: q('fromYear') }));
    if (p === '/api/since') {
      const after = q('after') ?? 0;
      return json(res, { ...store.countSince(world, after), events: store.chronicle(world, { after, min: 2, limit: 200 }) });
    }
    // for the Android app: the big events since the last look, ready to show as notifications
    if (p === '/api/news') {
      const lang = (['bg', 'en', 'de'] as const).find((l) => l === url.searchParams.get('lang')) ?? 'bg';
      const kinds = new Set((url.searchParams.get('kinds') ?? '').split(',').filter(Boolean));
      const kidsText = url.searchParams.get('kids') === '1';
      const after = q('after');
      const last = store.chronicle(world, { limit: 1 })[0]?.id ?? 0;
      // the first look only learns where the chronicle is now
      if (after === undefined || after > last) return json(res, { last, items: [] });
      const name = onMars ? { bg: 'Летопис · Марс', en: 'Letopis · Mars', de: 'Letopis · Mars' } : { bg: 'Летопис', en: 'Letopis', de: 'Letopis' };
      const items = store.chronicle(world, { after, min: 2, limit: 200 })
        .filter((e) => kinds.has(e.kind))
        .slice(-20)
        .map((e) => {
          const tr = lang === 'bg' ? { text: e.text, kids: e.kids } : (e[lang] as { text: string; kids?: string } | undefined) ?? { text: e.text, kids: e.kids };
          return { id: e.id, title: `${name[lang]} · ${formatYear(e.year, lang)}`, text: (kidsText && tr.kids) || tr.text };
        });
      return json(res, { last, items });
    }
    if (p === '/api/heroes') return json(res, sim2.heroes());
    if (p === '/api/famous') return json(res, sim2.famousList());
    if (p === '/api/stats') return json(res, store.stats(world));
    if (p === '/api/worlds') return json(res, store.worlds());
    if (p === '/api/secrets') return json(res, { found: sim2.secretFinds() });
    if (p.startsWith('/api/secret/') && req.method === 'POST') {
      const r = sim2.findSecret(Number(p.split('/').pop()));
      return r ? json(res, r) : json(res, { error: 'няма такава тайна' }, 404);
    }
    if (p.startsWith('/api/tree/')) {
      const t = sim2.familyTree(Number(p.split('/').pop()));
      return t ? json(res, t) : json(res, { error: 'няма такъв човек' }, 404);
    }
    if (p === '/api/discoveries') return json(res, discoveries(sim2));
    if (p.startsWith('/api/band/')) {
      const id = Number(p.split('/').pop());
      const live = sim2.bandViews().find((b) => b.id === id);
      if (live) return json(res, { live });
      const gone = store.getGoneBand(world, id);
      return gone ? json(res, { gone }) : json(res, { error: 'няма такъв род' }, 404);
    }
    if (p.startsWith('/api/person/')) {
      const d = sim2.personDetail(Number(p.split('/').pop()));
      return d ? json(res, d) : json(res, { error: 'няма такъв човек' }, 404);
    }
    // static files
    let file = path.normalize(path.join(PUBLIC, p === '/' ? 'index.html' : p));
    if (!file.startsWith(PUBLIC) || !existsSync(file) || statSync(file).isDirectory()) file = path.join(PUBLIC, 'index.html');
    const fresh = file.endsWith('index.html') || file.endsWith('version.json');
    // text (the game script, the atlas list) goes compressed: a few times smaller over a slow line
    const ext = path.extname(file);
    const zip = ['.js', '.css', '.json', '.html', '.svg', '.map', '.webmanifest'].includes(ext) && /\bgzip\b/.test(String(req.headers['accept-encoding'] ?? ''));
    res.writeHead(200, {
      'content-type': MIME[ext] ?? 'application/octet-stream',
      // the page and its version must always be fresh; the rest carries ?v=<build>
      'cache-control': fresh ? 'no-cache' : 'public, max-age=86400',
      ...(zip ? { 'content-encoding': 'gzip', vary: 'accept-encoding' } : {}),
    });
    if (CHANNEL && file.endsWith('index.html')) {
      // the test server says so in the browser tab: "Летопис - Dev"
      const page = readFileSync(file, 'utf8').replace('<title>Летопис</title>', `<title>Летопис - ${CHANNEL[0].toUpperCase()}${CHANNEL.slice(1)}</title>`);
      res.end(zip ? gzipSync(page) : page);
    } else if (zip) createReadStream(file).pipe(createGzip({ level: 6 })).pipe(res);
    else createReadStream(file).pipe(res);
  } catch (e) {
    log('HTTP грешка', e);
    json(res, { error: 'вътрешна грешка' }, 500);
  }
});

// every tick carries all the people: compressed it is about a fifth of the size
const wss = new WebSocketServer({ noServer: true, perMessageDeflate: { threshold: 4096, zlibDeflateOptions: { level: 3 } } });
const clients = new Set<WebSocket>();
const marsClients = new Set<WebSocket>();
server.on('upgrade', (req, socket, head) => {
  const p = new URL(req.url ?? '/', 'http://x').pathname;
  if (p !== '/ws' && p !== '/mars/ws') { socket.destroy(); return; }
  const onMars = p === '/mars/ws' && !!mars;
  wss.handleUpgrade(req, socket, head, (ws) => {
    const set = onMars ? marsClients : clients;
    set.add(ws);
    ws.send(JSON.stringify(snapshot(onMars ? mars! : sim)));
    ws.on('close', () => set.delete(ws));
    ws.on('error', () => set.delete(ws));
  });
});

function broadcast(sim: Simulation, clients: Set<WebSocket>, pendingEvents: TickMessage['events']) {
  if (!clients.size) {
    sim.treeChanges = [];
    sim.roadChanges = [];
    return;
  }
  const msg: TickMessage = {
    t: 'tick', time: sim.timeInfo(SPEED), bands: sim.bandViews(), people: sim.personRows(), events: pendingEvents,
    population: sim.s.people.length,
  };
  if (sim.exploredDirty) {
    msg.explored = sim.exploredB64();
    sim.exploredDirty = false;
  }
  if (sim.treeChanges.length) msg.trees = sim.treeChanges;
  sim.treeChanges = [];
  if (sim.roadChanges.length) msg.roads = sim.roadChanges;
  sim.roadChanges = [];
  const data = JSON.stringify(msg);
  for (const ws of clients) if (ws.readyState === WebSocket.OPEN) ws.send(data);
}

function shutdown() {
  log('Спирам, записвам света...');
  try {
    flush();
    save();
  } catch (e) {
    log('Грешка при запис', e);
  }
  process.exit(0);
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

server.listen(PORT, () => {
  log(`Летопис слуша на порт ${PORT}, данни в ${DATA}, скорост x${SPEED}`);
  flush();
  sim.events = [];
  save();
  tick();
});
