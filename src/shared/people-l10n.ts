// People and places as English and German speakers would name them.
// The world is simulated with Bulgarian names; every name has its own English and German counterpart
// (not a transliteration): Иван Петров is John Peterson in English and Johann Petersen in German.

export type NameLang = 'en' | 'de';

/** male first names: Bulgarian -> [English, German, English family name, German family name] */
const MALE: Record<string, [string, string, string, string]> = {
  Иван: ['John', 'Johann', 'Johnson', 'Jansen'],
  Петър: ['Peter', 'Peter', 'Peterson', 'Petersen'],
  Георги: ['George', 'Georg', 'Jordan', 'Jürgens'],
  Димитър: ['Dennis', 'Dietmar', 'Dennison', 'Dittmer'],
  Стоян: ['Stanley', 'Konrad', 'Stanton', 'Kunze'],
  Тодор: ['Theodore', 'Theodor', 'Tudor', 'Döring'],
  Никола: ['Nicholas', 'Nikolaus', 'Nicholson', 'Nickel'],
  Христо: ['Christopher', 'Christoph', 'Christie', 'Stoffers'],
  Васил: ['Basil', 'Bastian', 'Bassett', 'Bast'],
  Атанас: ['Arthur', 'Anton', 'Arthurs', 'Anders'],
  Добри: ['Godwin', 'Gottfried', 'Goodwin', 'Gutmann'],
  Драган: ['Derek', 'Dieter', 'Dickens', 'Dietrich'],
  Радослав: ['Ralph', 'Roland', 'Ralston', 'Roloff'],
  Светослав: ['Simon', 'Siegfried', 'Simmons', 'Seifert'],
  Боян: ['Bernard', 'Bernd', 'Barnes', 'Bernhardt'],
  Борис: ['Brian', 'Burkhard', 'Bryant', 'Burkhardt'],
  Крум: ['Clement', 'Kurt', 'Clements', 'Kurz'],
  Асен: ['Alan', 'Anselm', 'Allen', 'Ahlers'],
  Калоян: ['Kenneth', 'Karl', 'Kendall', 'Carstens'],
  Пресиян: ['Percival', 'Philipp', 'Percy', 'Philipps'],
  Здравко: ['Harold', 'Hartmut', 'Harrison', 'Hartmann'],
  Велко: ['Walter', 'Volker', 'Walters', 'Vogel'],
  Радко: ['Robert', 'Rudolf', 'Roberts', 'Ruhl'],
  Божидар: ['Nathaniel', 'Matthias', 'Nash', 'Matthes'],
  Любомир: ['Lionel', 'Lothar', 'Lyons', 'Lotze'],
  Мирослав: ['Miles', 'Friedrich', 'Milner', 'Friedrichs'],
  Огнян: ['Aidan', 'Egon', 'Aitken', 'Eggers'],
  Пламен: ['Brandon', 'Benno', 'Burns', 'Brandt'],
  Камен: ['Keith', 'Kaspar', 'Keats', 'Kasper'],
  Страхил: ['Hugh', 'Hubert', 'Hughes', 'Huber'],
  Волен: ['Francis', 'Franz', 'Franks', 'Franke'],
  Благой: ['Benedict', 'Benedikt', 'Bennett', 'Bender'],
  Добромир: ['Edmund', 'Ewald', 'Edmunds', 'Ewert'],
  Ивайло: ['Ivor', 'Ingo', 'Ivers', 'Ingwersen'],
  Тервел: ['Terence', 'Tilmann', 'Terry', 'Tillmanns'],
  Румен: ['Rufus', 'Rupert', 'Rudd', 'Ruprecht'],
  Цветан: ['Floyd', 'Florian', 'Flowers', 'Blum'],
  Младен: ['Owen', 'Jens', 'Owens', 'Jung'],
  Стефан: ['Stephen', 'Stefan', 'Stevens', 'Steffens'],
  Ангел: ['Gabriel', 'Engelbert', 'Gable', 'Engel'],
  Станимир: ['Stuart', 'Sigmund', 'Stewart', 'Siemens'],
  Велислав: ['William', 'Wilhelm', 'Williams', 'Wilms'],
  Траян: ['Tristan', 'Tobias', 'Trent', 'Thoma'],
  Златан: ['Gordon', 'Gustav', 'Golding', 'Goldmann'],
  Бранимир: ['Bertram', 'Berthold', 'Burton', 'Bertels'],
  Деян: ['Daniel', 'Detlef', 'Daniels', 'Dettmann'],
  Неделчо: ['Dominic', 'Dominik', 'Dixon', 'Sonntag'],
  Сабин: ['Samuel', 'Sebastian', 'Sanders', 'Seidel'],
  Юлиан: ['Julian', 'Julius', 'Jewell', 'Jahn'],
  Орлин: ['Arnold', 'Arno', 'Arnott', 'Adler'],
};

/** female first names: Bulgarian -> [English, German] */
const FEMALE: Record<string, [string, string]> = {
  Мария: ['Mary', 'Maria'], Елена: ['Helen', 'Helene'], Йорданка: ['Joanna', 'Johanna'], Радка: ['Rachel', 'Renate'],
  Стояна: ['Constance', 'Konstanze'], Цветана: ['Florence', 'Flora'], Донка: ['Dorothy', 'Dora'], Милка: ['Mildred', 'Hildegard'],
  Гергана: ['Georgina', 'Gerda'], Райна: ['Rebecca', 'Regina'], Добрина: ['Agatha', 'Agathe'], Светла: ['Lucy', 'Luzia'],
  Вела: ['Vera', 'Wilma'], Злата: ['Goldie', 'Gisela'], Калина: ['Holly', 'Karin'], Неда: ['Edith', 'Edda'],
  Румяна: ['Ruby', 'Rosemarie'], Здравка: ['Valerie', 'Hedwig'], Божана: ['Bridget', 'Brigitte'], Мила: ['Amy', 'Amalia'],
  Велика: ['Vivian', 'Waltraud'], Тодора: ['Tabitha', 'Thea'], Росица: ['Rosemary', 'Rosalie'], Пенка: ['Penny', 'Petra'],
  Яна: ['Jane', 'Hanna'], Деница: ['Stella', 'Esther'], Веселина: ['Joy', 'Felicitas'], Лиляна: ['Lily', 'Lilli'],
  Бояна: ['Barbara', 'Bärbel'], Ружа: ['Rose', 'Rosa'], Сияна: ['Clara', 'Klara'], Искра: ['Ivy', 'Ilse'],
  Огняна: ['Edna', 'Elke'], Стана: ['Stacy', 'Silke'], Невена: ['Nell', 'Nele'], Станка: ['Susan', 'Susanne'],
  Живка: ['Eve', 'Eva'], Дена: ['Dinah', 'Doris'], Мирослава: ['Irene', 'Frieda'], Ралица: ['Alice', 'Adelheid'],
  Теодора: ['Theodora', 'Dorothea'], Кремена: ['Katherine', 'Katharina'], Гана: ['Anne', 'Anna'], Василка: ['Wendy', 'Wiebke'],
  Илина: ['Eileen', 'Ingrid'], Боряна: ['Beatrice', 'Beate'], Ваня: ['Jean', 'Jutta'], Звезделина: ['Estelle', 'Stella'],
  Слава: ['Gloria', 'Gertrud'], Елица: ['Ella', 'Elsa'],
};

/** nicknames: Bulgarian -> [English, German]; the same Bulgarian word can differ for men and women */
const NICK: Record<string, [string, string]> = {
  'Яката ръка': ['Strongarm', 'Eisenfaust'],
  Силния: ['the Strong', 'der Starke'], Каменния: ['the Stone', 'der Fels'], Мъдрия: ['the Wise', 'der Weise'],
  Хитрия: ['the Cunning', 'der Listige'], Умника: ['the Clever', 'der Kluge'], Знаещия: ['the Knowing', 'der Wissende'],
  Любопитния: ['the Curious', 'der Neugierige'], Скитника: ['the Wanderer', 'der Wanderer'], Търсача: ['the Seeker', 'der Sucher'],
  Будния: ['the Watchful', 'der Wachsame'], Добрия: ['the Kind', 'der Gute'], Веселия: ['the Merry', 'der Fröhliche'],
  Разказвача: ['the Storyteller', 'der Erzähler'], Миротвореца: ['the Peacemaker', 'der Friedensstifter'], Здравия: ['the Hale', 'der Unverwüstliche'],
  Дъба: ['the Oak', 'der Standhafte'], Неуморния: ['the Tireless', 'der Unermüdliche'], Тихия: ['the Quiet', 'der Stille'],
  Високия: ['the Tall', 'der Lange'], Рижавия: ['the Red', 'der Rote'], Бързия: ['the Swift', 'der Schnelle'],
  Малкия: ['the Little', 'der Kleine'], Черния: ['the Dark', 'der Schwarze'],
  Силната: ['the Strong', 'die Starke'], Яката: ['the Sturdy', 'die Kräftige'], Мъдрата: ['the Wise', 'die Weise'],
  Хитрата: ['the Cunning', 'die Listige'], Знаещата: ['the Knowing', 'die Wissende'], Билкарката: ['the Herbalist', 'die Kräuterfrau'],
  Любопитната: ['the Curious', 'die Neugierige'], Скитницата: ['the Wanderer', 'die Wanderin'], Търсачката: ['the Seeker', 'die Sucherin'],
  Будната: ['the Watchful', 'die Wachsame'], Добрата: ['the Kind', 'die Gute'], Веселата: ['the Merry', 'die Fröhliche'],
  Песнопойката: ['the Songstress', 'die Sängerin'], Здравата: ['the Hale', 'die Unverwüstliche'], Неуморната: ['the Tireless', 'die Unermüdliche'],
  Тихата: ['the Quiet', 'die Stille'], Високата: ['the Tall', 'die Lange'], Рижавата: ['the Red', 'die Rote'],
  Бързата: ['the Swift', 'die Schnelle'], Малката: ['the Little', 'die Kleine'], Черната: ['the Dark', 'die Schwarze'],
};
/** "Мечката" is a nickname for men and women: the bear and the she-bear */
const BEAR: Record<'m' | 'f', [string, string]> = { m: ['the Bear', 'der Bär'], f: ['the Bear', 'die Bärin'] };

/** the family names in the world come from the father's first name: Иван -> Иванов / Иванова */
let FAMILY: Map<string, string> | null = null;
function familyIndex(): Map<string, string> {
  if (FAMILY) return FAMILY;
  FAMILY = new Map();
  for (const m of Object.keys(MALE)) {
    FAMILY.set(familyOf(m, false), m);
    FAMILY.set(familyOf(m, true), m);
  }
  return FAMILY;
}
/** the same rule as the server: Иван -> Иванов, Никола -> Николов, Андрей -> Андреев */
function familyOf(fatherName: string, female: boolean): string {
  let base = fatherName;
  let suffix = 'ов';
  const last = base.slice(-1);
  if (last === 'а' || last === 'я') base = base.slice(0, -1);
  if (base.endsWith('й')) { base = base.slice(0, -1); suffix = 'ев'; }
  else if (/[жчшщцj]$/.test(base) || base.endsWith('ьо')) suffix = 'ев';
  else if (last === 'о' || last === 'е' || last === 'и') { base = base.slice(0, -1); suffix = 'ев'; }
  return base + suffix + (female ? 'а' : '');
}

const L = (lang: NameLang) => (lang === 'en' ? 0 : 1);

/** a first name, or null when it is not one of ours */
export function firstName(bg: string, lang: NameLang): string | null {
  const m = MALE[bg];
  if (m) return m[L(lang)];
  const f = FEMALE[bg];
  return f ? f[L(lang)] : null;
}

export const isFemaleName = (bg: string) => bg in FEMALE;
/** is the first name in a whole name ("Мария Петрова") a woman's? */
export const isWoman = (name: string) => isFemaleName(name.split(' ')[0]);

/**
 * a whole name as the server writes it: "Иван Петров", "Мария Мъдрата", "Стоян Яката ръка"
 * -> "John Peterson" / "Johann Petersen", "Mary the Wise" / "Maria die Weise", ...
 * Words it does not know are transliterated by `fallback`.
 */
export function personName(name: string, lang: NameLang, fallback: (s: string) => string): string {
  if (!name) return name;
  const sp = name.indexOf(' ');
  const first = sp < 0 ? name : name.slice(0, sp);
  const rest = sp < 0 ? '' : name.slice(sp + 1);
  const female = isFemaleName(first);
  const out = [firstName(first, lang) ?? fallback(first)];
  if (rest) {
    const k = L(lang);
    if (NICK[rest]) out.push(NICK[rest][k]);
    else if (rest === 'Мечката') out.push(BEAR[female ? 'f' : 'm'][k]);
    else {
      const father = familyIndex().get(rest);
      if (father) out.push(MALE[father][lang === 'en' ? 2 : 3]);
      else out.push(...rest.split(' ').map(fallback));
    }
  }
  return out.join(' ');
}

// ---------- villages ----------

/** roots of village names: Bulgarian -> [English, German] */
const ROOT: [string, string, string][] = [
  ['Бял', 'White', 'Weiß'], ['Черн', 'Black', 'Schwarz'], ['Камен', 'Stone', 'Stein'], ['Дъбр', 'Oak', 'Eichen'], ['Бор', 'Pine', 'Föhren'],
  ['Студен', 'Cold', 'Kalten'], ['Рос', 'Dew', 'Tau'], ['Горн', 'High', 'Hohen'], ['Долн', 'Low', 'Nieder'], ['Брез', 'Birch', 'Birken'],
  ['Вод', 'Water', 'Wasser'], ['Яв', 'Maple', 'Ahorn'], ['Липн', 'Lind', 'Linden'], ['Стрем', 'Swift', 'Strom'], ['Злат', 'Gold', 'Gold'],
  ['Сребр', 'Silver', 'Silber'], ['Лесков', 'Hazel', 'Hasel'], ['Глог', 'Thorn', 'Dorn'], ['Осен', 'Ash', 'Eschen'], ['Бук', 'Beech', 'Buchen'],
  ['Мечк', 'Bear', 'Bären'], ['Вълч', 'Wolf', 'Wolfs'], ['Орл', 'Eagle', 'Adler'], ['Соколн', 'Hawk', 'Falken'], ['Елов', 'Fir', 'Tannen'],
  ['Тихо', 'Still', 'Still'], ['Бистр', 'Clear', 'Lauter'], ['Мокр', 'Marsh', 'Moor'], ['Сух', 'Dry', 'Dürr'], ['Равн', 'Broad', 'Eben'],
  ['Крив', 'Crook', 'Krumm'], ['Стар', 'Old', 'Alten'], ['Нов', 'New', 'Neuen'], ['Скал', 'Rock', 'Felsen'], ['Пещер', 'Cave', 'Höhlen'],
  ['Връх', 'Peak', 'Spitz'], ['Мед', 'Honey', 'Honig'], ['Бърд', 'Hill', 'Berg'],
];
/** endings: Bulgarian -> [English, German] (the longest first, so that -ешница wins over -ица) */
const END: [string, string, string][] = ([
  ['ово', 'ford', 'dorf'], ['ево', 'ton', 'hausen'], ['ец', 'wick', 'bach'], ['ица', 'ham', 'heim'], ['ище', 'field', 'feld'],
  ['ен', 'stead', 'stedt'], ['ина', 'brook', 'au'], ['ешница', 'worth', 'rode'], ['анско', 'bury', 'burg'], ['еница', 'well', 'brunn'],
  ['овица', 'dale', 'tal'], ['ата', 'ley', 'wald'],
] as [string, string, string][]).sort((a, b) => b[0].length - a[0].length);

/** "Бялово" -> "Whiteford" / "Weißdorf", "Горно Бялово" -> "Upper Whiteford" / "Oberweißdorf"; null if it is not one of ours */
export function villageName(bg: string, lang: NameLang): string | null {
  let name = bg.trim();
  let up: '' | 'up' | 'down' = '';
  if (name.startsWith('Горно ')) { up = 'up'; name = name.slice(6); }
  else if (name.startsWith('Долно ')) { up = 'down'; name = name.slice(6); }
  // old fallback names carry a number: "Бялово 12"
  const num = /\s(\d+)$/.exec(name);
  if (num) name = name.slice(0, num.index);
  const k = lang === 'en' ? 1 : 2;
  for (const r of ROOT) {
    // a root that ends in a vowel loses it before an ending that starts with one: Тихо + ово = Тихово
    for (const root of [r[0], r[0].slice(0, -1)]) {
      if (!name.startsWith(root)) continue;
      const e = END.find((x) => name.slice(root.length) === x[0]);
      if (!e) continue;
      let out = r[k] + e[k];
      if (up) out = lang === 'en' ? `${up === 'up' ? 'Upper' : 'Lower'} ${out}` : `${up === 'up' ? 'Ober' : 'Unter'}${out.toLowerCase()}`;
      return num ? `${out} ${num[1]}` : out;
    }
  }
  return null;
}
