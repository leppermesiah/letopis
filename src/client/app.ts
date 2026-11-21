// Inside the Android app: a "Notifications" button with what the phone should tell you about.
// The app looks at the server about every 15 minutes, even when it is closed, and shows the big events.

import { LANG, T } from './lang';

interface AppBridge {
  getPrefs(): string;
  setPrefs(json: string): void;
  changeServer(): void;
}

interface Prefs { on: boolean; groups: string[]; mars: boolean; kids: boolean; lang: string; kinds: string[] }

/** what can be chosen, and which chronicle kinds belong to it */
const GROUPS: { id: string; bg: string; en: string; de: string; kinds: string[]; on: boolean }[] = [
  { id: 'discover', bg: 'Открития и нови епохи', en: 'Discoveries and new ages', de: 'Entdeckungen und neue Zeitalter', kinds: ['discovery', 'era', 'secret'], on: true },
  { id: 'famous', bg: 'Известни личности', en: 'Famous people', de: 'Berühmte Persönlichkeiten', kinds: ['famous'], on: true },
  { id: 'kingdom', bg: 'Царства', en: 'Kingdoms', de: 'Königreiche', kinds: ['kingdom'], on: true },
  { id: 'places', bg: 'Нови селища и сливания', en: 'New places and mergers', de: 'Neue Orte und Zusammenschlüsse', kinds: ['settle', 'merge', 'colony', 'newland'], on: false },
  { id: 'trouble', bg: 'Бедствия', en: 'Disasters', de: 'Katastrophen', kinds: ['flood', 'epidemic', 'drought', 'extinct', 'lost', 'storm', 'locusts', 'murrain'], on: false },
];

export function initApp(kids: () => boolean) {
  const app = (window as unknown as { LetopisApp?: AppBridge }).LetopisApp;
  if (!app) return;
  const wrap = document.querySelector('.app-wrap') as HTMLElement;
  const btn = document.querySelector('#newsBtn') as HTMLButtonElement;
  const panel = document.querySelector('#newsPanel') as HTMLElement;
  wrap.hidden = false;
  btn.textContent = T('Известия: кои да идват ▾', 'Notifications: which ones ▾', 'Mitteilungen: welche ▾');
  btn.title = T('Известия на телефона', 'Notifications on the phone', 'Mitteilungen auf dem Handy');

  let prefs: Partial<Prefs> = {};
  try { prefs = JSON.parse(app.getPrefs() || '{}'); } catch { /* first start */ }
  const p: Prefs = {
    on: prefs.on ?? true,
    groups: prefs.groups ?? GROUPS.filter((g) => g.on).map((g) => g.id),
    mars: prefs.mars ?? true,
    kids: kids(), lang: LANG, kinds: [],
  };
  const save = () => {
    p.kids = kids();
    p.lang = LANG;
    p.kinds = p.on ? GROUPS.filter((g) => p.groups.includes(g.id)).flatMap((g) => g.kinds) : [];
    app.setPrefs(JSON.stringify(p));
    show();
  };
  const row = (label: string, pressed: boolean, onclick: () => void, disabled = false) => {
    const b = document.createElement('button');
    b.className = 'btn';
    b.textContent = label;
    b.setAttribute('aria-pressed', String(pressed));
    b.disabled = disabled;
    b.onclick = onclick;
    return b;
  };
  const show = () => {
    panel.replaceChildren(
      row(p.on ? T('Известията са пуснати', 'Notifications are on', 'Mitteilungen sind an') : T('Известията са спрени', 'Notifications are off', 'Mitteilungen sind aus'), p.on, () => { p.on = !p.on; save(); }),
      ...GROUPS.map((g) => row(T(g.bg, g.en, g.de), p.groups.includes(g.id), () => {
        p.groups = p.groups.includes(g.id) ? p.groups.filter((x) => x !== g.id) : [...p.groups, g.id];
        save();
      }, !p.on)),
      row(T('И от Марс', 'Also from Mars', 'Auch vom Mars'), p.mars, () => { p.mars = !p.mars; save(); }, !p.on),
      Object.assign(row(T('Друг сървър…', 'Another server…', 'Anderer Server…'), false, () => app.changeServer()), { className: 'btn news-server' }),
    );
    btn.setAttribute('aria-pressed', String(p.on));
  };
  save();

  btn.onclick = (ev) => {
    ev.stopPropagation();
    panel.hidden = !panel.hidden;
    btn.setAttribute('aria-expanded', String(!panel.hidden));
  };
  panel.onclick = (ev) => ev.stopPropagation();
  document.addEventListener('pointerdown', (ev) => {
    if (!panel.hidden && !(ev.target as HTMLElement).closest('.app-wrap')) { panel.hidden = true; btn.setAttribute('aria-expanded', 'false'); }
  });
  // kids mode changes the words of the notifications too
  document.querySelector('#kidsBtn')?.addEventListener('click', () => setTimeout(save, 0));
}
