// Discoveries. Each one is found by a real person in a real band, and can spread or be forgotten.

export type Need = 'flint' | 'clay' | 'grain' | 'wildHerd' | 'fish' | 'forest' | 'ore' | null;

export interface Tech {
  id: string;
  name: string;
  era: number;
  prereq: string[];
  need: Need;
  /** chance per adult-month for a person with average wit and curiosity, before pacing */
  base: number;
  /** year the first discovery is expected around (the real history, squeezed to the game's calendar) */
  target: number;
  /** which gene helps most */
  gene: 'int' | 'cur' | 'soc' | 'str';
  text: string; // {name} {band}
  kids: string;
}

export const ERAS = [
  { name: 'Каменна епоха', startYear: -12000, targetDay: 0, yearsPerMin: 0.33 },
  { name: 'Новокаменна епоха', startYear: -7000, targetDay: 10, yearsPerMin: 0.21 },
  { name: 'Бронзова епоха', startYear: -3300, targetDay: 22, yearsPerMin: 0.15 },
  { name: 'Желязна епоха', startYear: -1200, targetDay: 32, yearsPerMin: 0.09 },
  { name: 'Средновековие', startYear: 500, targetDay: 45, yearsPerMin: 0.035 },
  { name: 'Нова епоха', startYear: 1500, targetDay: 62, yearsPerMin: 0.02 },
  { name: 'Индустриална епоха', startYear: 1760, targetDay: 72, yearsPerMin: 0.009 },
  { name: 'Информационна епоха', startYear: 1950, targetDay: 85, yearsPerMin: 0.0105 },
  { name: 'Космическа епоха', startYear: 2030, targetDay: 92, yearsPerMin: 0.0105 },
];

export const TECHS: Tech[] = [
  { id: 'fire', name: 'Огън', era: 0, target: -11930, prereq: [], need: null, base: 0.0035, gene: 'cur',
    text: '{name} от {band} опитоми огъня. Нощите вече не са толкова студени и страшни.',
    kids: '{name} запали първия огън! Сега хората се топлят и пекат храната си.' },
  { id: 'stone_tools', name: 'Каменни сечива', era: 0, target: -11850, prereq: [], need: 'flint', base: 0.004, gene: 'int',
    text: '{name} от {band} се научи да цепи кремък на остри остриета.',
    kids: '{name} направи нож от камък. С него се реже много по-лесно!' },
  { id: 'herb_lore', name: 'Познание за билките', era: 0, target: -11450, prereq: [], need: 'forest', base: 0.002, gene: 'int',
    text: '{name} от {band} запомни кои билки лекуват и кои тровят.',
    kids: '{name} разбра кои растения лекуват болки в корема.' },
  { id: 'burial', name: 'Погребални обреди', era: 0, target: -11700, prereq: [], need: null, base: 0.0015, gene: 'soc',
    text: '{Band} за първи път изпрати починалите си с обред. {name} пя над гроба.',
    kids: '{Band} започна да помни своите баби и дядовци с песни.' },
  { id: 'spear', name: 'Копие', era: 0, target: -11600, prereq: ['stone_tools'], need: null, base: 0.004, gene: 'str',
    text: '{name} от {band} върза каменен връх на дълга пръчка. Ловът става по-безопасен.',
    kids: '{name} измисли копието. Ловците вече не трябва да се приближават толкова до зверовете.' },
  { id: 'clothing', name: 'Облекло от кожи', era: 0, target: -11300, prereq: ['stone_tools'], need: null, base: 0.003, gene: 'int',
    text: '{name} от {band} уши първите дрехи от кожи. Зимата вече не е смъртна присъда.',
    kids: '{name} уши топли дрехи от кожа. Вече може да се излиза и през зимата!' },
  { id: 'cave_art', name: 'Скални рисунки', era: 0, target: -11000, prereq: ['fire'], need: null, base: 0.0015, gene: 'cur',
    text: '{name} от {band} нарисува лов на стената на пещерата с охра и въглен.',
    kids: '{name} нарисува животни по стената на пещерата. Първите картини на света!' },
  { id: 'fishing', name: 'Риболов', era: 0, target: -10500, prereq: ['spear'], need: 'fish', base: 0.004, gene: 'cur',
    text: '{name} от {band} се научи да лови риба с харпун.',
    kids: '{name} хвана първата риба с остен. Реката вече дава храна!' },
  { id: 'shelter', name: 'Шатри', era: 0, target: -10700, prereq: ['clothing'], need: null, base: 0.003, gene: 'int',
    text: '{name} от {band} опъна кожи върху кости и клони. Първите шатри.',
    kids: '{name} направи шатра. Вече може да се спи на сухо навсякъде.' },
  { id: 'bow', name: 'Лък и стрели', era: 0, target: -9900, prereq: ['spear'], need: 'forest', base: 0.0015, gene: 'int',
    text: '{name} от {band} опъна жила на огънато дърво. Лъкът удря отдалече.',
    kids: '{name} измисли лъка! Стрелите летят далеч.' },
  { id: 'dog', name: 'Опитомено куче', era: 0, target: -10200, prereq: ['fire', 'spear'], need: null, base: 0.0015, gene: 'soc',
    text: 'Вълчи кутрета останаха при огъня на {band}. {name} ги храни и те станаха първите кучета.',
    kids: '{name} си намери приятел: малко вълче, което стана първото куче!' },
  // gateway to the New Stone Age
  { id: 'grinding', name: 'Мелене на зърно', era: 1, target: -8800, prereq: ['stone_tools'], need: 'grain', base: 0.0025, gene: 'int',
    text: '{name} от {band} смля диви зърна между два камъка. От брашното става храна за зимата.',
    kids: '{name} смачка зрънца между два камъка и направи брашно.' },
  { id: 'agriculture', name: 'Земеделие', era: 1, target: -7100, prereq: ['grinding', 'pottery'], need: 'grain', base: 0.0008, gene: 'int',
    text: '{name} от {band} забеляза, че от падналите зърна растат нови. Родът засява първата нива и спира да скита.',
    kids: '{name} посади семена и от тях израснаха нови растения! Хората вече могат да остават на едно място.' },
  { id: 'pottery', name: 'Керамика', era: 1, target: -8300, prereq: ['fire'], need: 'clay', base: 0.002, gene: 'cur',
    text: '{name} от {band} изпече глина в огъня. Гърнетата пазят храната от мишки и влага.',
    kids: '{name} изпече глинено гърне. Сега храната може да се пази дълго!' },
  { id: 'herding', name: 'Скотовъдство', era: 1, target: -7900, prereq: ['dog'], need: 'wildHerd', base: 0.0015, gene: 'soc',
    text: '{name} от {band} затвори диви кози в кошара. Месо и мляко без лов.',
    kids: '{name} опитоми кози. Вече има мляко всеки ден!' },
  { id: 'weaving', name: 'Тъкане', era: 1, target: -6600, prereq: ['agriculture'], need: null, base: 0.0025, gene: 'int',
    text: '{name} от {band} изпреде нишки от лен и ги изтъка на плат.',
    kids: '{name} изтъка първия плат. Дрехите стават меки и леки.' },
  { id: 'mudbrick', name: 'Глинени къщи', era: 1, target: -6300, prereq: ['agriculture', 'pottery'], need: null, base: 0.003, gene: 'str',
    text: 'В {band} {name} издигна първата къща от плет и глина. Селото започва да прилича на дом.',
    kids: '{name} построи истинска къща от глина!' },
  { id: 'boats', name: 'Лодка от дънер', era: 1, target: -9400, prereq: ['stone_tools', 'fishing'], need: 'fish', base: 0.0015, gene: 'cur',
    text: '{name} от {band} издълба лодка от дънер. Реките вече не са граница.',
    kids: '{name} направи лодка и тръгна по реката!' },
  // copper age: the last steps of the farmers before bronze
  { id: 'copper', name: 'Мед', era: 1, target: -4500, prereq: ['fire', 'pottery'], need: 'ore', base: 0.002, gene: 'cur',
    text: '{name} от {band} забеляза, че зелен камък в жарта на грънчарската пещ пуска червен блестящ метал. Първите медни игли и шила.',
    kids: '{name} разтопи зелен камък в огъня и от него потече червен метал: мед!' },
  { id: 'plough', name: 'Рало', era: 1, target: -4000, prereq: ['agriculture', 'herding'], need: null, base: 0.0025, gene: 'int',
    text: '{name} от {band} впрегна вол в остър дървен кол. Една нива се изорава за ден, а не за седмица.',
    kids: '{name} накара вола да тегли ралото. Сега нивите стават много по-големи!' },
  { id: 'wheel', name: 'Колело', era: 1, target: -3500, prereq: ['agriculture', 'pottery'], need: null, base: 0.0015, gene: 'int',
    text: '{name} от {band} сложи дървен диск на ос. Първата каруца носи товар, какъвто трима души не биха вдигнали.',
    kids: '{name} измисли колелото! Каруцата вози тежки неща вместо хората.' },
  // gateway to the Bronze Age
  { id: 'bronze', name: 'Бронз', era: 2, target: -3300, prereq: ['copper'], need: 'ore', base: 0.002, gene: 'int',
    text: '{name} от {band} смеси мед с калай и получи метал, по-твърд от всеки камък. Започва нова епоха.',
    kids: '{name} смеси два метала и стана бронз: твърд и златист!' },
  { id: 'sailing', name: 'Платно', era: 2, target: -3100, prereq: ['boats', 'weaving'], need: 'fish', base: 0.0015, gene: 'cur',
    text: '{name} от {band} опъна тъкано платно на лодката. Вятърът я носи по-далеч, отколкото гребците стигат.',
    kids: '{name} сложи платно на лодката и вятърът я забута!' },
  { id: 'writing', name: 'Писменост', era: 2, target: -3000, prereq: ['pottery', 'mudbrick'], need: null, base: 0.001, gene: 'int',
    text: '{name} от {band} издълба знаци в мокра глина, за да запомни колко жито има в хамбара. Първото писмо.',
    kids: '{name} нарисува знаци в глината, които другите могат да прочетат. Това е писането!' },
  { id: 'trade', name: 'Търговия', era: 2, target: -2800, prereq: ['wheel'], need: null, base: 0.002, gene: 'soc',
    text: '{name} от {band} натовари каруца с гърнета и се върна с кремък, сол и мед. Съседите вече си помагат.',
    kids: '{name} размени гърнета за сол със съседите. И двамата останаха доволни!' },
  { id: 'walls', name: 'Крепостни стени', era: 2, target: -2600, prereq: ['mudbrick', 'bronze'], need: null, base: 0.002, gene: 'str',
    text: '{Band} издигна каменни стени около къщите. {name} поведе строежа. Селото става град.',
    kids: '{name} построи висока стена около селото. Сега то е истински град!' },
  { id: 'calendar', name: 'Календар', era: 2, target: -2400, prereq: ['writing', 'agriculture'], need: null, base: 0.0015, gene: 'int',
    text: '{name} от {band} преброи дните от едно пълнолуние до друго и записа кога да се сее. Реколтата вече не закъснява.',
    kids: '{name} разбра кога точно да се сеят семената, като гледа луната и звездите.' },
  { id: 'horse', name: 'Опитомен кон', era: 2, target: -2000, prereq: ['herding', 'wheel'], need: 'wildHerd', base: 0.0015, gene: 'soc',
    text: '{name} от {band} опитоми див кон и го впрегна в каруцата. Пътят до съседите стана три пъти по-кратък.',
    kids: '{name} се сприятели с кон и сега яздят заедно!' },
  // gateway to the Iron Age
  { id: 'iron', name: 'Желязо', era: 3, target: -1200, prereq: ['bronze'], need: 'ore', base: 0.002, gene: 'int',
    text: '{name} от {band} разпали пещта по-силно от всякога и от червената руда излезе тъмен метал. Желязото е навсякъде и е по-евтино от бронза. Започва нова епоха.',
    kids: '{name} изкова желязо: тъмно, здраво и го има навсякъде!' },
  { id: 'alphabet', name: 'Азбука', era: 3, target: -1050, prereq: ['writing', 'trade'], need: null, base: 0.0015, gene: 'int',
    text: '{name} от {band} даде по един знак на всеки звук. Вече не са нужни стотици знаци: две дузини стигат, за да се запише всяка дума.',
    kids: '{name} измисли азбуката: малко букви, а с тях се пише всичко!' },
  { id: 'harbor', name: 'Пристанище', era: 3, target: -800, prereq: ['sailing', 'trade'], need: 'fish', base: 0.0015, gene: 'soc',
    text: '{name} от {band} насипа камъни в залива и построи кей. Корабите вече спират тук и носят стоки от далечни брегове.',
    kids: '{name} построи пристанище и при тях идват кораби отдалеч!' },
  { id: 'kingdom', name: 'Царство', era: 3, target: -750, prereq: ['walls', 'writing'], need: null, base: 0.0012, gene: 'soc',
    text: '{Band} събра съседните села под една корона, а короната пое {name}. Без нито една битка се ражда първото царство.',
    kids: '{name} събра няколко села в едно царство, като ги покани на голям празник!' },
  { id: 'coins', name: 'Монети', era: 3, target: -650, prereq: ['trade', 'bronze'], need: 'ore', base: 0.0015, gene: 'soc',
    text: '{name} от {band} отсече малки сребърни кръгчета с еднакво тегло и печат. Вече не трябва да се мъкнат крави и гърнета, за да се купи нещо.',
    kids: '{name} направи първите монети. С тях се купува всичко, без да се влачат крави!' },
  { id: 'laws', name: 'Писани закони', era: 3, target: -600, prereq: ['alphabet'], need: null, base: 0.0015, gene: 'soc',
    text: '{name} от {band} издълба законите на каменна плоча на площада. Всеки може да ги прочете и съдията вече не решава както му скимне.',
    kids: '{name} написа правилата на голям камък, за да са еднакви за всички.' },
  { id: 'theatre', name: 'Театър', era: 3, target: -500, prereq: ['alphabet'], need: null, base: 0.0012, gene: 'cur',
    text: '{name} от {band} сложи маска и изигра стара легенда пред целия град. Хората плакаха и се смяха заедно.',
    kids: '{name} сложи смешна маска и всички се смяха!' },
  { id: 'medicine', name: 'Медицина', era: 3, target: -420, prereq: ['herb_lore', 'alphabet'], need: null, base: 0.0012, gene: 'int',
    text: '{name} от {band} записа коя билка коя болест лекува. Лечителите вече се учат от свитъци, а не само от бабите си.',
    kids: '{name} записа как се лекуват болестите, за да могат и други да помагат.' },
  { id: 'aqueduct', name: 'Акведукт', era: 3, target: -310, prereq: ['walls', 'iron'], need: null, base: 0.0012, gene: 'str',
    text: '{Band} докара вода от планината по каменни арки. {name} поведе строежа. В града тече чиста вода и болестите намаляват.',
    kids: '{name} построи каменен мост за вода и тя тече чак до града!' },
  { id: 'library', name: 'Библиотека', era: 3, target: -280, prereq: ['alphabet', 'laws'], need: null, base: 0.0012, gene: 'int',
    text: '{name} от {band} събра всички свитъци на едно място. Каквото е научено веднъж, вече не се забравя.',
    kids: '{name} събра много свитъци в една къща. Там всеки може да чете!' },
  { id: 'watermill', name: 'Водна мелница', era: 3, target: -250, prereq: ['wheel', 'grinding', 'iron'], need: null, base: 0.0015, gene: 'int',
    text: '{name} от {band} сложи колело в реката и го накара да върти воденичния камък. Реката меле брашното вместо хората.',
    kids: '{name} накара реката да върти голямо колело и то меле брашно само!' },
  { id: 'arch', name: 'Свод и бетон', era: 3, target: -50, prereq: ['aqueduct'], need: null, base: 0.0012, gene: 'str',
    text: '{name} от {band} смеси вулканичен пясък с вар и построи свод, който държи сам себе си. Мостове и куполи вече стоят векове.',
    kids: '{name} направи камък, който се излива като кал и после става твърд!' },
  // gateway to the Middle Ages
  { id: 'heavy_plough', name: 'Тежък плуг', era: 4, target: 550, prereq: ['plough', 'iron'], need: null, base: 0.002, gene: 'int',
    text: '{name} от {band} сложи на плуга железен лемеж и колела и впрегна два коня с меки хамути. Тежката глинеста земя на север вече може да се оре. Започва нова епоха.',
    kids: '{name} направи плуг, който два коня теглят през най-тежката земя!' },
  { id: 'monastery', name: 'Манастир', era: 4, target: 600, prereq: ['library', 'writing'], need: null, base: 0.0015, gene: 'int',
    text: '{name} от {band} основа манастир край селото. Монасите преписват старите книги, лекуват болните и учат децата да четат.',
    kids: '{name} построи манастир, където монасите пазят книгите и помагат на болните.' },
  { id: 'knighthood', name: 'Рицарство', era: 4, target: 750, prereq: ['horse', 'iron', 'kingdom'], need: null, base: 0.0015, gene: 'str',
    text: '{name} от {band} се закле пред царя да пази слабите и пътниците. Първият рицар се появи на кон, в желязна ризница, и с меч, който никога не вдига първи.',
    kids: '{name} стана рицар: язди голям кон и пази пътниците по пътя!' },
  { id: 'three_field', name: 'Трипольна система', era: 4, target: 800, prereq: ['heavy_plough', 'calendar'], need: 'grain', base: 0.0015, gene: 'int',
    text: '{name} от {band} раздели нивите на три: в едната зимно жито, в другата пролетен ечемик, а третата почива. Земята вече не се изтощава.',
    kids: '{name} измисли нивата да почива всяка трета година, за да ражда повече.' },
  { id: 'castle', name: 'Замък', era: 4, target: 900, prereq: ['walls', 'arch', 'kingdom'], need: null, base: 0.0015, gene: 'str',
    text: '{Band} издигна каменен замък на хълма над къщите. {name} поведе строежа. При беда цялото село се прибира зад дебелите му стени.',
    kids: '{name} построи истински замък с кули и подвижен мост!' },
  { id: 'paper', name: 'Хартия', era: 4, target: 1050, prereq: ['writing', 'watermill'], need: null, base: 0.0015, gene: 'cur',
    text: '{name} от {band} натроши стари парцали във вода, загреба кашата с ситна рамка и я изсуши. Хартията е много по-евтина от пергамента.',
    kids: '{name} направи хартия от стари парцали. Сега всеки може да пише!' },
  { id: 'guilds', name: 'Гилдии', era: 4, target: 1100, prereq: ['coins', 'laws'], need: null, base: 0.0015, gene: 'soc',
    text: '{name} от {band} събра майсторите на един занаят в гилдия. Те учат чираците, пазят качеството и си помагат в лоши години.',
    kids: '{name} събра всички майстори в гилдия. Те учат децата на занаята си!' },
  { id: 'gothic', name: 'Готически храм', era: 4, target: 1140, prereq: ['arch', 'guilds'], need: null, base: 0.0012, gene: 'cur',
    text: '{name} от {band} издигна храм с остри сводове и високи прозорци от цветно стъкло. Вътре светлината пада на шарени петна по пода.',
    kids: '{name} построи храм с цветни прозорци, през които светлината става на дъга!' },
  { id: 'university', name: 'Университет', era: 4, target: 1150, prereq: ['library', 'monastery'], need: null, base: 0.0012, gene: 'int',
    text: '{name} от {band} покани учени от далечни земи. Те спорят, пишат и учат младите на смятане, звезди, право и лечение. Това е първият университет.',
    kids: '{name} основа училище за големи, където се учи всичко!' },
  { id: 'windmill', name: 'Вятърна мелница', era: 4, target: 1180, prereq: ['watermill', 'sailing'], need: null, base: 0.0015, gene: 'int',
    text: '{name} от {band} сложи платна на дървено колело на върха на хълма. Вятърът върти воденичния камък и там, където няма река.',
    kids: '{name} накара вятъра да върти голяма мелница!' },
  { id: 'compass', name: 'Компас', era: 4, target: 1190, prereq: ['harbor', 'iron'], need: 'fish', base: 0.0015, gene: 'cur',
    text: '{name} от {band} забеляза, че намагнетизирана игла винаги сочи север. Корабите вече намират пътя и в мъгла, и далеч от брега.',
    kids: '{name} намери игла, която винаги сочи на север. Корабите вече не се губят!' },
  { id: 'clock', name: 'Механичен часовник', era: 4, target: 1280, prereq: ['guilds', 'calendar'], need: null, base: 0.0012, gene: 'int',
    text: '{name} от {band} направи часовник от зъбни колела и тежест и го качи на кулата. Цялото село вече знае колко е часът.',
    kids: '{name} построи голям часовник на кулата. Сега всички знаят кога е обед!' },
  { id: 'printing', name: 'Печатна преса', era: 4, target: 1440, prereq: ['paper', 'guilds'], need: null, base: 0.0012, gene: 'int',
    text: '{name} от {band} отля букви от метал, нареди ги в рамка и ги притисна с преса върху хартия. За един ден се отпечатват повече страници, отколкото монах изписва за година.',
    kids: '{name} измисли машина, която пише книги вместо хората!' },
];

export const TECH_BY_ID = new Map(TECHS.map((t) => [t.id, t]));

/** Era of a set of known techs: the highest era with a defining tech known. */
export function eraOf(techs: Set<string>): number {
  if (techs.has('heavy_plough')) return 4;
  if (techs.has('iron')) return 3;
  if (techs.has('bronze')) return 2;
  if (techs.has('agriculture')) return 1;
  return 0;
}

export function techCountForEra(era: number): number {
  return TECHS.filter((t) => t.era === era).length;
}
