// German for Letopis. Like the English in i18n.ts, but German needs cases and genders:
// a clan is always written "der Clan Wolfszahn" and a village "das Dorf Weißdorf", so that the article
// can follow the case of the sentence ("aus dem Clan Wolfszahn", "des Dorfes Weißdorf").
// People have German names of their own (people-l10n.ts). Names stay in the nominative in every sentence,
// because German declines the nicknames ("Johann der Starke", but "mit Johann dem Starken").

import { CLAN_DE, clanBase } from './clans';
import { personName, villageName } from './people-l10n';
import { TECH_BG, translit } from './i18n';

export type Case = 'nom' | 'akk' | 'dat' | 'gen';

/** "Иван Мъдрия" -> "Johann der Weise", "Мария Петрова" -> "Maria Petersen" */
export function personDe(name: string): string {
  return personName(name, 'de', translit);
}

/** "Бялово" -> "Weißdorf" */
export function villageDe(name: string): string {
  return villageName(name, 'de') ?? translit(name);
}

// ---------- clans ----------

// The first clans of a world have names in the old style: "Родът на Белия Вълк от Ледения Хълм".
// German: "Weißer Wolf vom Eisigen Hügel". Nouns with their gender, adjectives as stems.
const NOUN: Record<string, [string, 'm' | 'f' | 'n']> = {
  Вълк: ['Wolf', 'm'], Орел: ['Adler', 'm'], Орела: ['Adler', 'm'], Елен: ['Hirsch', 'm'], Сокол: ['Falke', 'm'], Глиган: ['Keiler', 'm'],
  Бизон: ['Bison', 'm'], Бухал: ['Uhu', 'm'], Дъб: ['Eiche', 'f'], Камък: ['Stein', 'm'], Камъка: ['Stein', 'm'], Огън: ['Feuer', 'n'],
  Огъня: ['Feuer', 'n'], Вятър: ['Wind', 'm'], Вятъра: ['Wind', 'm'], Гарван: ['Rabe', 'm'], Рис: ['Luchs', 'm'], Бобър: ['Biber', 'm'],
  Бобъра: ['Biber', 'm'], Кон: ['Pferd', 'n'], Коня: ['Pferd', 'n'], Ястреб: ['Habicht', 'm'], Бор: ['Kiefer', 'f'], Облак: ['Wolke', 'f'],
  Лъв: ['Löwe', 'm'], Щъркел: ['Storch', 'm'], Мамут: ['Mammut', 'n'], Тур: ['Auerochse', 'm'], Зубър: ['Wisent', 'm'], Зубъра: ['Wisent', 'm'],
  Гром: ['Donner', 'm'], Кремък: ['Feuerstein', 'm'], Кремъка: ['Feuerstein', 'm'], Вихър: ['Wirbelwind', 'm'], Вихъра: ['Wirbelwind', 'm'],
  Здрач: ['Dämmerung', 'f'], Изгрев: ['Sonnenaufgang', 'm'], Залез: ['Sonnenuntergang', 'm'], Ручей: ['Bach', 'm'], Ручея: ['Bach', 'm'],
  Руче: ['Bach', 'm'], Водопад: ['Wasserfall', 'm'], Лебед: ['Schwan', 'm'], Жерав: ['Kranich', 'm'], Таралеж: ['Igel', 'm'],
  Козирог: ['Steinbock', 'm'], Скорпион: ['Skorpion', 'm'], Кълвач: ['Specht', 'm'], Чинар: ['Platane', 'f'], Явор: ['Ahorn', 'm'],
  Бръшлян: ['Efeu', 'm'], Мечка: ['Bärin', 'f'], Лисица: ['Füchsin', 'f'], Риба: ['Fisch', 'm'], Река: ['Fluss', 'm'], Звезда: ['Stern', 'm'],
  Луна: ['Mond', 'm'], Сърна: ['Reh', 'n'], Сова: ['Eule', 'f'], Змия: ['Schlange', 'f'], Пчела: ['Biene', 'f'], Скала: ['Fels', 'm'],
  Планина: ['Berg', 'm'], Роса: ['Tau', 'm'], Гора: ['Wald', 'm'], Зорница: ['Morgenstern', 'm'], Лястовица: ['Schwalbe', 'f'],
  Мълния: ['Blitz', 'm'], Кошута: ['Hirschkuh', 'f'], Вълчица: ['Wölfin', 'f'], Чапла: ['Reiher', 'm'], Пеперуда: ['Schmetterling', 'm'],
  Върба: ['Weide', 'f'], Липа: ['Linde', 'f'], Буря: ['Sturm', 'm'], Зора: ['Morgenröte', 'f'], Дъга: ['Regenbogen', 'm'], Мравка: ['Ameise', 'f'],
  Видра: ['Otter', 'm'], Катерица: ['Eichhörnchen', 'n'], Костенурка: ['Schildkröte', 'f'], Калинка: ['Marienkäfer', 'm'], Сойка: ['Eichelhäher', 'm'],
  Кукумявка: ['Steinkauz', 'm'], Слънцето: ['Sonne', 'f'], Езерото: ['See', 'm'], Еленчето: ['Hirschkalb', 'n'], Пламъчето: ['Flämmchen', 'n'],
  Ехото: ['Echo', 'n'], Огнището: ['Herd', 'm'], Небето: ['Himmel', 'm'], Сърцето: ['Herz', 'n'],
  Хълм: ['Hügel', 'm'], Брод: ['Furt', 'f'], Извор: ['Quelle', 'f'], Бряг: ['Ufer', 'n'], Дол: ['Grund', 'm'], Кладенец: ['Brunnen', 'm'],
  Проход: ['Pass', 'm'], Долина: ['Tal', 'n'], Пещера: ['Höhle', 'f'], Поляна: ['Wiese', 'f'], Падина: ['Senke', 'f'], Могила: ['Hügelgrab', 'n'],
  Степ: ['Steppe', 'f'],
};
const ADJ: [string, string, string][] = [
  ['Белия', 'Бялата', 'Weiß'], ['Сивия', 'Сивата', 'Grau'], ['Черния', 'Черната', 'Schwarz'], ['Червения', 'Червената', 'Rot'],
  ['Златния', 'Златната', 'Golden'], ['Стария', 'Старата', 'Alt'], ['Бързия', 'Бързата', 'Schnell'], ['Тихия', 'Тихата', 'Still'],
  ['Големия', 'Голямата', 'Groß'], ['Малкия', 'Малката', 'Klein'], ['Мъдрия', 'Мъдрата', 'Weis'], ['Самотния', 'Самотната', 'Einsam'],
  ['Северния', 'Северната', 'Nördlich'], ['Южния', 'Южната', 'Südlich'], ['Сребърния', 'Сребърната', 'Silbern'], ['Огнения', 'Огнената', 'Feurig'],
  ['Ледения', 'Ледената', 'Eisig'], ['Звездния', 'Звездната', 'Sternklar'], ['Нощния', 'Нощната', 'Nächtlich'], ['Утринния', 'Утринната', 'Morgendlich'],
  ['Буйния', 'Буйната', 'Ungestüm'], ['Каменния', 'Каменната', 'Steinern'], ['Небесния', 'Небесната', 'Himmlisch'], ['Дивия', 'Дивата', 'Wild'],
  ['Пеещия', 'Пеещата', 'Singend'], ['Шепнещия', 'Шепнещата', 'Flüsternd'], ['Синия', 'Синята', 'Blau'], ['Ранения', 'Ранената', 'Verwundet'],
];
const ADJ_DE = new Map<string, string>();
for (const [m, f, de] of ADJ) { ADJ_DE.set(m, de); ADJ_DE.set(f, de); }

function noun(w: string): [string, 'm' | 'f' | 'n'] | null {
  return NOUN[w] ?? NOUN[w.slice(0, -1)] ?? NOUN[w.slice(0, -2)] ?? null;
}
const STRONG = { m: 'er', f: 'e', n: 'es' };

/** "Белия Вълк" -> "Weißer Wolf", "Вълка" -> "Wolf" (a name, in the nominative) */
function totemDe(s: string): string {
  const w = s.split(' ');
  if (w.length === 2 && ADJ_DE.has(w[0])) {
    const n = noun(w[1]);
    if (n) return `${ADJ_DE.get(w[0])}${STRONG[n[1]]} ${n[0]}`;
  }
  const n = noun(s);
  return n ? n[0] : translit(s);
}
/** "Ледения Хълм" -> "vom Eisigen Hügel", "Тъмната Пещера" -> "von der ... Höhle" */
function placeDe(s: string): string {
  const w = s.split(' ');
  const n = noun(w[w.length - 1]);
  if (!n) return `von ${translit(s)}`;
  const adj = w.length === 2 && ADJ_DE.has(w[0]) ? `${ADJ_DE.get(w[0])}en ` : '';
  return `${n[1] === 'f' ? 'von der' : 'vom'} ${adj}${n[0]}`;
}

/** a clan name in two forms: how it is shown on its own, and how it is written after "Clan" */
function clanForms(name: string): [string, string] {
  const c = clanBase(name);
  if (c) {
    const [show, inClan] = CLAN_DE.get(c[0])!.split('|');
    return [show + c[1], (inClan ?? show) + c[1]];
  }
  const m = /^(?:Родът|рода) на (.+)$/.exec(name);
  if (!m) return [translit(name), translit(name)];
  const [totem, place] = m[1].split(' от ');
  const s = totemDe(totem) + (place ? ` ${placeDe(place)}` : '');
  return [s, s];
}

/** the clan as it stands on its own: "Wolfszahn", "Die Roten", "Weißer Wolf vom Eisigen Hügel" */
export const bandDe = (name: string) => clanForms(name)[0];
/** the clan as it is written in a sentence after "Clan": "Wolfszahn", "der Roten" */
export const bandDeInText = (name: string) => clanForms(name)[1];

const ART_M: Record<Case, string> = { nom: 'der', akk: 'den', dat: 'dem', gen: 'des' };
const ART_N: Record<Case, string> = { nom: 'das', akk: 'das', dat: 'dem', gen: 'des' };
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

/** "der Clan Wolfszahn", "des Clans der Roten", "dem Dorf Weißdorf", "des Dorfes Weißdorf" */
export function bandLabelDe(name: string, settlement: string | null | undefined, c: Case, capital = false): string {
  const s = settlement
    ? `${ART_N[c]} ${c === 'gen' ? 'Dorfes' : 'Dorf'} ${villageDe(settlement)}`
    : `${ART_M[c]} ${c === 'gen' ? 'Clans' : 'Clan'} ${bandDeInText(name)}`;
  return capital ? cap(s) : s;
}

/** a preposition with the dative: "aus dem Clan X", "im Dorf X", "vom Clan X", "beim Clan X" */
export function bandWithDe(prep: 'aus' | 'in' | 'von' | 'bei', name: string, settlement: string | null | undefined, capital = false): string {
  const dat = bandLabelDe(name, settlement, 'dat'); // "dem Clan X"
  const rest = dat.slice(4);
  const s = prep === 'aus' ? `aus ${dat}` : `${{ in: 'im', von: 'vom', bei: 'beim' }[prep]} ${rest}`;
  return capital ? cap(s) : s;
}

/**
 * any band text the server writes in Bulgarian ("Родът на ...", "рода на ...", a clan name, "Селото X", a village),
 * for the page, without an article: "Clan Wolfszahn", "Dorf Weißdorf"
 */
export function bandTextDe(s: string): string {
  if (!s) return s;
  if (/^(Родът|рода) на /.test(s) || clanBase(s)) return `Clan ${bandDeInText(s)}`;
  const v = /^(Селото|селото) (.+)$/.exec(s);
  if (v) return `Dorf ${villageDe(v[2])}`;
  return villageDe(s);
}

/** the same, in a case and with an article: "dem Clan Wolfszahn", "dem Dorf Weißdorf" */
export function bandTextCaseDe(s: string, c: Case): string {
  if (/^(Родът|рода) на /.test(s) || clanBase(s)) return bandLabelDe(s, null, c);
  const v = /^(Селото|селото) (.+)$/.exec(s);
  return bandLabelDe('', v ? v[2] : s, c);
}

// ---------- discoveries ----------

/**
 * {name} is a person (always in the nominative), {Band} the band as a subject at the start of a sentence,
 * {aus band} "aus dem Clan X"; a sentence that starts with {Band} refers back to it with "sein" (Clan and Dorf are
 * both masculine or neuter).
 */
export const TECH_DE: Record<string, { name: string; text: string; kids: string }> = {
  fire: { name: 'Feuer', text: '{name} {aus band} zähmte das Feuer. Die Nächte sind nun nicht mehr so kalt und furchterregend.', kids: '{name} hat das erste Feuer entzündet! Jetzt haben die Menschen es warm und können ihr Essen kochen.' },
  stone_tools: { name: 'Steinwerkzeuge', text: '{name} {aus band} lernte, Feuerstein zu scharfen Klingen zu schlagen.', kids: '{name} hat ein Messer aus Stein gemacht. Schneiden ist jetzt viel leichter!' },
  herb_lore: { name: 'Kräuterkunde', text: '{name} {aus band} merkte sich, welche Kräuter heilen und welche giftig sind.', kids: '{name} hat herausgefunden, welche Pflanzen gegen Bauchweh helfen.' },
  burial: { name: 'Bestattungsriten', text: '{Band} verabschiedete seine Toten zum ersten Mal mit einem Ritual. {name} sang am Grab.', kids: '{Band} begann, mit Liedern an seine Großmütter und Großväter zu erinnern.' },
  spear: { name: 'Speer', text: '{name} {aus band} band eine Steinspitze an einen langen Stock. Die Jagd wird sicherer.', kids: '{name} hat den Speer erfunden. Die Jäger müssen nicht mehr so nah an die Tiere heran.' },
  clothing: { name: 'Kleidung aus Fellen', text: '{name} {aus band} nähte die ersten Kleider aus Fellen. Der Winter ist kein Todesurteil mehr.', kids: '{name} hat warme Kleidung aus Fellen genäht. Jetzt kann man auch im Winter nach draußen!' },
  cave_art: { name: 'Höhlenmalerei', text: '{name} {aus band} malte mit Ocker und Holzkohle eine Jagd an die Höhlenwand.', kids: '{name} hat Tiere an die Höhlenwand gemalt. Die ersten Bilder der Welt!' },
  fishing: { name: 'Fischfang', text: '{name} {aus band} lernte, Fische mit der Harpune zu fangen.', kids: '{name} hat mit der Harpune den ersten Fisch gefangen. Jetzt gibt der Fluss Nahrung!' },
  shelter: { name: 'Zelte', text: '{name} {aus band} spannte Felle über Knochen und Äste. Die ersten Zelte.', kids: '{name} hat ein Zelt gebaut. Jetzt kann man überall im Trockenen schlafen.' },
  bow: { name: 'Pfeil und Bogen', text: '{name} {aus band} spannte eine Sehne über einen gebogenen Stock. Der Bogen trifft aus der Ferne.', kids: '{name} hat den Bogen erfunden! Pfeile fliegen weit.' },
  dog: { name: 'Gezähmter Hund', text: 'Wolfswelpen blieben am Feuer {band:gen}. {name} fütterte sie, und sie wurden die ersten Hunde.', kids: '{name} hat einen Freund gefunden: ein kleines Wolfsjunges, das zum ersten Hund wurde!' },
  grinding: { name: 'Getreidemahlen', text: '{name} {aus band} zerrieb wildes Getreide zwischen zwei Steinen. Das Mehl wird zum Vorrat für den Winter.', kids: '{name} hat Körner zwischen zwei Steinen zerrieben und Mehl gemacht.' },
  agriculture: { name: 'Ackerbau', text: '{name} {aus band} bemerkte, dass aus heruntergefallenen Körnern neue Pflanzen wachsen. Der Clan sät sein erstes Feld und zieht nicht mehr umher.', kids: '{name} hat Samen gepflanzt, und neue Pflanzen sind daraus gewachsen! Jetzt können die Menschen an einem Ort bleiben.' },
  pottery: { name: 'Töpferei', text: '{name} {aus band} brannte Ton im Feuer. Töpfe schützen das Essen vor Mäusen und Feuchtigkeit.', kids: '{name} hat einen Topf aus Ton gebrannt. Jetzt hält sich das Essen lange!' },
  herding: { name: 'Viehzucht', text: '{name} {aus band} sperrte wilde Ziegen in einen Pferch. Fleisch und Milch ohne Jagd.', kids: '{name} hat Ziegen gezähmt. Jetzt gibt es jeden Tag Milch!' },
  weaving: { name: 'Weben', text: '{name} {aus band} spann Flachs zu Garn und webte daraus Stoff.', kids: '{name} hat den ersten Stoff gewebt. Die Kleidung wird weich und leicht.' },
  mudbrick: { name: 'Lehmhäuser', text: '{name} {aus band} errichtete das erste Haus aus Flechtwerk und Lehm. Das Dorf wird allmählich zur Heimat.', kids: '{name} hat ein richtiges Haus aus Lehm gebaut!' },
  boats: { name: 'Einbaum', text: '{name} {aus band} höhlte einen Baumstamm zu einem Boot aus. Flüsse sind keine Grenze mehr.', kids: '{name} hat ein Boot gebaut und ist den Fluss hinuntergefahren!' },
  copper: { name: 'Kupfer', text: '{name} {aus band} bemerkte, dass ein grüner Stein in der Glut des Töpferofens ein glänzendes rotes Metall freigibt. Die ersten Nadeln und Ahlen aus Kupfer.', kids: '{name} hat einen grünen Stein im Feuer geschmolzen, und rotes Metall ist herausgeflossen: Kupfer!' },
  plough: { name: 'Pflug', text: '{name} {aus band} spannte einen Ochsen vor einen spitzen Holzpfahl. Ein Feld ist an einem Tag gepflügt statt in einer Woche.', kids: '{name} hat dem Ochsen beigebracht, den Pflug zu ziehen. Jetzt können die Felder viel größer sein!' },
  wheel: { name: 'Rad', text: '{name} {aus band} steckte eine Holzscheibe auf eine Achse. Der erste Karren trägt eine Last, die drei Menschen nicht heben könnten.', kids: '{name} hat das Rad erfunden! Der Karren trägt die schweren Sachen statt der Menschen.' },
  bronze: { name: 'Bronze', text: '{name} {aus band} mischte Kupfer mit Zinn und erhielt ein Metall, das härter ist als jeder Stein. Ein neues Zeitalter beginnt.', kids: '{name} hat zwei Metalle gemischt und Bronze gemacht: hart und golden!' },
  sailing: { name: 'Segel', text: '{name} {aus band} spannte gewebten Stoff über ein Boot. Der Wind trägt es weiter, als Ruderer kommen.', kids: '{name} hat ein Segel an das Boot gemacht, und der Wind hat es angeschoben!' },
  writing: { name: 'Schrift', text: '{name} {aus band} drückte Zeichen in feuchten Ton, um festzuhalten, wie viel Getreide im Speicher liegt. Die erste Schrift.', kids: '{name} hat Zeichen in den Ton geritzt, die andere lesen können. Das ist Schrift!' },
  trade: { name: 'Handel', text: '{name} {aus band} belud einen Karren mit Töpfen und kam mit Feuerstein, Salz und Kupfer zurück. Die Nachbarn helfen nun einander.', kids: '{name} hat mit den Nachbarn Töpfe gegen Salz getauscht. Alle waren froh!' },
  walls: { name: 'Stadtmauern', text: '{Band} errichtete Steinmauern um seine Häuser. {name} leitete die Arbeit. Aus dem Dorf wird eine Stadt.', kids: '{name} hat eine hohe Mauer um das Dorf gebaut. Jetzt ist es eine richtige Stadt!' },
  calendar: { name: 'Kalender', text: '{name} {aus band} zählte die Tage von einem Vollmond zum nächsten und schrieb auf, wann gesät werden muss. Die Ernte kommt nicht mehr zu spät.', kids: '{name} hat am Mond und an den Sternen abgelesen, wann man die Samen säen muss.' },
  horse: { name: 'Gezähmtes Pferd', text: '{name} {aus band} zähmte ein Wildpferd und spannte es vor den Karren. Der Weg zu den Nachbarn wurde dreimal kürzer.', kids: '{name} hat sich mit einem Pferd angefreundet, und jetzt reiten sie zusammen!' },
  iron: { name: 'Eisen', text: '{name} {aus band} heizte den Ofen heißer als je zuvor, und aus dem roten Erz kam ein dunkles Metall. Eisen gibt es überall, und es ist billiger als Bronze. Ein neues Zeitalter beginnt.', kids: '{name} hat Eisen geschmiedet: dunkel, fest und überall zu finden!' },
  alphabet: { name: 'Alphabet', text: '{name} {aus band} gab jedem Laut ein eigenes Zeichen. Hunderte Zeichen braucht man nicht mehr: Zwei Dutzend genügen, um jedes Wort zu schreiben.', kids: '{name} hat das Alphabet erfunden: nur wenige Buchstaben, und damit kann man alles schreiben!' },
  harbor: { name: 'Hafen', text: '{name} {aus band} schüttete Steine in die Bucht und baute eine Mole. Nun legen hier Schiffe an und bringen Waren von fernen Küsten.', kids: '{name} hat einen Hafen gebaut, und von weit her kommen Schiffe zu Besuch!' },
  kingdom: { name: 'Königreich', text: '{Band} vereinte die Nachbardörfer unter einer Krone, und {name} setzte sie auf. Ohne eine einzige Schlacht entsteht das erste Königreich.', kids: '{name} hat mehrere Dörfer zu einem Königreich vereint und alle zu einem großen Fest eingeladen!' },
  coins: { name: 'Münzen', text: '{name} {aus band} prägte kleine Silberscheiben mit gleichem Gewicht und einem Stempel. Niemand muss mehr Kühe und Töpfe mitschleppen, um etwas zu kaufen.', kids: '{name} hat die ersten Münzen gemacht. Damit kann man alles kaufen, ohne eine Kuh mitzuschleppen!' },
  laws: { name: 'Geschriebene Gesetze', text: '{name} {aus band} meißelte die Gesetze in eine Steinplatte auf dem Platz. Jeder kann sie lesen, und der Richter entscheidet nicht mehr nach Lust und Laune.', kids: '{name} hat die Regeln auf einen großen Stein geschrieben, damit sie für alle gleich sind.' },
  theatre: { name: 'Theater', text: '{name} {aus band} setzte eine Maske auf und spielte vor der ganzen Stadt eine alte Sage. Die Menschen weinten und lachten gemeinsam.', kids: '{name} hat eine lustige Maske aufgesetzt, und alle haben gelacht!' },
  medicine: { name: 'Heilkunde', text: '{name} {aus band} schrieb auf, welches Kraut gegen welche Krankheit hilft. Heiler lernen jetzt aus Schriftrollen, nicht nur von ihren Großmüttern.', kids: '{name} hat aufgeschrieben, wie man Krankheiten heilt, damit auch andere helfen können.' },
  aqueduct: { name: 'Aquädukt', text: '{Band} brachte Wasser aus den Bergen über steinerne Bögen in die Stadt. {name} führte die Arbeiten an. Nun fließt sauberes Wasser, und es gibt weniger Krankheiten.', kids: '{name} hat eine Brücke für Wasser gebaut, und es fließt bis in die Stadt!' },
  library: { name: 'Bibliothek', text: '{name} {aus band} trug alle Schriftrollen an einem Ort zusammen. Was einmal gelernt ist, gerät nicht mehr in Vergessenheit.', kids: '{name} hat viele Schriftrollen in ein Haus gebracht. Dort kann jeder lesen!' },
  watermill: { name: 'Wassermühle', text: '{name} {aus band} setzte ein Rad in den Fluss und ließ es den Mühlstein drehen. Der Fluss mahlt das Mehl statt der Menschen.', kids: '{name} hat den Fluss ein großes Rad drehen lassen, und das mahlt ganz allein Mehl!' },
  arch: { name: 'Gewölbe und Beton', text: '{name} {aus band} mischte Vulkansand mit Kalk und baute einen Bogen, der sich selbst trägt. Brücken und Kuppeln stehen nun jahrhundertelang.', kids: '{name} hat einen Stein gemacht, den man wie Matsch gießen kann und der dann hart wird!' },
};

/** fill a TECH_DE text for a person and a band */
export function fillTechDe(s: string, person: string, bandName: string, settlement: string | null | undefined): string {
  return s.replace('{name}', person)
    .replace('{aus band}', bandWithDe('aus', bandName, settlement))
    .replace('{band:gen}', bandLabelDe(bandName, settlement, 'gen'))
    .replace('{Band}', bandLabelDe(bandName, settlement, 'nom', true));
}

/** a line about each discovery still to come */
export const TECH_DESC_DE: Record<string, string> = {
  fire: 'Das Feuer zähmen: Wärme, Licht und gebratenes Fleisch.',
  stone_tools: 'Scharfe Messer und Schaber aus Feuerstein.',
  burial: 'Die Toten werden mit einem Ritual verabschiedet und nicht vergessen.',
  spear: 'Eine Steinspitze an einem langen Schaft: Die Jagd wird sicherer.',
  herb_lore: 'Welche Pflanzen heilen und welche giftig sind.',
  clothing: 'Kleidung aus Fellen, um den Winter zu überleben.',
  cave_art: 'Bilder aus Ocker und Holzkohle an den Höhlenwänden.',
  shelter: 'Felle über Knochen und Ästen: überall ein Dach über dem Kopf.',
  fishing: 'Eine Harpune und Fisch aus dem Fluss.',
  dog: 'Wolfswelpen am Feuer werden die ersten Hunde.',
  bow: 'Eine Sehne an einem gebogenen Stock: ein Treffer aus der Ferne.',
  grinding: 'Zwischen zwei Steinen gemahlenes Korn wird zu Mehl.',
  agriculture: 'Gesätes Korn wird zum Feld, und der Clan zieht nicht mehr umher.',
  pottery: 'Gebrannter Ton schützt das Essen vor Mäusen und Feuchtigkeit.',
  herding: 'Ziegen und Schafe im Pferch: Milch und Fleisch ohne Jagd.',
  weaving: 'Flachs, zu Garn gesponnen und zu Stoff gewebt.',
  mudbrick: 'Häuser aus Flechtwerk und Lehm: Das Dorf wird zur Heimat.',
  boats: 'Ein ausgehöhlter Stamm: Flüsse sind keine Grenze mehr.',
  copper: 'Ein grüner Stein in der Glut ergibt ein rotes Metall.',
  plough: 'Ein Ochse und ein spitzer Pfahl: ein Feld an einem Tag statt in einer Woche.',
  wheel: 'Eine Holzscheibe auf einer Achse und der erste Karren.',
  bronze: 'Kupfer und Zinn ergeben ein Metall, das härter ist als Stein.',
  sailing: 'Ein Segel am Boot: Der Wind rudert statt der Menschen.',
  writing: 'Zeichen im Ton, die das Gedächtnis der Menschen bewahren.',
  trade: 'Waren werden zwischen fernen Dörfern getauscht.',
  walls: 'Steinmauern um das Dorf: die ersten Städte.',
  calendar: 'Die Sterne sagen, wann gesät und wann geerntet wird.',
  horse: 'Ein Pferd zum Reiten: Aus einer Woche Fußweg wird ein Tag.',
  iron: 'Ein dunkles Metall aus rotem Erz: Werkzeug für alle.',
  alphabet: 'Ein Zeichen für jeden Laut: Jeder kann schreiben lernen.',
  harbor: 'Eine steinerne Mole: Schiffe kommen von fernen Küsten.',
  kingdom: 'Mehrere Dörfer unter einer Krone und mit einer Hauptstadt.',
  coins: 'Gestempeltes Silber: Der Markt wird einfach.',
  laws: 'Regeln in Stein, für alle gleich.',
  theatre: 'Masken, eine Bühne und alte Sagen vor der ganzen Stadt.',
  medicine: 'Heilkunst, in Schriftrollen festgehalten.',
  aqueduct: 'Steinerne Bögen bringen sauberes Wasser in die Stadt.',
  library: 'Alle Schriftrollen an einem Ort: Wissen geht nicht verloren.',
  watermill: 'Der Fluss dreht den Mühlstein.',
  arch: 'Ein Bogen, der sich selbst trägt, und Stein, den man gießen kann.',
};

/** a tech by its Bulgarian name (what the server sends) */
export function techDe(bg: string): string {
  const id = TECH_BG[bg];
  return id ? TECH_DE[id].name : bg;
}

// ---------- ages, months, titles, tasks ----------

export const ERAS_DE = ['Altsteinzeit', 'Jungsteinzeit', 'Bronzezeit', 'Eisenzeit', 'Mittelalter', 'Neuzeit', 'Industriezeitalter', 'Informationszeitalter', 'Raumfahrtzeitalter'];
/** the article of each age: "die Bronzezeit", "das Mittelalter" */
export const ERAS_DE_ART = ['die', 'die', 'die', 'die', 'das', 'die', 'das', 'das', 'das'];
export function eraDe(bg: string, eras: string[]): string {
  const i = eras.indexOf(bg);
  return i < 0 ? bg : ERAS_DE[i];
}
/** why an age begins, for the chronicle */
export const ERA_WHY_DE: Record<number, string> = {
  1: 'Die Menschen suchen ihre Nahrung nicht mehr nur, sie bauen sie an.',
  2: 'Kupfer und Zinn verschmelzen zu einem Metall, das härter ist als Stein. Aus Dörfern werden Städte.',
  3: 'Eisen gibt es überall, und es ist billiger als Bronze. Dörfer schließen sich zu Königreichen zusammen.',
};

export const MONTHS_DE = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

/** chief titles: [for a man, for a woman] */
const CHIEF_DE: Record<string, [string, string]> = {
  Старейшина: ['Ältester', 'Älteste'], Вожд: ['Häuptling', 'Stammesführerin'], Княз: ['Fürst', 'Fürstin'], Кмет: ['Bürgermeister', 'Bürgermeisterin'], Цар: ['König', 'Königin'],
};
export function chiefDe(bg: string, female = false): string {
  const t = CHIEF_DE[bg] ?? CHIEF_DE[bg[0]?.toUpperCase() + bg.slice(1)];
  return t ? t[female ? 1 : 0] : bg;
}

/** "Старейшина на Бялово" -> "Bürgermeister von Weißdorf", "Старейшина на рода на Вълка" -> "Ältester des Clans Wolf" */
export function titleDe(s: string, female = false): string {
  const m = /^(\S+) на (.+)$/.exec(s);
  if (!m) return s;
  const t = chiefDe(m[1], female);
  if (/^(Родът|рода) на /.test(m[2]) || clanBase(m[2])) return `${t} des Clans ${bandDeInText(m[2])}`;
  return `${t} von ${villageDe(m[2])}`;
}

/** what someone is doing; it fits both "Gerade: auf der Jagd" for one person and "3 auf der Jagd" for a clan */
export const TASK_NAMES_DE: Record<string, string> = {
  rest: 'beim Ausruhen', gather: 'beim Sammeln von Früchten und Wurzeln', hunt: 'auf der Jagd', fish: 'beim Fischen',
  craft: 'beim Werkzeugmachen', farm: 'bei der Feldarbeit', herd: 'beim Hüten der Tiere', build: 'beim Bauen', child: 'beim Spielen',
  elder: 'beim Geschichtenerzählen', travel: 'unterwegs', lead: 'an der Spitze des Clans', scout: 'auf der Suche nach einem neuen Lagerplatz',
  chop: 'beim Holzhacken', sleep: 'im Schlaf', guard: 'auf Wache im Dorf', bodyguard: 'als Leibwache des Anführers',
};

export const BIOME_NAMES_DE: Record<number, string> = {
  0: 'Tiefsee', 1: 'Meer', 2: 'Küste', 3: 'Wiesen', 4: 'Ebene', 5: 'Laubwald', 6: 'Nadelwald', 7: 'Hügel',
  8: 'Gebirge', 9: 'Ewiger Schnee', 10: 'Ödland', 11: 'Tundra', 12: 'Sumpf', 13: 'See',
};

export const GENE_DE: Record<string, string> = {
  Сила: 'Stärke', Ум: 'Verstand', Любопитство: 'Neugier', Общителност: 'Geselligkeit', Здраве: 'Gesundheit', Дълголетие: 'Langlebigkeit',
};

/** how someone died, with the age: "starb mit 71 Jahren an Altersschwäche" */
const CAUSE_DE: Record<string, string> = {
  'загина на лов': 'kam mit {a} Jahren bei der Jagd ums Leben',
  'почина в гладна година': 'starb mit {a} Jahren in einem Hungerjahr',
  'почина в лютата зима': 'starb mit {a} Jahren im bitterkalten Winter',
  'почина от старост': 'starb mit {a} Jahren an Altersschwäche',
  'почина като дете': 'starb schon als Kind mit {a} Jahren',
  'почина от болест': 'starb mit {a} Jahren an einer Krankheit',
};
export function causeDe(bg: string, age: number): string {
  if (age < 1 && bg === 'почина като дете') return 'starb kurz nach der Geburt';
  const t = CAUSE_DE[bg];
  if (!t) return bg;
  return t.replace('{a} Jahren', age === 1 ? 'einem Jahr' : `${age} Jahren`);
}

/** the great beasts of a hunt, in the accusative ("gegen ein Mammut") */
export const BEAST_DE: Record<string, string> = {
  мамут: 'ein Mammut', 'пещерна мечка': 'einen Höhlenbären', 'огромен зубър': 'einen riesigen Wisent', 'стадо диви коне': 'eine Herde Wildpferde',
  'гигантски елен': 'einen Riesenhirsch',
};

/** where two clans met */
export const FEATURE_DE: Record<string, string> = {
  реката: 'am Fluss', гората: 'am Waldrand', хълмовете: 'in den Hügeln', морето: 'am Meer', 'голямата поляна': 'auf der großen Wiese',
};

// ---------- years and numbers ----------

/** 25449 -> "25.449" (German groups thousands with a dot) */
export function numDe(n: number): string {
  const s = String(Math.abs(Math.round(n)));
  return (n < 0 ? '-' : '') + s.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/** -11881 -> "11.881 v. Chr.", 1200 -> "1200 n. Chr." (four-digit years without the dot) */
export function formatYearDe(year: number): string {
  const y = Math.abs(Math.round(year));
  const s = y >= 10000 ? numDe(y) : String(y);
  return year < 0 ? `${s} v. Chr.` : `${s} n. Chr.`;
}

/** years written by the server inside a Bulgarian text: "11 900 г. пр.н.е." -> "11.900 v. Chr." */
export function yearsInTextDe(s: string): string {
  return s.replace(/(\d[\d\s  ]*) г\.( пр\.н\.е\.)?/g, (_, n: string, bc?: string) => formatYearDe((bc ? -1 : 1) * Number(n.replace(/\D/g, ''))));
}

/** a person's deeds as the server stores them in Bulgarian */
export function deedDe(d: string): string {
  let m: RegExpExecArray | null;
  if ((m = /^Откри „(.+)“ \((.+)\)$/.exec(d))) return `Entdeckte „${techDe(m[1])}“ (${yearsInTextDe(m[2])})`;
  if ((m = /^Преоткри „(.+)“ за своя род$/.exec(d))) return `Entdeckte „${techDe(m[1])}“ für den eigenen Clan neu`;
  if ((m = /^Доживя до 70 години \((.+)\)$/.exec(d))) return `Wurde 70 Jahre alt (${yearsInTextDe(m[1])})`;
  if ((m = /^Стана първият цар на царство (.+) \((.+)\)$/.exec(d))) return `Wurde der erste König des Königreichs ${villageDe(m[1])} (${yearsInTextDe(m[2])})`;
  if ((m = /^Основа (.+) и стана негов (\S+) \((.+)\)$/.exec(d))) return `Gründete ${bandTextCaseDe(m[1], 'akk')} und stand ihm vor (${yearsInTextDe(m[3])})`;
  if ((m = /^Поведе лова на (.+)$/.exec(d))) return `Führte die Jagd auf ${BEAST_DE[m[1]] ?? m[1]} an`;
  return yearsInTextDe(d);
}

// ---------- secrets ----------

export const SECRET_HEROES_DE: string[] = [
  'Der schlaue Peter', 'Nasreddin Hodscha', 'Krali Marko', 'Peter Pan', 'Aschenputtel',
  'Schneewittchen', 'Rotkäppchen', 'Der gestiefelte Kater', 'Pinocchio', 'Alice',
  'Hänsel', 'Gretel', 'Däumelinchen', 'Die kleine Meerjungfrau', 'Das hässliche Entlein',
  'Dornröschen', 'Rapunzel', 'Rumpelstilzchen', 'Aladin', 'Ali Baba',
  'Sindbad der Seefahrer', 'Baron Münchhausen', 'Gulliver', 'Robinson Crusoe', 'Tom Sawyer',
  'Huckleberry Finn', 'Dorothy', 'Der Blechmann', 'Der feige Löwe', 'Die Vogelscheuche',
  'Pu der Bär', 'Ferkel', 'I-Aah', 'Baba Jaga', 'Koschtschei der Unsterbliche',
  'Iwan Zarewitsch', 'Wassilissa die Weise', 'Der Feuervogel', 'Siwka-Burka', 'Kolobok',
  'Smej Gorjanin', 'Die Samodiva', 'Das goldene Mädchen', 'Gevatterin Füchsin', 'Gevatter Wolf',
  'Meister Lampe', 'Großmutter Bärin', 'Väterchen Frost', 'Snegurotschka', 'Der standhafte Zinnsoldat',
  'Die Schneekönigin', 'Gerda', 'Kai', 'Die Bremer Stadtmusikanten', 'Das tapfere Schneiderlein',
  'Der Däumling', 'Goldlöckchen', 'Die Schöne', 'Das Biest', 'Blaubart',
  'Die Prinzessin auf der Erbse', 'Elisa', 'Zar Saltan', 'Das goldene Fischlein', 'Jemelja',
  'Der Meereskönig', 'Robin Hood', 'König Artus', 'Merlin', 'Lancelot',
  'Nils Holgersson', 'Der Froschkönig', 'Die ungeborene Maid', 'Großvaters Fäustling', 'Das Weizenbrot',
  'Iwan der Narr', 'Die Froschprinzessin', 'Die stumme Prinzessin', 'Die Schildkröte', 'Der flinke Hase',
  'Die schlaue Füchsin', 'Die Grille', 'Die Ameise', 'Der Rabe', 'Scheherazade',
  'Der Geist aus der Lampe', 'Der kleine Muck', 'Kalif Storch', 'Zwerg Nase', 'Der Nussknacker',
  'König Drosselbart', 'Hans', 'Das Mädchen mit den Schwefelhölzern', 'Der Schornsteinfeger', 'Naf-Naf',
  'Nuf-Nuf', 'Nif-Nif', 'Die kleine rote Henne', 'Die Riesenrübe', 'Der Chronist',
];

/** what was found: the name on its own, in the accusative ("hat ... entdeckt"), and its story */
export const SECRET_KINDS_DE: Record<string, { name: string; akk: string; text: string }> = {
  ufo: { name: 'Eine fliegende Untertasse', akk: 'eine fliegende Untertasse', text: 'Eine stille silberne Untertasse schwebt tief über dem Gras und leuchtet. Niemand in der Chronik weiß, woher sie kam.' },
  meteor: { name: 'Ein gefallener Meteorit', akk: 'einen gefallenen Meteoriten', text: 'Ein Stein vom Himmel, noch warm. Das Gras um ihn herum ist versengt.' },
  eggs: { name: 'Ein Nest mit bemalten Eiern', akk: 'ein Nest mit bemalten Eiern', text: 'Jemand hat die Eier mit roten und blauen Mustern bemalt und in einem Nest versteckt. Ostern kam ein paar tausend Jahre zu früh.' },
  goldegg: { name: 'Ein goldenes Ei', akk: 'ein goldenes Ei', text: 'Ein Ei aus purem Gold auf einem Stein. Ab und zu bekommt es einen Riss, und drinnen glänzt etwas.' },
  robot: { name: 'Ein rostiger Roboter', akk: 'einen rostigen Roboter', text: 'Ein kleiner, von Moos überwachsener Roboter. Wenn man ihn ansieht, leuchten seine Augen auf, und er winkt.' },
  stag: { name: 'Ein Geisterhirsch', akk: 'einen Geisterhirsch', text: 'Ein weiß leuchtender Hirsch steht zwischen den Bäumen und zerfällt langsam in Funken.' },
  dragon: { name: 'Ein schlafender Drache', akk: 'einen schlafenden Drachen', text: 'Ein winziger grüner Drache schläft auf einem Haufen Goldmünzen. Eines seiner Augen öffnet sich.' },
  portal: { name: 'Ein Tor im Steinkreis', akk: 'ein Tor in einem Steinkreis', text: 'Blaues Licht dreht sich zwischen uralten Steinen. Wohin es führt, steht nirgends geschrieben.' },
};
