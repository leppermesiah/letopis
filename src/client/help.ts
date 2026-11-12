// The "?" window: what is new in each version (newest first) and a short help.
// Every version is one line that opens and closes. The newest one is open the first time a viewer sees it.

import { L3, T } from './lang';

/** breaking: needs action or breaks something old; new: only in a newly started world; old: how an existing world takes it */
type Tag = 'breaking' | 'new' | 'old';
/** [bg, en, de, tag]; tagged items always come first in their version */
type Item = [string, string, string, Tag?];
interface Release { v: string; items: Item[] }

const TAGS: Record<Tag, [string, string, string]> = {
  breaking: ['Несъвместимо', 'Breaking', 'Inkompatibel'],
  new: ['Само за нови светове', 'New worlds only', 'Nur für neue Welten'],
  old: ['В съществуващ свят', 'In an existing world', 'In einer bestehenden Welt'],
};
const TAG_ORDER: Tag[] = ['breaking', 'new', 'old'];

/** newest first; a new version gets its own entry here */
export const CHANGELOG: Release[] = [
  { v: '1.38', items: [
    ['Средновековие: тежък плуг, манастир, рицарство, трипольна система, замък, хартия, гилдии, готически храм, университет, вятърна мелница, компас, механичен часовник и печатна преса.', 'Middle Ages: heavy plough, monastery, knighthood, three-field system, castle, paper, guilds, Gothic church, university, windmill, compass, mechanical clock and printing press.', 'Mittelalter: schwerer Pflug, Kloster, Rittertum, Dreifelderwirtschaft, Burg, Papier, Zünfte, gotische Kirche, Universität, Windmühle, Kompass, Räderuhr und Buchdruck.'],
    ['Средновековни градове: замък на хълма, готическа църква, манастир, къщи с дървени греди, вятърна мелница, хан, покрит пазар, часовникова кула и трибуна за турнири.', 'Medieval towns: a castle on the hill, a Gothic church, a monastery, half-timbered houses, a windmill, an inn, a market hall, a clock tower and a tournament stand.', 'Mittelalterliche Städte: eine Burg auf dem Hügel, eine gotische Kirche, ein Kloster, Fachwerkhäuser, eine Windmühle, ein Gasthaus, eine Markthalle, ein Uhrturm und eine Turniertribüne.'],
    ['Нови хора: рицар на кон, търговец с покрита каруца, менестрел, поклонници, монах, мелничар, бъчвар, предачка и пазач с алебарда.', 'New people: a knight on horseback, a merchant with a covered wagon, a minstrel, pilgrims, a monk, a miller, a cooper, a spinner and a guard with a halberd.', 'Neue Menschen: ein Ritter zu Pferd, ein Händler mit Planwagen, ein Spielmann, Pilger, ein Mönch, ein Müller, ein Böttcher, eine Spinnerin und ein Wächter mit Hellebarde.'],
  ] },
  { v: '1.37', items: [
    ['Нов раздел „Царства“: всяко царство с царя, столицата и селата му.', 'A new Kingdoms tab: every kingdom with its king, capital and villages.', 'Ein neuer Reiter „Königreiche“: jedes Königreich mit König, Hauptstadt und Dörfern.'],
    ['На картата земята на всяко царство е оцветена в цвета на столицата, а столицата има корона до името.', 'On the map the land of every kingdom is tinted in the colour of its capital, and the capital has a crown by its name.', 'Auf der Karte ist das Land jedes Königreichs in der Farbe seiner Hauptstadt getönt, und die Hauptstadt hat eine Krone neben dem Namen.'],
    ['Сезони в летописа: ранна пролет, пролетно пълноводие, скакалци, богата реколта и празник след жътвата.', 'Seasons in the chronicle: an early spring, a spring flood, locusts, a rich harvest and a harvest feast.', 'Jahreszeiten in der Chronik: ein früher Frühling, ein Frühjahrshochwasser, Heuschrecken, eine reiche Ernte und ein Erntefest.'],
    ['Родовете с номер след името (например „Дълбок корен 15“) вече се превеждат на английски и немски.', 'Clans with a number after the name (like “Deep Root 15”) are now translated into English and German.', 'Clans mit einer Nummer nach dem Namen (etwa „Tiefe Wurzel 15“) werden jetzt ins Englische und Deutsche übersetzt.'],
  ] },
  { v: '1.36', items: [
    ['В новостите важните бележки са най-отгоре, с цветен етикет: несъвместими промени, неща само за нови светове и как ги приема съществуващ свят.', 'In “What’s new”, the important notes come first, with a coloured label: breaking changes, things for new worlds only, and how an existing world takes a change.', 'In den Neuigkeiten stehen wichtige Hinweise oben, mit einem farbigen Etikett: inkompatible Änderungen, Dinge nur für neue Welten und wie eine bestehende Welt eine Änderung übernimmt.'],
  ] },
  { v: '1.35', items: [
    ['Желязна епоха: желязо, азбука, пристанище, царство, монети, писани закони, театър, медицина, акведукт, библиотека, водна мелница, свод и бетон.', 'Iron Age: iron, alphabet, harbour, kingdom, coins, written laws, theatre, medicine, aqueduct, library, watermill, arch and concrete.', 'Eisenzeit: Eisen, Alphabet, Hafen, Königreich, Münzen, geschriebene Gesetze, Theater, Heilkunde, Aquädukt, Bibliothek, Wassermühle, Gewölbe und Beton.'],
    ['Царства: селата се обединяват мирно под един цар, а столицата получава дворец.', 'Kingdoms: villages unite peacefully under one king, and the capital gets a palace.', 'Königreiche: Dörfer schließen sich friedlich unter einem König zusammen, und die Hauptstadt bekommt einen Palast.'],
    ['Градовете растат: къщи с двор, театър, училище, акведукт, фар и нови стени с бойници.', 'Towns grow: courtyard houses, a theatre, a school, an aqueduct, a lighthouse and new walls with battlements.', 'Die Städte wachsen: Häuser mit Innenhof, ein Theater, eine Schule, ein Aquädukt, ein Leuchtturm und neue Mauern mit Zinnen.'],
    ['Нови хора: ковач на желязо, каменоделец, лечителка, актьор, учител с деца, търговец с муле, царят и пазач с ризница.', 'New people: an iron smith, a stonemason, a healer, an actor, a teacher with children, a trader with a mule, the king and a guard in chain mail.', 'Neue Menschen: ein Eisenschmied, ein Steinmetz, eine Heilerin, ein Schauspieler, ein Lehrer mit Kindern, ein Händler mit Maultier, der König und ein Wächter im Kettenhemd.'],
  ] },
  { v: '1.34', items: [
    ['Бутон „?“ до избора на език: новостите на всяка версия и кратка помощ.', 'A “?” button next to the language selector: what is new in each version and a short help.', 'Ein „?“-Knopf neben der Sprachauswahl: Neuigkeiten jeder Version und eine kurze Hilfe.'],
  ] },
  { v: '1.33', items: [
    ['Немски език. Изборът на език вече е БГ / EN / DE.', 'German. The language selector now offers БГ / EN / DE.', 'Deutsch. Die Sprachauswahl bietet jetzt БГ / EN / DE.'],
    ['На английски и немски хората, селата и родовете имат свои местни имена, а не преписани български.', 'In English and German, people, villages and clans have names of their own instead of transliterated Bulgarian ones.', 'Auf Englisch und Deutsch tragen Menschen, Dörfer und Clans eigene Namen statt umgeschriebener bulgarischer.'],
    ['Летописът се пише и на немски. Записите отпреди 1.33 нямат немски и се показват на английски, със старите имена.', 'The chronicle is also written in German. Entries from before 1.33 have no German and are shown in English, with the old names.', 'Die Chronik wird auch auf Deutsch geschrieben. Einträge aus der Zeit vor 1.33 gibt es nicht auf Deutsch; sie erscheinen auf Englisch, mit den alten Namen.', 'old'],
  ] },
  { v: '1.32', items: [
    ['Откритията са подредени по епохи, всяка в своя карта с брояч.', 'Discoveries are grouped by age, each in its own card with a counter.', 'Die Entdeckungen sind nach Zeitaltern geordnet, jedes in einer eigenen Karte mit Zähler.'],
    ['Неоткритите знания са сиви и имат кратко описание.', 'Discoveries still to come are grey and have a short description.', 'Noch nicht gemachte Entdeckungen sind grau und kurz beschrieben.'],
  ] },
  { v: '1.29', items: [
    ['199 нови имена на родовете, всяко със свой символ на знамето.', '199 new clan names, each with its own symbol on the banner.', '199 neue Clannamen, jeder mit einem eigenen Zeichen auf dem Banner.'],
    ['Новите имена получават само новите родове. Родовете, които вече ги има, си пазят старите имена.', 'Only new clans get the new names. Clans that already exist keep their old ones.', 'Nur neue Clans bekommen die neuen Namen. Bestehende Clans behalten ihre alten.', 'old'],
  ] },
  { v: '1.28', items: [
    ['100 нови символа на родовете.', '100 new clan symbols.', '100 neue Clanzeichen.'],
    ['Разделът „Личности“ вече не остава на „Зареждам“.', 'The People tab no longer gets stuck on “Loading”.', 'Der Reiter „Personen“ bleibt nicht mehr beim Laden hängen.'],
  ] },
  { v: '1.26', items: [
    ['Бронзова епоха: мед, рало, колело, бронз, платно, писменост, търговия, стени, календар, кон.', 'Bronze Age: copper, plough, wheel, bronze, sail, writing, trade, walls, calendar, horse.', 'Bronzezeit: Kupfer, Pflug, Rad, Bronze, Segel, Schrift, Handel, Mauern, Kalender, Pferd.'],
    ['Пътища между селата, мостове, градове с каменни къщи, порта, кула, пазар и храм.', 'Roads between villages, bridges, towns with stone houses, a gate, a tower, a market and a temple.', 'Wege zwischen den Dörfern, Brücken, Städte mit Steinhäusern, Tor, Turm, Markt und Tempel.'],
    ['Нощем всички спят, а двама пазачи обикалят огъня. Един пази водача, когато той търси ново място.', 'At night everyone sleeps while two guards walk around the fire. One of them guards the chief when he scouts.', 'Nachts schlafen alle, und zwei Wächter gehen ums Feuer. Einer begleitet den Anführer, wenn er einen neuen Platz sucht.'],
    ['По-бърза игра при много хора.', 'Faster with large populations.', 'Schneller bei vielen Menschen.'],
  ] },
];

/** the help below the versions */
function helpHtml(): string {
  const li = (bg: string, en: string, de: string) => `<li>${T(bg, en, de)}</li>`;
  return `<h3>${T('Помощ', 'Help', 'Hilfe')}</h3>
    <p>${T('Светът живее сам: хората раждат деца, ловуват, откриват нови неща и основават села. Ти само гледаш.',
      'The world lives on its own: people have children, hunt, discover new things and found villages. You only watch.',
      'Die Welt lebt von selbst: Die Menschen bekommen Kinder, jagen, entdecken Neues und gründen Dörfer. Du schaust nur zu.')}</p>
    <h4>${T('Картата', 'The map', 'Die Karte')}</h4>
    <ul class="help">
      ${li('Влачи, за да местиш. Колелцето, два пръста или + и − приближават и отдалечават.', 'Drag to move. The mouse wheel, two fingers or + and − zoom in and out.', 'Ziehen verschiebt die Karte. Mausrad, zwei Finger oder + und − zoomen.')}
      ${li('Цъкни човек или лагер, за да видиш картата му.', 'Click a person or a camp to see its card.', 'Klicke auf einen Menschen oder ein Lager, um seine Karte zu sehen.')}
      ${li('Из проучената земя са скрити 100 мънички тайни. Цъкни някоя, за да я откриеш.', '100 tiny secrets hide in the explored land. Click one to find it.', 'Im erkundeten Land verstecken sich 100 winzige Geheimnisse. Klicke eins an, um es zu finden.')}
    </ul>
    <h4>${T('Бутоните', 'The buttons', 'Die Knöpfe')}</h4>
    <ul class="help">
      ${li('<b>Разходка</b>: камерата сама обикаля света.', '<b>Tour</b>: the camera wanders the world on its own.', '<b>Rundflug</b>: Die Kamera wandert von selbst durch die Welt.')}
      ${li('<b>Нощ</b>: включва и изключва смяната на деня и нощта.', '<b>Night</b>: turns the day and night cycle on or off.', '<b>Nacht</b>: schaltet den Wechsel von Tag und Nacht ein oder aus.')}
      ${li('<b>Детски режим</b>: по-едри букви и по-прости обяснения.', '<b>Kids mode</b>: bigger letters and simpler explanations.', '<b>Kindermodus</b>: größere Schrift und einfachere Erklärungen.')}
      ${li('<b>Панел</b>: скрива и показва страничния панел.', '<b>Panel</b>: hides or shows the side panel.', '<b>Leiste</b>: blendet die Seitenleiste aus oder ein.')}
      ${li('<b>БГ / EN / DE</b>: езикът на играта.', '<b>БГ / EN / DE</b>: the language of the game.', '<b>БГ / EN / DE</b>: die Sprache des Spiels.')}
      ${li('<b>?</b>: този прозорец.', '<b>?</b>: this window.', '<b>?</b>: dieses Fenster.')}
    </ul>
    <h4>${T('Панелът', 'The panel', 'Die Seitenleiste')}</h4>
    <ul class="help">
      ${li('<b>Летопис</b>: всичко, което се случва. Сините имена водят до хората и родовете.', '<b>Chronicle</b>: everything that happens. Blue names lead to the people and clans.', '<b>Chronik</b>: alles, was geschieht. Blaue Namen führen zu den Menschen und Clans.')}
      ${li('<b>Открития</b>: знанията по епохи, кой и кога ги е открил.', '<b>Discoveries</b>: knowledge by age, who found it and when.', '<b>Entdeckungen</b>: das Wissen nach Zeitaltern, wer es wann gefunden hat.')}
      ${li('<b>Родове</b> и <b>Личности</b>: родовете по големина и най-известните хора.', '<b>Clans</b> and <b>People</b>: the clans by size and the most notable people.', '<b>Clans</b> und <b>Personen</b>: die Clans nach Größe und die bekanntesten Menschen.')}
      ${li('<b>Статистика</b>: населението във времето. <b>Тайни</b>: кои тайни са намерени.', '<b>Statistics</b>: the population over time. <b>Secrets</b>: which secrets have been found.', '<b>Statistik</b>: die Bevölkerung im Lauf der Zeit. <b>Geheimnisse</b>: welche schon gefunden wurden.')}
    </ul>
    <p class="muted">${T('Когато се върнеш след време, ще видиш какво е станало, докато те е нямало.',
      'When you come back after a while, you will see what happened while you were away.',
      'Wenn du nach einer Weile zurückkommst, siehst du, was in der Zwischenzeit geschehen ist.')}</p>`;
}

const SEEN_KEY = 'letopis.seenVersion';
function seenVersion(): string | null {
  try { return localStorage.getItem(SEEN_KEY); } catch { return null; }
}

/** a version the viewer has not opened yet: the "?" button shows a dot */
export function hasNews(): boolean {
  return seenVersion() !== CHANGELOG[0].v;
}

const rank = (it: Item) => (it[3] ? TAG_ORDER.indexOf(it[3]) : TAG_ORDER.length);
function itemHtml(it: Item): string {
  const tag = it[3] ? `<span class="tag ${it[3]}">${L3(...TAGS[it[3]])}</span> ` : '';
  return `<li${it[3] ? ` class="${it[3]}"` : ''}>${tag}${L3(it[0], it[1], it[2])}</li>`;
}

/** the whole window; opening it marks the newest version as read */
export function helpWindowHtml(): string {
  const fresh = hasNews();
  try { localStorage.setItem(SEEN_KEY, CHANGELOG[0].v); } catch { /* private mode */ }
  const title = (v: string) => L3(`Какво ново във версия ${v}`, `What's new in v. ${v}`, `Neu in Version ${v}`);
  const releases = CHANGELOG.map((r, i) => `<details class="release"${i === 0 && fresh ? ' open' : ''}>
      <summary>${title(r.v)}</summary>
      <ul>${[...r.items].sort((a, b) => rank(a) - rank(b)).map(itemHtml).join('')}</ul>
    </details>`).join('');
  return `<h2>${T('Летопис', 'Letopis', 'Letopis')}</h2><div class="releases">${releases}</div>${helpHtml()}`;
}
