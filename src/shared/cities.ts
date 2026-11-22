// Real city names that big towns take from the Iron Age on. Like people's names they are adapted, not translated:
// the same town is a Bulgarian city on the Bulgarian page, an English one on the English page and a German one on the
// German page. Now and then a city of the wide world comes in between, the same in all three languages.
// The most famous come first: the biggest towns take them.

const BG = ['София', 'Пловдив', 'Варна', 'Велико Търново', 'Бургас', 'Русе', 'Стара Загора', 'Плевен', 'Шумен', 'Несебър', 'Созопол', 'Видин',
  'Сливен', 'Казанлък', 'Габрово', 'Ловеч', 'Добрич', 'Хасково', 'Ямбол', 'Пазарджик', 'Благоевград', 'Враца', 'Кюстендил', 'Самоков',
  'Мелник', 'Свищов', 'Силистра', 'Балчик', 'Карлово', 'Копривщица', 'Сопот', 'Трявна', 'Панагюрище', 'Банско', 'Смолян', 'Кърджали',
  'Разград', 'Търговище', 'Монтана', 'Перник'];
const EN = ['London', 'York', 'Bristol', 'Canterbury', 'Oxford', 'Cambridge', 'Winchester', 'Norwich', 'Lincoln', 'Bath', 'Exeter', 'Chester',
  'Durham', 'Manchester', 'Liverpool', 'Leeds', 'Nottingham', 'Coventry', 'Leicester', 'Gloucester', 'Worcester', 'Salisbury', 'Hereford',
  'Lancaster', 'Carlisle', 'Newcastle', 'Plymouth', 'Southampton', 'Portsmouth', 'Dover', 'Hastings', 'Ipswich', 'Brighton', 'Birmingham',
  'Sheffield', 'Derby', 'Reading', 'Wells', 'Ely', 'Sunderland'];
const DE = ['Berlin', 'Köln', 'München', 'Hamburg', 'Nürnberg', 'Dresden', 'Leipzig', 'Frankfurt', 'Regensburg', 'Trier', 'Aachen', 'Lübeck',
  'Mainz', 'Augsburg', 'Würzburg', 'Heidelberg', 'Freiburg', 'Bremen', 'Hannover', 'Stuttgart', 'Bonn', 'Erfurt', 'Weimar', 'Potsdam',
  'Rostock', 'Magdeburg', 'Halle', 'Kassel', 'Münster', 'Ulm', 'Konstanz', 'Passau', 'Bamberg', 'Göttingen', 'Kiel', 'Koblenz', 'Wiesbaden',
  'Bayreuth', 'Jena', 'Düsseldorf'];
const WORLD: [string, string, string][] = [
  ['Рим', 'Rome', 'Rom'], ['Атина', 'Athens', 'Athen'], ['Цариград', 'Constantinople', 'Konstantinopel'], ['Александрия', 'Alexandria', 'Alexandria'],
  ['Йерусалим', 'Jerusalem', 'Jerusalem'], ['Венеция', 'Venice', 'Venedig'], ['Париж', 'Paris', 'Paris'], ['Виена', 'Vienna', 'Wien'],
  ['Флоренция', 'Florence', 'Florenz'], ['Прага', 'Prague', 'Prag'], ['Дамаск', 'Damascus', 'Damaskus'], ['Багдад', 'Baghdad', 'Bagdad'],
  ['Кайро', 'Cairo', 'Kairo'], ['Мадрид', 'Madrid', 'Madrid'], ['Лисабон', 'Lisbon', 'Lissabon'], ['Амстердам', 'Amsterdam', 'Amsterdam'],
  ['Неапол', 'Naples', 'Neapel'], ['Солун', 'Thessaloniki', 'Thessaloniki'], ['Будапеща', 'Budapest', 'Budapest'], ['Варшава', 'Warsaw', 'Warschau'],
  ['Москва', 'Moscow', 'Moskau'], ['Пекин', 'Beijing', 'Peking'], ['Делхи', 'Delhi', 'Delhi'], ['Токио', 'Tokyo', 'Tokio'],
  ['Брюксел', 'Brussels', 'Brüssel'], ['Копенхаген', 'Copenhagen', 'Kopenhagen'], ['Стокхолм', 'Stockholm', 'Stockholm'], ['Букурещ', 'Bucharest', 'Bukarest'],
  ['Белград', 'Belgrade', 'Belgrad'], ['Ню Йорк', 'New York', 'New York'],
];

/** [Bulgarian, English, German], the most famous first: two of the home country, then one of the world */
export const CITIES: [string, string, string][] = [];
for (let i = 0, w = 0; i < BG.length || w < WORLD.length; i++) {
  if (i < BG.length) CITIES.push([BG[i], EN[i], DE[i]]);
  if (i % 2 === 1 && w < WORLD.length) CITIES.push(WORLD[w++]);
}

const BY_BG = new Map(CITIES.map((c) => [c[0], c]));

/** the city in a language, or null if the name is not one of these cities */
export function cityName(bg: string, lang: 'en' | 'de'): string | null {
  const c = BY_BG.get(bg);
  return c ? c[lang === 'en' ? 1 : 2] : null;
}

export const isCity = (bg: string | null | undefined): boolean => !!bg && BY_BG.has(bg);
