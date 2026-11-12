// The page language: Bulgarian or English, chosen with the language button and remembered in the browser.
// The server sends Bulgarian names and a ready English chronicle; the rest is translated here.

import {
  BIOME_NAMES_EN, Lang, MONTHS_EN, SECRET_HEROES_EN, SECRET_KINDS_EN, TASK_BG, TASK_NAMES_EN, TECH_EN, bandEn, bandTextEn, causeEn, chiefEn, deedEn,
  ERAS_BG, eraEn, personEn, techEn, titleEn, villageEn, yearsInTextEn, GENE_EN,
} from '../shared/i18n';
import {
  BIOME_NAMES_DE, GENE_DE, MONTHS_DE, SECRET_HEROES_DE, SECRET_KINDS_DE, TASK_NAMES_DE, TECH_DE, bandDe, bandDeInText, bandTextDe,
  causeDe, chiefDe, deedDe, eraDe, numDe, personDe, techDe, titleDe, villageDe, yearsInTextDe,
} from '../shared/i18n-de';
import { MONTHS, formatYear } from '../shared/types';
import { clanBase } from '../shared/clans';
import { SECRET_HEROES, SECRET_KINDS } from '../shared/secrets';

const LANGS: Lang[] = ['bg', 'en', 'de'];

function initial(): Lang {
  try {
    const v = JSON.parse(localStorage.getItem('letopis.lang') ?? 'null');
    if (LANGS.includes(v)) return v;
  } catch { /* private mode */ }
  const nav = navigator.language || '';
  return /^bg\b/i.test(nav) ? 'bg' : /^de\b/i.test(nav) ? 'de' : 'en';
}

export const LANG: Lang = initial();
export const EN = LANG === 'en';
export const DE = LANG === 'de';
/** the page shows Bulgarian */
export const BG = LANG === 'bg';

export function setLang(l: Lang) {
  try { localStorage.setItem('letopis.lang', JSON.stringify(l)); } catch { /* private mode */ }
  location.reload();
}

/** pick the text for the current language */
export const T = (bg: string, en: string, de: string) => (EN ? en : DE ? de : bg);
/** pick by language: three values of any kind */
export const L3 = <V>(bg: V, en: V, de: V): V => (EN ? en : DE ? de : bg);

export const fmtYear = (y: number) => formatYear(y, LANG);
export const monthName = (m: number) => L3(MONTHS, MONTHS_EN, MONTHS_DE)[m];
export const num = (n: number) => (DE ? numDe(n) : n.toLocaleString(EN ? 'en-US' : 'bg-BG'));
/** the locale for dates */
export const LOCALE = L3('bg-BG', 'en-GB', 'de-DE');

// names and words that come from the server in Bulgarian
export const P = (name: string) => L3(name, personEn(name), personDe(name));
/** a band name on its own ("Wolfszahn", "Die Roten") */
export const B = (name: string) => L3(name, bandEn(name), bandDe(name));
/** a band label written by the server ("Селото Бялово", "Родът на ...", "рода на ..."), shown on its own */
export const BL = (s: string) => L3(s, bandTextEn(s), bandTextDe(s));
export const VILLAGE = (s: string) => L3(s, villageEn(s), villageDe(s));
export const TECH = (bgName: string) => L3(bgName, techEn(bgName), techDe(bgName));
export const TECH_ID = (id: string, bgName: string) => L3(bgName, TECH_EN[id]?.name ?? bgName, TECH_DE[id]?.name ?? bgName);
export const ERA = (s: string) => L3(s, eraEn(s), eraDe(s, ERAS_BG));
export const TASK = (s: string) => {
  const k = TASK_BG[s];
  return k ? L3(s, TASK_NAMES_EN[k], TASK_NAMES_DE[k]) : s;
};
/** how someone died; in German the age is part of it ("starb mit 71 Jahren an Altersschwäche") */
export const CAUSE = (s: string, age: number) => L3(`${s} на ${age}`, `${causeEn(s)} at ${age}`, causeDe(s, age));
export const DEED = (s: string) => L3(s, deedEn(s), deedDe(s));
export const TITLE = (s: string, female = false) => L3(s, titleEn(s), titleDe(s, female));
export const CHIEF = (s: string, female = false) => L3(s, chiefEn(s), chiefDe(s, female));
export const GENE = (s: string) => L3(s, GENE_EN[s] ?? s, GENE_DE[s] ?? s);
export const YEARS_IN = (s: string) => L3(s, yearsInTextEn(s), yearsInTextDe(s));
export const HERO = (k: number) => L3(SECRET_HEROES, SECRET_HEROES_EN, SECRET_HEROES_DE)[k];
export const SECRET_KIND = (kind: number) => {
  const s = SECRET_KINDS[kind];
  return L3(s, SECRET_KINDS_EN[s.id] ?? s, SECRET_KINDS_DE[s.id] ?? s);
};
export const BIOME_NAME = (b: number, bg: string) => L3(bg, BIOME_NAMES_EN[b] ?? bg, BIOME_NAMES_DE[b] ?? bg);

/** a chronicle name ref, as it is written in the current language */
export function refName(n: string, isPerson: boolean, lang: Lang = LANG): string {
  if (lang === 'bg') return n;
  const clan = /^(Родът|рода) на /.test(n) || !!clanBase(n);
  if (lang === 'en') return isPerson ? personEn(n) : clan ? bandEn(n) : villageEn(n);
  return isPerson ? personDe(n) : clan ? bandDeInText(n) : villageDe(n);
}

/** the static page in English or German (index.html is written in Bulgarian) */
export function translatePage() {
  document.documentElement.lang = LANG;
  if (BG) return;
  const t = (en: string, de: string) => (EN ? en : de);
  const set = (sel: string, text?: string, title?: string) => {
    const el = document.querySelector<HTMLElement>(sel);
    if (!el) return;
    if (text !== undefined) el.textContent = text;
    if (title !== undefined) { el.title = title; if (el.hasAttribute('aria-label')) el.setAttribute('aria-label', title); }
  };
  set('#loading', t('The world is waking up…', 'Die Welt erwacht…'));
  set('#conn', undefined, t('Connection to the server', 'Verbindung zum Server'));
  const brand = document.querySelector('.brand');
  if (brand?.firstChild) brand.firstChild.textContent = 'Letopis ';
  document.title = document.title.replace('Летопис', 'Letopis');
  const stats: [string, string, string][] = [
    ['#pop', 'People', 'Menschen'], ['#bandsCount', 'Clans', 'Clans'], ['#born', 'Born', 'Geboren'], ['#died', 'Died', 'Gestorben'],
    ['#age', 'World age', 'Alter der Welt'],
  ];
  for (const [id, en, de] of stats) {
    const span = document.querySelector(id)?.previousElementSibling;
    if (span) span.textContent = t(en, de);
  }
  set('#sideHandle', undefined, t('Hide or show the panel', 'Seitenleiste ein- oder ausblenden'));
  const tabs: Record<string, [string, string]> = {
    chronicle: ['Chronicle', 'Chronik'], discoveries: ['Discoveries', 'Entdeckungen'], bands: ['Clans', 'Clans'], heroes: ['People', 'Personen'],
    stats: ['Statistics', 'Statistik'], secrets: ['Secrets', 'Geheimnisse'],
  };
  for (const [k, [en, de]] of Object.entries(tabs)) set(`.tab[data-tab="${k}"]`, t(en, de));
  set('#zoomIn', undefined, t('Zoom in', 'Vergrößern'));
  set('#zoomOut', undefined, t('Zoom out', 'Verkleinern'));
  set('#tourBtn', t('Tour', 'Rundflug'), t('The camera wanders the world on its own', 'Die Kamera wandert von selbst durch die Welt'));
  set('#nightBtn', t('Night', 'Nacht'), t('Day and night cycle', 'Wechsel von Tag und Nacht'));
  set('#kidsBtn', t('Kids mode', 'Kindermodus'), t('Bigger letters and explanations for children', 'Größere Schrift und Erklärungen für Kinder'));
  set('#sideToggle', t('Panel', 'Leiste'), t('Hide or show the chronicle', 'Chronik ein- oder ausblenden'));
  set('#cardClose', undefined, t('Close', 'Schließen'));
}
