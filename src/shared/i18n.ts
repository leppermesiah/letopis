// English for Letopis. The world speaks Bulgarian inside the simulation; everything a player reads can also be shown
// in English (here) and German (i18n-de.ts). People and villages get names of their own in each language
// (Иван Петров is John Peterson), totems and clan names are translated.

import { CLAN_EN, clanBase } from './clans';
import { personName, villageName } from './people-l10n';

export type Lang = 'bg' | 'en' | 'de';

const TR: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p',
  р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sht', ъ: 'a', ь: 'y', ю: 'yu', я: 'ya',
};

/** Bulgarian streamlined transliteration */
export function translit(s: string): string {
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    const low = c.toLowerCase();
    const t = TR[low];
    if (t === undefined) { out += c; continue; }
    // "-ия" at the end of a word is written -ia (Мария -> Maria)
    if (low === 'я' && s[i - 1]?.toLowerCase() === 'и' && !/[а-я]/i.test(s[i + 1] ?? '')) { out += c === low ? 'a' : 'A'; continue; }
    out += c === low ? t : t[0].toUpperCase() + t.slice(1);
  }
  return out;
}

/** "Иван Мъдрия" -> "John the Wise", "Мария Петрова" -> "Mary Peterson" */
export function personEn(name: string): string {
  return personName(name, 'en', translit);
}

/** "Бялово" -> "Whiteford" */
export function villageEn(name: string): string {
  return villageName(name, 'en') ?? translit(name);
}

// totems, adjectives and places of band names, by their dictionary form and with the article
const WORDS: [string, string][] = [
  ['Вълк', 'Wolf'], ['Орел', 'Eagle'], ['Орела', 'Eagle'], ['Елен', 'Stag'], ['Сокол', 'Falcon'], ['Глиган', 'Boar'], ['Бизон', 'Bison'],
  ['Бухал', 'Eagle-Owl'], ['Дъб', 'Oak'], ['Камък', 'Stone'], ['Камъка', 'Stone'], ['Огън', 'Fire'], ['Огъня', 'Fire'], ['Вятър', 'Wind'], ['Вятъра', 'Wind'],
  ['Гарван', 'Raven'], ['Рис', 'Lynx'], ['Бобър', 'Beaver'], ['Бобъра', 'Beaver'], ['Кон', 'Horse'], ['Коня', 'Horse'], ['Ястреб', 'Hawk'], ['Бор', 'Pine'],
  ['Облак', 'Cloud'], ['Лъв', 'Lion'], ['Щъркел', 'Stork'], ['Мамут', 'Mammoth'], ['Тур', 'Aurochs'], ['Зубър', 'Wisent'], ['Зубъра', 'Wisent'],
  ['Гром', 'Thunder'], ['Кремък', 'Flint'], ['Кремъка', 'Flint'], ['Вихър', 'Whirlwind'], ['Вихъра', 'Whirlwind'], ['Здрач', 'Dusk'], ['Изгрев', 'Sunrise'],
  ['Залез', 'Sunset'], ['Ручей', 'Brook'], ['Ручея', 'Brook'], ['Руче', 'Brook'], ['Водопад', 'Waterfall'], ['Лебед', 'Swan'], ['Жерав', 'Crane'],
  ['Таралеж', 'Hedgehog'], ['Козирог', 'Ibex'], ['Скорпион', 'Scorpion'], ['Кълвач', 'Woodpecker'], ['Чинар', 'Plane Tree'], ['Явор', 'Sycamore'], ['Бръшлян', 'Ivy'],
  ['Мечка', 'Bear'], ['Лисица', 'Fox'], ['Риба', 'Fish'], ['Река', 'River'], ['Звезда', 'Star'], ['Луна', 'Moon'], ['Сърна', 'Doe'], ['Сова', 'Owl'],
  ['Змия', 'Serpent'], ['Пчела', 'Bee'], ['Скала', 'Cliff'], ['Планина', 'Mountain'], ['Роса', 'Dew'], ['Гора', 'Forest'], ['Зорница', 'Morning Star'],
  ['Лястовица', 'Swallow'], ['Мълния', 'Lightning'], ['Кошута', 'Hind'], ['Вълчица', 'She-Wolf'], ['Чапла', 'Heron'], ['Пеперуда', 'Butterfly'],
  ['Върба', 'Willow'], ['Липа', 'Linden'], ['Буря', 'Storm'], ['Зора', 'Dawn'], ['Дъга', 'Rainbow'], ['Мравка', 'Ant'], ['Видра', 'Otter'],
  ['Катерица', 'Squirrel'], ['Костенурка', 'Tortoise'], ['Калинка', 'Ladybird'], ['Сойка', 'Jay'], ['Кукумявка', 'Little Owl'],
  ['Слънцето', 'Sun'], ['Езерото', 'Lake'], ['Еленчето', 'Fawn'], ['Пламъчето', 'Little Flame'], ['Ехото', 'Echo'], ['Огнището', 'Hearth'],
  ['Небето', 'Sky'], ['Сърцето', 'Heart'],
  ['Хълм', 'Hill'], ['Брод', 'Ford'], ['Извор', 'Spring'], ['Бряг', 'Shore'], ['Дол', 'Dale'], ['Кладенец', 'Well'], ['Проход', 'Pass'],
  ['Долина', 'Valley'], ['Пещера', 'Cave'], ['Поляна', 'Meadow'], ['Падина', 'Hollow'], ['Могила', 'Mound'], ['Степ', 'Steppe'],
];
const ADJ: [string, string, string][] = [
  ['Белия', 'Бялата', 'White'], ['Сивия', 'Сивата', 'Grey'], ['Черния', 'Черната', 'Black'], ['Червения', 'Червената', 'Red'],
  ['Златния', 'Златната', 'Golden'], ['Стария', 'Старата', 'Old'], ['Бързия', 'Бързата', 'Swift'], ['Тихия', 'Тихата', 'Quiet'],
  ['Големия', 'Голямата', 'Great'], ['Малкия', 'Малката', 'Little'], ['Мъдрия', 'Мъдрата', 'Wise'], ['Самотния', 'Самотната', 'Lonely'],
  ['Северния', 'Северната', 'Northern'], ['Южния', 'Южната', 'Southern'], ['Сребърния', 'Сребърната', 'Silver'], ['Огнения', 'Огнената', 'Fiery'],
  ['Ледения', 'Ледената', 'Icy'], ['Звездния', 'Звездната', 'Starry'], ['Нощния', 'Нощната', 'Night'], ['Утринния', 'Утринната', 'Morning'],
  ['Буйния', 'Буйната', 'Unruly'], ['Каменния', 'Каменната', 'Stone'], ['Небесния', 'Небесната', 'Heavenly'], ['Дивия', 'Дивата', 'Wild'],
  ['Пеещия', 'Пеещата', 'Singing'], ['Шепнещия', 'Шепнещата', 'Whispering'], ['Синия', 'Синята', 'Blue'], ['Ранения', 'Ранената', 'Wounded'],
];
const WORD_EN = new Map<string, string>(WORDS);
for (const [m, f, en] of ADJ) { WORD_EN.set(m, en); WORD_EN.set(f, en); }

function wordEn(w: string): string {
  return WORD_EN.get(w) ?? WORD_EN.get(w.slice(0, -1)) ?? WORD_EN.get(w.slice(0, -2)) ?? translit(w);
}
const phraseEn = (s: string) => s.split(' ').map(wordEn).join(' ');

/** "Родът на Вълка от Ледения Хълм" -> "Clan of the Wolf from the Icy Hill" */
export function bandEn(name: string): string {
  const c = clanBase(name);
  if (c) return CLAN_EN.get(c[0])! + c[1];
  const m = /^(?:Родът|рода) на (.+)$/.exec(name);
  if (!m) return translit(name);
  const [totem, place] = m[1].split(' от ');
  return `Clan of the ${phraseEn(totem)}${place ? ` from the ${phraseEn(place)}` : ''}`;
}

/** how a band is named inside an English sentence: "the Clan of the Wolf", "the village of Belovo" */
export function bandLabelEn(name: string, settlement: string | null | undefined, subject = false): string {
  const the = subject ? 'The' : 'the';
  return settlement ? `${the} village of ${villageEn(settlement)}` : bandThe(name, subject);
}

/** "the Wolf Tooth", "the Silent" (never "the The Silent") */
export function bandThe(name: string, subject = false): string {
  const en = bandEn(name);
  if (en.startsWith('The ')) return subject ? en : `the ${en.slice(4)}`;
  return `${subject ? 'The' : 'the'} ${en}`;
}

/** any band text the server writes in Bulgarian: "Родът на ...", "рода на ...", "Селото X", a village name */
export function bandTextEn(s: string): string {
  if (!s) return s;
  if (/^(Родът|рода) на /.test(s)) return (s[0] === 'Р' ? 'The ' : 'the ') + bandEn(s);
  if (clanBase(s)) return bandThe(s);
  const v = /^(Селото|селото) (.+)$/.exec(s);
  if (v) return `${v[1][0] === 'С' ? 'The' : 'the'} village of ${villageEn(v[2])}`;
  return villageEn(s);
}

export const TECH_EN: Record<string, { name: string; text: string; kids: string }> = {
  fire: { name: 'Fire', text: '{name} of {band} tamed fire. The nights are no longer so cold and frightening.', kids: '{name} lit the first fire! Now people keep warm and cook their food.' },
  stone_tools: { name: 'Stone Tools', text: '{name} of {band} learned to knap flint into sharp blades.', kids: '{name} made a knife of stone. Cutting is so much easier now!' },
  herb_lore: { name: 'Herb Lore', text: '{name} of {band} remembered which herbs heal and which poison.', kids: '{name} found out which plants cure a tummy ache.' },
  burial: { name: 'Burial Rites', text: '{Band} sent off its dead with a rite for the first time. {name} sang over the grave.', kids: '{Band} began to remember its grandmothers and grandfathers with songs.' },
  spear: { name: 'Spear', text: '{name} of {band} tied a stone point to a long stick. Hunting gets safer.', kids: '{name} invented the spear. Hunters no longer have to get so close to the beasts.' },
  clothing: { name: 'Hide Clothing', text: '{name} of {band} sewed the first clothes from hides. Winter is no longer a death sentence.', kids: '{name} sewed warm clothes from hides. Now you can go out in winter too!' },
  cave_art: { name: 'Cave Paintings', text: '{name} of {band} painted a hunt on the cave wall with ochre and charcoal.', kids: '{name} painted animals on the cave wall. The first pictures in the world!' },
  fishing: { name: 'Fishing', text: '{name} of {band} learned to catch fish with a harpoon.', kids: '{name} caught the first fish with a harpoon. The river gives food now!' },
  shelter: { name: 'Tents', text: '{name} of {band} stretched hides over bones and branches. The first tents.', kids: '{name} made a tent. Now you can sleep dry anywhere.' },
  bow: { name: 'Bow and Arrows', text: '{name} of {band} strung sinew on a bent stick. The bow strikes from afar.', kids: '{name} invented the bow! Arrows fly far.' },
  dog: { name: 'Tamed Dog', text: 'Wolf pups stayed by the fire of {band}. {name} fed them and they became the first dogs.', kids: '{name} found a friend: a little wolf cub that became the first dog!' },
  grinding: { name: 'Grain Grinding', text: '{name} of {band} ground wild grain between two stones. The flour becomes food for the winter.', kids: '{name} crushed seeds between two stones and made flour.' },
  agriculture: { name: 'Agriculture', text: '{name} of {band} noticed that fallen grains sprout new plants. The clan sows its first field and stops wandering.', kids: '{name} planted seeds and new plants grew from them! People can stay in one place now.' },
  pottery: { name: 'Pottery', text: '{name} of {band} fired clay in the fire. Pots keep food safe from mice and damp.', kids: '{name} baked a clay pot. Now food keeps for a long time!' },
  herding: { name: 'Herding', text: '{name} of {band} penned wild goats in a fold. Meat and milk without hunting.', kids: '{name} tamed goats. Now there is milk every day!' },
  weaving: { name: 'Weaving', text: '{name} of {band} spun flax into thread and wove it into cloth.', kids: '{name} wove the first cloth. Clothes become soft and light.' },
  mudbrick: { name: 'Mud Houses', text: 'In {band}, {name} raised the first house of wattle and daub. The village starts to feel like home.', kids: '{name} built a real house of clay!' },
  boats: { name: 'Dugout Canoe', text: '{name} of {band} carved a canoe from a log. Rivers are no longer a border.', kids: '{name} made a boat and set off down the river!' },
  copper: { name: 'Copper', text: '{name} of {band} noticed that a green stone in the glow of the pottery kiln gives off a shiny red metal. The first copper needles and awls.', kids: '{name} melted a green stone in the fire and red metal flowed out of it: copper!' },
  plough: { name: 'Plough', text: '{name} of {band} yoked an ox to a sharp wooden stake. A field is ploughed in a day instead of a week.', kids: '{name} got the ox to pull the plough. Now the fields can be much bigger!' },
  wheel: { name: 'Wheel', text: '{name} of {band} put a wooden disc on an axle. The first cart carries a load three people could not lift.', kids: '{name} invented the wheel! The cart carries heavy things instead of people.' },
  bronze: { name: 'Bronze', text: '{name} of {band} mixed copper with tin and got a metal harder than any stone. A new age begins.', kids: '{name} mixed two metals and made bronze: hard and golden!' },
  sailing: { name: 'Sail', text: '{name} of {band} stretched woven cloth on a boat. The wind carries it farther than rowers can reach.', kids: '{name} put a sail on the boat and the wind pushed it along!' },
  writing: { name: 'Writing', text: '{name} of {band} pressed signs into wet clay to remember how much grain is in the granary. The first writing.', kids: '{name} drew signs in the clay that others can read. That is writing!' },
  trade: { name: 'Trade', text: '{name} of {band} loaded a cart with pots and came back with flint, salt and copper. Neighbours now help each other.', kids: '{name} swapped pots for salt with the neighbours. Everyone was happy!' },
  walls: { name: 'City Walls', text: '{Band} raised stone walls around its houses. {name} led the work. The village becomes a town.', kids: '{name} built a tall wall around the village. Now it is a real town!' },
  calendar: { name: 'Calendar', text: '{name} of {band} counted the days from one full moon to the next and wrote down when to sow. The harvest is no longer late.', kids: '{name} found out exactly when to sow the seeds by watching the moon and the stars.' },
  horse: { name: 'Tamed Horse', text: '{name} of {band} tamed a wild horse and hitched it to the cart. The road to the neighbours became three times shorter.', kids: '{name} made friends with a horse and now they ride together!' },
  iron: { name: 'Iron', text: '{name} of {band} fired the furnace hotter than ever, and a dark metal came out of the red ore. Iron is everywhere and cheaper than bronze. A new age begins.', kids: '{name} forged iron: dark, strong and found everywhere!' },
  alphabet: { name: 'Alphabet', text: '{name} of {band} gave each sound a sign of its own. Hundreds of signs are no longer needed: two dozen are enough to write any word.', kids: '{name} invented the alphabet: just a few letters, and you can write anything with them!' },
  harbor: { name: 'Harbour', text: '{name} of {band} piled stones in the bay and built a pier. Ships now stop here and bring goods from distant shores.', kids: '{name} built a harbour, and ships come to visit from far away!' },
  kingdom: { name: 'Kingdom', text: '{Band} gathered the neighbouring villages under one crown, and {name} took it. The first kingdom is born without a single battle.', kids: '{name} brought several villages together into one kingdom by inviting them all to a big feast!' },
  coins: { name: 'Coins', text: '{name} of {band} struck small silver discs of equal weight with a stamp. Nobody has to drag cows and pots around to buy something anymore.', kids: '{name} made the first coins. You can buy anything with them, no need to bring a cow along!' },
  laws: { name: 'Written Laws', text: '{name} of {band} carved the laws on a stone slab in the square. Anyone can read them, and the judge can no longer decide on a whim.', kids: '{name} wrote the rules on a big stone so they are the same for everyone.' },
  theatre: { name: 'Theatre', text: '{name} of {band} put on a mask and acted out an old legend before the whole town. People wept and laughed together.', kids: '{name} put on a funny mask and everyone laughed!' },
  medicine: { name: 'Medicine', text: '{name} of {band} wrote down which herb cures which illness. Healers now learn from scrolls, not only from their grandmothers.', kids: '{name} wrote down how to cure illnesses, so others can help too.' },
  aqueduct: { name: 'Aqueduct', text: '{Band} brought water from the mountains along stone arches. {name} led the work. Clean water flows in the town and there is less sickness.', kids: '{name} built a stone bridge for water, and it flows all the way to the town!' },
  library: { name: 'Library', text: '{name} of {band} gathered all the scrolls in one place. What is learned once is no longer forgotten.', kids: '{name} put lots of scrolls in one house. Everyone can read there!' },
  watermill: { name: 'Watermill', text: '{name} of {band} put a wheel in the river and made it turn the millstone. The river grinds the flour instead of people.', kids: '{name} got the river to turn a big wheel, and it grinds flour all by itself!' },
  arch: { name: 'Arch and Concrete', text: '{name} of {band} mixed volcanic sand with lime and built an arch that holds itself up. Bridges and domes now stand for centuries.', kids: '{name} made a stone you can pour like mud, and then it turns hard!' },
  heavy_plough: { name: 'Heavy Plough', text: '{name} of {band} gave the plough an iron share and wheels and hitched two horses in padded collars. The heavy clay of the north can now be ploughed. A new age begins.', kids: '{name} made a plough that two horses pull through the heaviest soil!' },
  monastery: { name: 'Monastery', text: '{name} of {band} founded a monastery near the village. The monks copy the old books, care for the sick and teach the children to read.', kids: '{name} built a monastery where the monks look after the books and help the sick.' },
  knighthood: { name: 'Knighthood', text: '{name} of {band} swore before the king to protect the weak and the travellers. The first knight appeared on horseback, in iron mail, with a sword he never draws first.', kids: '{name} became a knight: rides a big horse and keeps travellers safe on the road!' },
  three_field: { name: 'Three-Field System', text: '{name} of {band} split the fields in three: winter wheat in one, spring barley in another, and the third rests. The soil no longer wears out.', kids: '{name} came up with letting a field rest every third year, so it grows more.' },
  castle: { name: 'Castle', text: '{Band} raised a stone castle on the hill above the houses. {name} led the work. In times of trouble the whole village takes shelter behind its thick walls.', kids: '{name} built a real castle with towers and a drawbridge!' },
  paper: { name: 'Paper', text: '{name} of {band} pounded old rags in water, scooped the pulp up with a fine frame and dried it. Paper is far cheaper than parchment.', kids: '{name} made paper out of old rags. Now everyone can write!' },
  guilds: { name: 'Guilds', text: '{name} of {band} brought the masters of one craft together in a guild. They train the apprentices, keep up the quality and help each other in bad years.', kids: '{name} brought all the masters together in a guild. They teach children their craft!' },
  gothic: { name: 'Gothic Church', text: '{name} of {band} raised a church with pointed vaults and tall windows of coloured glass. Inside, the light falls in bright patches on the floor.', kids: '{name} built a church with coloured windows that turn the light into a rainbow!' },
  university: { name: 'University', text: '{name} of {band} invited scholars from distant lands. They argue, write and teach the young arithmetic, the stars, law and medicine. It is the first university.', kids: '{name} founded a school for grown-ups where you can learn everything!' },
  windmill: { name: 'Windmill', text: '{name} of {band} put sails on a wooden wheel on top of the hill. The wind turns the millstone even where there is no river.', kids: '{name} got the wind to turn a big mill!' },
  compass: { name: 'Compass', text: '{name} of {band} noticed that a magnetised needle always points north. Ships now find their way in fog and far from the shore.', kids: '{name} found a needle that always points north. Ships no longer get lost!' },
  clock: { name: 'Mechanical Clock', text: '{name} of {band} built a clock of gears and a weight and put it up on the tower. Now the whole village knows the time.', kids: '{name} built a big clock on the tower. Now everyone knows when it is lunchtime!' },
  printing: { name: 'Printing Press', text: '{name} of {band} cast letters in metal, set them in a frame and pressed them onto paper. In one day more pages are printed than a monk can write in a year.', kids: '{name} invented a machine that writes books instead of people!' },
};
export const TECH_BG: Record<string, string> = {
  Огън: 'fire', 'Каменни сечива': 'stone_tools', 'Познание за билките': 'herb_lore', 'Погребални обреди': 'burial', Копие: 'spear',
  'Облекло от кожи': 'clothing', 'Скални рисунки': 'cave_art', Риболов: 'fishing', Шатри: 'shelter', 'Лък и стрели': 'bow',
  'Опитомено куче': 'dog', 'Мелене на зърно': 'grinding', Земеделие: 'agriculture', Керамика: 'pottery', Скотовъдство: 'herding',
  Тъкане: 'weaving', 'Глинени къщи': 'mudbrick', 'Лодка от дънер': 'boats',
  Мед: 'copper', Рало: 'plough', Колело: 'wheel', Бронз: 'bronze', Платно: 'sailing', Писменост: 'writing', Търговия: 'trade',
  'Крепостни стени': 'walls', Календар: 'calendar', 'Опитомен кон': 'horse',
  Желязо: 'iron', Азбука: 'alphabet', Пристанище: 'harbor', Царство: 'kingdom', Монети: 'coins', 'Писани закони': 'laws', Театър: 'theatre', Медицина: 'medicine', Акведукт: 'aqueduct', Библиотека: 'library', 'Водна мелница': 'watermill', 'Свод и бетон': 'arch',
  'Тежък плуг': 'heavy_plough', Манастир: 'monastery', Рицарство: 'knighthood', 'Трипольна система': 'three_field', Замък: 'castle', Хартия: 'paper', Гилдии: 'guilds', 'Готически храм': 'gothic', Университет: 'university', 'Вятърна мелница': 'windmill', Компас: 'compass', 'Механичен часовник': 'clock', 'Печатна преса': 'printing',
};
/** every discovery the game knows, in the order history found them: [id, Bulgarian name, era] */
export const TECH_LIST: [string, string, number][] = [
  ['fire', 'Огън', 0], ['stone_tools', 'Каменни сечива', 0], ['burial', 'Погребални обреди', 0], ['spear', 'Копие', 0],
  ['herb_lore', 'Познание за билките', 0], ['clothing', 'Облекло от кожи', 0], ['cave_art', 'Скални рисунки', 0], ['shelter', 'Шатри', 0],
  ['fishing', 'Риболов', 0], ['dog', 'Опитомено куче', 0], ['bow', 'Лък и стрели', 0], ['boats', 'Лодка от дънер', 1],
  ['grinding', 'Мелене на зърно', 1], ['pottery', 'Керамика', 1], ['herding', 'Скотовъдство', 1], ['agriculture', 'Земеделие', 1],
  ['weaving', 'Тъкане', 1], ['mudbrick', 'Глинени къщи', 1], ['copper', 'Мед', 1], ['plough', 'Рало', 1], ['wheel', 'Колело', 1],
  ['bronze', 'Бронз', 2], ['sailing', 'Платно', 2], ['writing', 'Писменост', 2], ['trade', 'Търговия', 2], ['walls', 'Крепостни стени', 2],
  ['calendar', 'Календар', 2], ['horse', 'Опитомен кон', 2],
  ['iron', 'Желязо', 3], ['alphabet', 'Азбука', 3], ['harbor', 'Пристанище', 3], ['kingdom', 'Царство', 3], ['coins', 'Монети', 3], ['laws', 'Писани закони', 3], ['theatre', 'Театър', 3], ['medicine', 'Медицина', 3], ['aqueduct', 'Акведукт', 3], ['library', 'Библиотека', 3], ['watermill', 'Водна мелница', 3], ['arch', 'Свод и бетон', 3],
  ['heavy_plough', 'Тежък плуг', 4], ['monastery', 'Манастир', 4], ['knighthood', 'Рицарство', 4], ['three_field', 'Трипольна система', 4], ['castle', 'Замък', 4], ['paper', 'Хартия', 4], ['guilds', 'Гилдии', 4], ['gothic', 'Готически храм', 4], ['university', 'Университет', 4], ['windmill', 'Вятърна мелница', 4], ['compass', 'Компас', 4], ['clock', 'Механичен часовник', 4], ['printing', 'Печатна преса', 4],
];

/** a line about each discovery, for the ones still to come: [Bulgarian, English] */
export const TECH_DESC: Record<string, [string, string]> = {
  fire: ['Да опитомиш огъня: топлина, светлина и печено месо.', 'Taming fire: warmth, light and cooked meat.'],
  stone_tools: ['Остри ножове и стъргала от кремък.', 'Sharp knives and scrapers knapped from flint.'],
  burial: ['Мъртвите се изпращат с обред и се помнят.', 'The dead are sent off with a rite and remembered.'],
  spear: ['Каменен връх на дълга пръчка: ловът става по-безопасен.', 'A stone point on a long shaft: safer hunting.'],
  herb_lore: ['Кои треви лекуват и кои тровят.', 'Which plants heal and which ones poison.'],
  clothing: ['Дрехи от кожи, за да се преживее зимата.', 'Clothes sewn from hides to survive the winter.'],
  cave_art: ['Рисунки с охра и въглен по стените на пещерите.', 'Pictures in ochre and charcoal on cave walls.'],
  shelter: ['Кожи, опънати върху кости и клони: подслон навсякъде.', 'Hides stretched over bones and branches: shelter anywhere.'],
  fishing: ['Харпун и риба от реката.', 'A harpoon, and fish from the river.'],
  dog: ['Вълчетата край огъня стават първите кучета.', 'Wolf pups by the fire become the first dogs.'],
  bow: ['Жила върху огъната пръчка: удар от далеч.', 'Sinew on a bent stick: striking from afar.'],
  grinding: ['Зърно, смляно между два камъка, става брашно.', 'Grain ground between two stones becomes flour.'],
  agriculture: ['Засетите зърна дават ниви, а родът спира да скита.', 'Sown grain gives fields, and the clan stops wandering.'],
  pottery: ['Изпечена глина пази храната от мишки и влага.', 'Fired clay keeps food safe from mice and damp.'],
  herding: ['Кози и овце в кошара: мляко и месо без лов.', 'Goats and sheep in a fold: milk and meat without hunting.'],
  weaving: ['Лен, изпреден на конец и изтъкан на плат.', 'Flax spun into thread and woven into cloth.'],
  mudbrick: ['Къщи от плет и кал: селото става дом.', 'Houses of wattle and daub: the village becomes home.'],
  boats: ['Издълбан дънер: реките вече не са граница.', 'A hollowed log: rivers are no longer a border.'],
  copper: ['Зелен камък в жарта дава червен метал.', 'A green stone in the embers gives a red metal.'],
  plough: ['Вол и заострен кол: нива за ден вместо за седмица.', 'An ox and a sharp stake: a field in a day, not a week.'],
  wheel: ['Дървен кръг на ос и първата каруца.', 'A wooden disc on an axle, and the first cart.'],
  bronze: ['Мед и калай дават метал, по-твърд от камък.', 'Copper and tin make a metal harder than stone.'],
  sailing: ['Платно на лодката: вятърът гребе вместо хората.', 'A sail on the boat: the wind rows instead of people.'],
  writing: ['Знаци в глината, които помнят вместо хората.', 'Marks in clay that remember for people.'],
  trade: ['Размяна на стоки между далечни села.', 'Goods exchanged between distant villages.'],
  walls: ['Каменни стени около селото: първите градове.', 'Stone walls around the village: the first towns.'],
  calendar: ['Звездите казват кога да се сее и кога да се жъне.', 'The stars tell when to sow and when to reap.'],
  horse: ['Кон под седлото: пътят от седмица става ден.', 'A horse to ride: a week of walking becomes a day.'],
  iron: ['Тъмен метал от червена руда: сечива за всеки.', 'A dark metal from red ore: tools for everyone.'],
  alphabet: ['Един знак за всеки звук: всеки може да се научи да пише.', 'One sign for each sound: anyone can learn to write.'],
  harbor: ['Каменен кей: корабите идват от далечни брегове.', 'A stone pier: ships arrive from distant shores.'],
  kingdom: ['Няколко села под една корона и една столица.', 'Several villages under one crown and one capital.'],
  coins: ['Сребро с печат: пазарът става лесен.', 'Stamped silver: the market becomes easy.'],
  laws: ['Правилата на камък, еднакви за всички.', 'Rules in stone, the same for everyone.'],
  theatre: ['Маски, сцена и стари легенди пред целия град.', 'Masks, a stage and old legends before the whole town.'],
  medicine: ['Лечение, записано в свитъци.', 'Healing written down in scrolls.'],
  aqueduct: ['Каменни арки носят чиста вода до града.', 'Stone arches carry clean water to the town.'],
  library: ['Свитъците на едно място: знанието не се губи.', 'All the scrolls in one place: knowledge is not lost.'],
  watermill: ['Реката върти воденичния камък.', 'The river turns the millstone.'],
  arch: ['Свод, който държи сам себе си, и камък, който се излива.', 'An arch that holds itself up, and stone that can be poured.'],
  heavy_plough: ['Желязо, колела и конски хамут: орат се и тежките земи.', 'Iron, wheels and a horse collar: even heavy land can be ploughed.'],
  monastery: ['Монаси преписват книгите и лекуват болните.', 'Monks copy the books and care for the sick.'],
  knighthood: ['Клетва да се пазят слабите и пътниците.', 'An oath to protect the weak and the travellers.'],
  three_field: ['Три ниви, една почива: земята не се изтощава.', 'Three fields, one resting: the soil does not wear out.'],
  castle: ['Каменна крепост на хълма, убежище за цялото село.', 'A stone fortress on the hill, a refuge for the whole village.'],
  paper: ['Парцали, вода и рамка: евтина хартия за всеки.', 'Rags, water and a frame: cheap paper for everyone.'],
  guilds: ['Майсторите на един занаят се учат и си помагат.', 'The masters of one craft teach and help each other.'],
  gothic: ['Остри сводове и прозорци от цветно стъкло.', 'Pointed vaults and windows of coloured glass.'],
  university: ['Учени от далечни земи учат младите на всичко.', 'Scholars from distant lands teach the young everything.'],
  windmill: ['Вятърът върти камъка и там, където няма река.', 'The wind turns the millstone even where there is no river.'],
  compass: ['Игла, която винаги сочи север.', 'A needle that always points north.'],
  clock: ['Зъбни колела на кулата: всички знаят часа.', 'Gears on the tower: everyone knows the time.'],
  printing: ['Метални букви и преса: книги за всеки.', 'Metal letters and a press: books for everyone.'],
};

/** a tech by its Bulgarian name (what the server sends) */
export function techEn(bg: string): string {
  const id = TECH_BG[bg];
  return id ? TECH_EN[id].name : bg;
}

export const ERAS_EN = ['Stone Age', 'New Stone Age', 'Bronze Age', 'Iron Age', 'Middle Ages', 'Early Modern Age', 'Industrial Age', 'Information Age', 'Space Age'];
export const ERAS_BG = ['Каменна епоха', 'Новокаменна епоха', 'Бронзова епоха', 'Желязна епоха', 'Средновековие', 'Нова епоха', 'Индустриална епоха', 'Информационна епоха', 'Космическа епоха'];
export function eraEn(bg: string): string {
  const i = ERAS_BG.indexOf(bg);
  return i < 0 ? bg : ERAS_EN[i];
}

export const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const CHIEF_TITLES_EN = ['Elder', 'Elder', 'Chieftain', 'Prince', 'Mayor', 'Mayor', 'Mayor', 'Mayor', 'Mayor'];
const CHIEF_BG: Record<string, string> = { Старейшина: 'Elder', Вожд: 'Chieftain', Княз: 'Prince', Кмет: 'Mayor', Цар: 'King' };
export function chiefEn(bg: string): string {
  return CHIEF_BG[bg] ?? CHIEF_BG[bg[0]?.toUpperCase() + bg.slice(1)] ?? bg;
}

export const TASK_NAMES_EN: Record<string, string> = {
  rest: 'resting', gather: 'gathering fruit and roots', hunt: 'hunting', fish: 'fishing', craft: 'making tools', farm: 'tending the field',
  herd: 'herding the animals', build: 'building', child: 'playing', elder: 'telling stories', travel: 'travelling', lead: 'leading the clan',
  scout: 'looking for a new camp', chop: 'chopping wood', sleep: 'sleeping', guard: 'guarding the village', bodyguard: 'guarding the chief',
};
export const TASK_BG: Record<string, string> = {
  почива: 'rest', 'събира плодове и корени': 'gather', ловува: 'hunt', 'лови риба': 'fish', 'прави сечива': 'craft', 'обработва нивата': 'farm',
  'пасе животните': 'herd', строи: 'build', играе: 'child', 'разказва истории': 'elder', пътува: 'travel', 'води рода': 'lead',
  'търси ново място за лагера': 'scout', 'сече дърва': 'chop', спи: 'sleep', 'пази селото': 'guard', 'пази водача': 'bodyguard',
};
export function taskEn(bg: string): string {
  const k = TASK_BG[bg];
  return k ? TASK_NAMES_EN[k] : bg;
}

export const BIOME_NAMES_EN: Record<number, string> = {
  0: 'Deep sea', 1: 'Sea', 2: 'Shore', 3: 'Meadows', 4: 'Plains', 5: 'Broadleaf forest', 6: 'Conifer forest', 7: 'Hills',
  8: 'Mountain', 9: 'Lasting snow', 10: 'Wasteland', 11: 'Tundra', 12: 'Marsh', 13: 'Lake',
};

export const GENE_EN: Record<string, string> = {
  Сила: 'Strength', Ум: 'Wit', Любопитство: 'Curiosity', Общителност: 'Sociability', Здраве: 'Health', Дълголетие: 'Longevity',
};

export const CAUSE_EN: Record<string, string> = {
  'загина на лов': 'died on a hunt',
  'почина в гладна година': 'died in a hungry year',
  'почина в лютата зима': 'died in the bitter winter',
  'почина от старост': 'died of old age',
  'почина като дете': 'died as a child',
  'почина от болест': 'died of illness',
};
export const causeEn = (bg: string) => CAUSE_EN[bg] ?? bg;

export const BEAST_EN: Record<string, string> = {
  мамут: 'a mammoth', 'пещерна мечка': 'a cave bear', 'огромен зубър': 'a huge wisent', 'стадо диви коне': 'a herd of wild horses', 'гигантски елен': 'a giant deer',
};

export const FEATURE_EN: Record<string, string> = {
  реката: 'the river', гората: 'the forest', хълмовете: 'the hills', морето: 'the sea', 'голямата поляна': 'the great meadow',
};

export function formatYearEn(year: number): string {
  const y = Math.abs(Math.round(year)).toLocaleString('en-US');
  return year < 0 ? `${y} BC` : `AD ${y}`;
}

/** years written by the server inside a Bulgarian text: "11 900 г. пр.н.е." -> "11,900 BC" */
export function yearsInTextEn(s: string): string {
  return s.replace(/(\d[\d\s  ]*) г\.( пр\.н\.е\.)?/g, (_, n: string, bc?: string) => formatYearEn((bc ? -1 : 1) * Number(n.replace(/\D/g, ''))));
}

/** a person's deeds as the server stores them in Bulgarian */
export function deedEn(d: string): string {
  let m: RegExpExecArray | null;
  if ((m = /^Откри „(.+)“ \((.+)\)$/.exec(d))) return `Discovered “${techEn(m[1])}” (${yearsInTextEn(m[2])})`;
  if ((m = /^Преоткри „(.+)“ за своя род$/.exec(d))) return `Rediscovered “${techEn(m[1])}” for the clan`;
  if ((m = /^Доживя до 70 години \((.+)\)$/.exec(d))) return `Lived to 70 (${yearsInTextEn(m[1])})`;
  if ((m = /^Стана първият цар на царство (.+) \((.+)\)$/.exec(d))) return `Became the first king of the Kingdom of ${villageEn(m[1])} (${yearsInTextEn(m[2])})`;
  if ((m = /^Основа (.+) и стана негов (\S+) \((.+)\)$/.exec(d))) return `Founded the ${bandEn(m[1])} and became its ${chiefEn(m[2]).toLowerCase()} (${yearsInTextEn(m[3])})`;
  if ((m = /^Поведе лова на (.+)$/.exec(d))) return `Led the hunt for ${BEAST_EN[m[1]] ?? m[1]}`;
  return yearsInTextEn(d);
}

/** "Старейшина на Бялово" / "Старейшина на рода на Вълка" */
export function titleEn(s: string): string {
  const m = /^(\S+) на (.+)$/.exec(s);
  return m ? `${chiefEn(m[1])} of ${bandTextEn(m[2])}` : s;
}

export const SECRET_HEROES_EN: string[] = [
  'Clever Peter', 'Nasreddin Hodja', 'Prince Marko', 'Peter Pan', 'Cinderella',
  'Snow White', 'Little Red Riding Hood', 'Puss in Boots', 'Pinocchio', 'Alice',
  'Hansel', 'Gretel', 'Thumbelina', 'The Little Mermaid', 'The Ugly Duckling',
  'Sleeping Beauty', 'Rapunzel', 'Rumpelstiltskin', 'Aladdin', 'Ali Baba',
  'Sinbad the Sailor', 'Baron Munchausen', 'Gulliver', 'Robinson Crusoe', 'Tom Sawyer',
  'Huck Finn', 'Dorothy', 'The Tin Woodman', 'The Cowardly Lion', 'The Scarecrow',
  'Winnie-the-Pooh', 'Piglet', 'Eeyore', 'Baba Yaga', 'Koschei the Deathless',
  'Ivan Tsarevich', 'Vasilisa the Wise', 'The Firebird', 'Sivka-Burka', 'Kolobok',
  'Zmey Goryanin', 'The Samodiva', 'The Golden Girl', 'Auntie Fox', 'Uncle Wolf',
  'Bunny Bayo', 'Granny Bear', 'Grandfather Frost', 'Snegurochka', 'The Steadfast Tin Soldier',
  'The Snow Queen', 'Gerda', 'Kai', 'The Bremen Town Musicians', 'The Brave Little Tailor',
  'Tom Thumb', 'Goldilocks', 'Beauty', 'The Beast', 'Bluebeard',
  'The Princess and the Pea', 'Eliza', 'Tsar Saltan', 'The Golden Fish', 'Emelya',
  'The Sea King', 'Robin Hood', 'King Arthur', 'Merlin', 'Lancelot',
  'Nils Holgersson', 'The Frog King', 'The Unborn Maiden', "Grandpa's Mitten", 'The Wheat Loaf',
  'Ivan the Fool', 'The Frog Princess', 'The Silent Princess', 'The Tortoise', 'The Swift Hare',
  'Sly Fox', 'The Cricket', 'The Ant', 'The Raven', 'Scheherazade',
  'The Genie of the Lamp', 'Little Muck', 'Caliph Stork', 'Dwarf Nose', 'The Nutcracker',
  'King Thrushbeard', 'Jack', 'The Little Match Girl', 'The Chimney Sweep', 'Naf-Naf',
  'Nuf-Nuf', 'Nif-Nif', 'The Little Red Hen', 'Grandpa and the Turnip', 'The Chronicler',
];

export const SECRET_KINDS_EN: Record<string, { name: string; text: string }> = {
  ufo: { name: 'a flying saucer', text: 'A quiet silver saucer hangs low over the grass and glows. Nobody in the chronicle knows where it came from.' },
  meteor: { name: 'a fallen meteorite', text: 'A stone from the sky, still warm. The grass around it is scorched.' },
  eggs: { name: 'a nest of painted eggs', text: 'Someone painted the eggs with red and blue patterns and hid them in a nest. Easter came a few thousand years early.' },
  goldegg: { name: 'a golden egg', text: 'An egg of pure gold on a stone. Now and then it cracks and something shines inside.' },
  robot: { name: 'a rusty robot', text: 'A small robot overgrown with moss. When you look at it, its eyes light up and it waves at you.' },
  stag: { name: 'a ghostly stag', text: 'A white glowing stag stands among the trees and slowly falls apart into sparks.' },
  dragon: { name: 'a sleeping dragon', text: 'A tiny green dragon sleeps on a heap of gold coins. One of its eyes opens.' },
  portal: { name: 'a portal in a stone circle', text: 'Blue light turns between ancient stones. Where it leads is written nowhere.' },
};
