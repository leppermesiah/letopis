// Real city names that big towns take from the Iron Age on. Like people's names they are adapted, not translated:
// the same town is a Bulgarian city on the Bulgarian page, an English one on the English page and a German one on the
// German page. Now and then a city of the wide world comes in between, the same in all three languages.
// The most famous come first: the biggest towns take them.

// the year since which each city has had that name (roughly, from the usual histories)
const BG: [string, number][] = [['София', 1376], ['Пловдив', 1400], ['Варна', 680], ['Велико Търново', 1185], ['Бургас', 1700], ['Русе', 1380],
  ['Стара Загора', 1879], ['Плевен', 1266], ['Шумен', 1153], ['Несебър', 1300], ['Созопол', 100], ['Видин', 1000], ['Сливен', 1153],
  ['Казанлък', 1500], ['Габрово', 1430], ['Ловеч', 1190], ['Добрич', 1882], ['Хасково', 1385], ['Ямбол', 1300], ['Пазарджик', 1485],
  ['Благоевград', 1950], ['Враца', 1300], ['Кюстендил', 1500], ['Самоков', 1400], ['Мелник', 1200], ['Свищов', 1500], ['Силистра', 1500],
  ['Балчик', 1500], ['Карлово', 1485], ['Копривщица', 1500], ['Сопот', 1600], ['Трявна', 1400], ['Панагюрище', 1500], ['Банско', 1600],
  ['Смолян', 1960], ['Кърджали', 1700], ['Разград', 1600], ['Търговище', 1934], ['Монтана', 1993], ['Перник', 1000]];
const EN: [string, number][] = [['London', 50], ['York', 900], ['Bristol', 1000], ['Canterbury', 600], ['Oxford', 900], ['Cambridge', 875],
  ['Winchester', 700], ['Norwich', 900], ['Lincoln', 900], ['Bath', 700], ['Exeter', 900], ['Chester', 900], ['Durham', 995], ['Manchester', 1000],
  ['Liverpool', 1207], ['Leeds', 1000], ['Nottingham', 900], ['Coventry', 1043], ['Leicester', 900], ['Gloucester', 900], ['Worcester', 700],
  ['Salisbury', 1220], ['Hereford', 700], ['Lancaster', 1100], ['Carlisle', 1100], ['Newcastle', 1080], ['Plymouth', 1200], ['Southampton', 900],
  ['Portsmouth', 1180], ['Dover', 1000], ['Hastings', 1000], ['Ipswich', 700], ['Brighton', 1800], ['Birmingham', 1166], ['Sheffield', 1100],
  ['Derby', 900], ['Reading', 900], ['Wells', 900], ['Ely', 673], ['Sunderland', 1000]];
const DE: [string, number][] = [['Berlin', 1237], ['Köln', 50], ['München', 1158], ['Hamburg', 830], ['Nürnberg', 1050], ['Dresden', 1206],
  ['Leipzig', 1015], ['Frankfurt', 794], ['Regensburg', 500], ['Trier', 300], ['Aachen', 800], ['Lübeck', 1143], ['Mainz', 300], ['Augsburg', 400],
  ['Würzburg', 704], ['Heidelberg', 1196], ['Freiburg', 1120], ['Bremen', 787], ['Hannover', 1150], ['Stuttgart', 950], ['Bonn', 300],
  ['Erfurt', 742], ['Weimar', 899], ['Potsdam', 993], ['Rostock', 1218], ['Magdeburg', 805], ['Halle', 806], ['Kassel', 913], ['Münster', 793],
  ['Ulm', 854], ['Konstanz', 300], ['Passau', 739], ['Bamberg', 902], ['Göttingen', 953], ['Kiel', 1242], ['Koblenz', 300], ['Wiesbaden', 829],
  ['Bayreuth', 1194], ['Jena', 1182], ['Düsseldorf', 1288]];
const WORLD: [string, string, string, number][] = [
  ['Рим', 'Rome', 'Rom', -753], ['Атина', 'Athens', 'Athen', -1400], ['Цариград', 'Constantinople', 'Konstantinopel', 330], ['Александрия', 'Alexandria', 'Alexandria', -331],
  ['Йерусалим', 'Jerusalem', 'Jerusalem', -1800], ['Венеция', 'Venice', 'Venedig', 421], ['Париж', 'Paris', 'Paris', 300], ['Виена', 'Vienna', 'Wien', 881],
  ['Флоренция', 'Florence', 'Florenz', -59], ['Прага', 'Prague', 'Prag', 880], ['Дамаск', 'Damascus', 'Damaskus', -2000], ['Багдад', 'Baghdad', 'Bagdad', 762],
  ['Кайро', 'Cairo', 'Kairo', 969], ['Мадрид', 'Madrid', 'Madrid', 865], ['Лисабон', 'Lisbon', 'Lissabon', -200], ['Амстердам', 'Amsterdam', 'Amsterdam', 1275],
  ['Неапол', 'Naples', 'Neapel', -600], ['Солун', 'Thessaloniki', 'Thessaloniki', -315], ['Будапеща', 'Budapest', 'Budapest', 1873], ['Варшава', 'Warsaw', 'Warschau', 1300],
  ['Москва', 'Moscow', 'Moskau', 1147], ['Пекин', 'Beijing', 'Peking', 1421], ['Делхи', 'Delhi', 'Delhi', 1052], ['Токио', 'Tokyo', 'Tokio', 1868],
  ['Брюксел', 'Brussels', 'Brüssel', 979], ['Копенхаген', 'Copenhagen', 'Kopenhagen', 1167], ['Стокхолм', 'Stockholm', 'Stockholm', 1252], ['Букурещ', 'Bucharest', 'Bukarest', 1459],
  ['Белград', 'Belgrade', 'Belgrad', 878], ['Ню Йорк', 'New York', 'New York', 1664],
];

/** [Bulgarian, English, German, the year since which all three have their name], the most famous first: two of the home
 *  country, then one of the world. A town takes a name only once its year has come. */
export const CITIES: [string, string, string, number][] = [];
for (let i = 0, w = 0; i < BG.length || w < WORLD.length; i++) {
  if (i < BG.length) CITIES.push([BG[i][0], EN[i][0], DE[i][0], Math.max(BG[i][1], EN[i][1], DE[i][1])]);
  if (i % 2 === 1 && w < WORLD.length) CITIES.push(WORLD[w++]);
}

const BY_BG = new Map(CITIES.map((c) => [c[0], c]));

/** the year since which the city has its name */
export const cityYear = (bg: string): number => BY_BG.get(bg)?.[3] ?? -1e9;

/** the city in a language, or null if the name is not one of these cities */
export function cityName(bg: string, lang: 'en' | 'de'): string | null {
  const c = BY_BG.get(bg);
  return c ? c[lang === 'en' ? 1 : 2] : null;
}

export const isCity = (bg: string | null | undefined): boolean => !!bg && BY_BG.has(bg);
