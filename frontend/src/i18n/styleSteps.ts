import type { FlourType, Method, OvenType, PizzaStyle } from '../calculator';
import type { Lang } from './translations';
import type { BaseTimer } from './prefermentSteps';

export type StylePhase = { title: string; steps: string[]; timers?: BaseTimer[] };
type RomanTray = false | { width: number; length: number; doughWeight: number };

const timer = (id: string, seconds: number, kind: BaseTimer['kind']): BaseTimer => ({ id, seconds, kind });

const direct = (mixing: 'hand' | 'mixer', style: 'romana' | 'ny_style', roomHours: number, fridgeHours: number, flour: FlourType, romanTray: RomanTray): StylePhase[] => {
  const isRoman = style === 'romana';
  const isNewYork = style === 'ny_style';
  const isManitoba = flour === 'manitoba';
  const isSpelt = flour === 'spelt';
  const isWholeWheat = flour === 'wholeWheat';
  const isGlutenFree = flour === 'glutenFree';
  const hand = mixing === 'hand';
  const tray = romanTray || { width: 30, length: 40, doughWeight: 475 };
  const isTray = romanTray !== false;
    return [
      {
        title: hand ? 'Faza A: Priprema i ručni zamjes' : 'Faza A: Priprema i zamjes mikserom',
        steps: hand ? [
          isGlutenFree ? 'U posudi otopite kvasac u 90% ukupne hladne vode.' : isRoman ? 'U posudi otopite kvasac u 90% ukupne predviđene vode.' : 'U posudi otopite kvasac i šećer u 90% ukupne predviđene vode.',
          'Postupno dodajte polovicu brašna i miješajte dok ne dobijete glatku smjesu bez grudica.',
          'Dodajte sol i dobro promiješajte kako sol ne bi došla u izravan kontakt s kvascem.',
          'Postupno dodajte preostalo brašno i ostatak vode te umijesite kompaktno tijesto.',
          isRoman ? 'Dodajte 20–30 g maslinovog ulja ili svinjske masti na 1 kg brašna direktno u zamjes.' : 'Dodajte 2–4% ulja ili maslaca na samom kraju, zajedno s preostalom soli i vodom.',
          isGlutenFree ? 'Bezglutensku smjesu miješajte rukom ili špatulom bez razvoja glutena; obavezno dodajte psyllium u količini od 2% brašna.' : isSpelt ? 'Mijesite vrlo nježno i kratko; pirovi proteini su krhki.' : isWholeWheat ? 'Mijesite kratko i nježno jer mekinje mogu oslabiti glutensku strukturu.' : isManitoba ? 'Mijesite snažno i dovoljno dugo da se razvije čvrsta glutenska opna.' : 'Prebacite tijesto na radnu površinu i mijesite dlanovima 10–15 minuta dok površina ne postane glatka.',
          'Pokrijte tijesto i ostavite ga 15 minuta da se gluten opusti.',
        ] : [
          isGlutenFree ? 'U posudu miksera stavite brašno i obaveznih 2% psylliuma, dodajte 90% hladne vode i kvasac.' : isRoman ? 'U posudu miksera stavite 85% vode i brašno.' : 'U posudu miksera stavite 85% vode, kvasac i šećer.',
          'Pokrenite mikser u prvoj brzini i dodajte preostalo brašno.',
          'Postupno dodajte preostalih 15% vode zajedno sa soli.',
          isRoman ? 'Ulje ili mast dodajte u zadnjoj minuti.' : 'U drugoj polovici mijesenja dodajte preostalu vodu, sol i ulje.',
          isGlutenFree ? 'Miješajte samo na najnižoj brzini dok se smjesa ne poveže; ne razvijajte gluten.' : isManitoba ? 'Mijesite snažno i dovoljno dugo da se razvije čvrsta glutenska opna.' : isSpelt || isWholeWheat ? 'Miješajte kratko i nježno kako se struktura ne bi oslabjela.' : 'Mijesite 8–10 minuta dok tijesto ne povuče ulje i ne postane sjajno i glatko.',
          `Ciljna temperatura tijesta: ${isRoman ? '21–23' : '21–23'}°C.`,
          'Ostavite tijesto 5 minuta u posudi miksera prije fermentacije.',
        ],
        timers: [timer(hand ? 'style-rest15m' : 'style-rest5m', (hand ? 15 : 5) * 60, 'rest')],
      },
    {
      title: 'Faza B: Prva fermentacija (Bulking)',
      steps: [
        fridgeHours > 0 ? `Ostavite tijesto 30–45 minuta na sobnoj temperaturi.` : `Ostavite tijesto ${roomHours} sati na sobnoj temperaturi prije oblikovanja kugli.`,
        isGlutenFree ? 'Ne radite Stretch & Fold; ostavite smjesu samo 15 minuta da se vezivo upije.' : isManitoba ? 'Napravite čvrste Stretch & Fold preklopa nakon 30 minuta kako bi se izgradila čvrsta glutenska opna.' : isSpelt || isWholeWheat ? 'Napravite jedno nježno preklapanje nakon 30 minuta; ne silite strukturu.' : hand ? 'Napravite jedno preklapanje nakon 30 minuta.' : 'Napravite jedno lagano oblikovanje ako je potrebno.',
        ...(fridgeHours > 0 ? [`Nakon toga oblikujte kugle i stavite ih u hladnjak na ${fridgeHours} sati pri 4°C.`] : []),
      ],
      timers: [
        timer('style-room-bulk', 30 * 60, 'rt'),
        ...(fridgeHours > 0 ? [timer('style-fridge-bulk', fridgeHours * 3600, 'fridge')] : []),
      ],
    },
    {
      title: 'Faza C: Podjela i oblikovanje loptica (Bulice)',
      steps: [
        isTray ? `Za tepsiju ${tray.width}×${tray.length} cm izvagajte ${tray.doughWeight} g tijesta.` : 'Nakon bulka oblikujte kugle.',
        !isTray ? (isRoman ? 'Napravite kugle od 200–220 g.' : isGlutenFree ? 'Oblikujte manje kugle nježno; NY format od 40 cm nije prikladan.' : isManitoba ? 'Napravite veće kugle od 350–450 g.' : isSpelt || isWholeWheat ? 'Napravite kugle od približno 350–400 g; ne planirajte rastezanje u zraku.' : 'Napravite kugle od 350–400 g.') : 'Ne oblikujte malu okruglu kuglu; komad tijesta je namijenjen cijeloj tepsiji.',
        isNewYork && isManitoba ? 'Za NY style koristite veću kuglu i održavajte kompaktnu sredinu apsolutno ravnomjerno.' : null,
        ...(fridgeHours > 0 ? [`Ostavite kugle 30–60 minuta na sobnoj temperaturi, zatim ih stavite u zatvorenu kutiju u hladnjak na ${fridgeHours} sati pri 4°C.`] : [`Ostavite kugle ${roomHours} sati na sobnoj temperaturi prije pečenja.`]),
      ].filter(Boolean) as string[],
      timers: fridgeHours > 0 ? [timer('style-balls-fridge', fridgeHours * 3600, 'ballsFridge')] : [timer('style-balls-room', roomHours * 3600, 'ballsRt')],
    },
    {
      title: 'Faza D: Priprema, razvlačenje i nadijevanje',
      steps: isTray
        ? ['Izvadite tijesto iz hladnjaka 30–45 minuta prije oblikovanja.', `Tepsiju ${tray.width}×${tray.length} cm obilno nauljite maslinovim uljem.`, 'Istresite tijesto u tepsiju i utiskujte ga prstima od sredine prema rubovima dok ne ispuni cijeli lim; ne rastežite ga u zraku.', 'Ostavite tijesto da se opusti ako se vraća, zatim ponovno utisnite rubove.', 'Dodajte nadjev ravnomjerno i pecite prema odabranoj pećnici.']
        : isRoman
          ? [`Izvadite loptice iz hladnjaka 15–20 minuta prije oblikovanja ili kada se približno udvostruče, ali pazite da ne predignu.`, 'Brzim i nježnim pokretom izvadite kuglu i stavite je na radnu površinu.', isSpelt ? 'Pirovo tijesto pažljivo utiskujte prstima; ne razvlačite ga agresivno.' : isWholeWheat ? 'Integralno tijesto nježno utiskujte prstima; baza će biti rustikalnija i manje prozračna.' : 'Bez rastezanja u zraku oblikujte ravnu Romanu pažljivim pritiskanjem prstima ili valjkom.', 'Nafilujte tanko i ravnomjerno kako bi sredina ostala hrskava.']
          : [`Izvadite loptice iz hladnjaka 15–20 minuta prije razvlačenja ili kada se približno udvostruče, ali pazite da ne predignu.`, 'Radnu površinu lagano pospite brašnom ili semolom.', isGlutenFree ? 'Bezglutensko tijesto oblikujte samo pritiskanjem prstima; NY format od 40 cm i rastezanje u zraku nisu prikladni.' : isSpelt ? 'Pirovo tijesto otvorite isključivo pritiskanjem prstima; ne radite knuckle stretch.' : isWholeWheat ? 'Integralno tijesto otvorite pritiskanjem prstima; ne radite klasično rastezanje u zraku jer baza ostaje gušća.' : isManitoba ? 'Nakon pritska dlanovima razvucite tijesto preko šaka (knuckle stretch) do tanke baze.' : 'Nakon pritiska dlanovima možete pažljivo razvlačiti tijesto u zraku do tanke baze.', 'Nafilujte ravnomjerno; za NY prvo stavite suhu ribanu mozzarellu, zatim gusti umak i dodatke.'],
      timers: [timer('style-shape-pre-bake', 15 * 60, 'preBake')],
    },
  ];
};

const preferment = (method: 'biga' | 'poolish', mixing: 'hand' | 'mixer', style: 'romana' | 'ny_style', roomHours: number, fridgeHours: number, flour: FlourType, romanTray: RomanTray): StylePhase[] => {
  const isRoman = style === 'romana';
  const isNewYork = style === 'ny_style';
  const isBiga = method === 'biga';
  const hand = mixing === 'hand';
  const isManitoba = flour === 'manitoba';
  const isSpelt = flour === 'spelt';
  const isWholeWheat = flour === 'wholeWheat';
  const isGlutenFree = flour === 'glutenFree';
  const tray = romanTray || { width: 30, length: 40, doughWeight: 475 };
  const isTray = romanTray !== false;
  const p1Timers = isBiga
    ? [timer('style-biga-room', 8 * 3600, 'rt'), timer('style-biga-fridge', 16 * 3600, 'fridge')]
    : [
        ...(roomHours > 0 ? [timer('style-poolish-room', roomHours * 3600, 'rt')] : []),
        ...(fridgeHours > 0 ? [timer('style-poolish-fridge', fridgeHours * 3600, 'fridge')] : []),
      ];
    return [
      {
        title: isBiga ? 'Faza A: Izrada Bige' : 'Faza A: Izrada Poolisha',
        steps: isBiga
          ? [
              'U posudu stavite brašno i ravnomjerno izmrvite kvasac.',
              'Ulijte izračunatu hladnu vodu i rukama kratko pomiješajte sastojke.',
              'Ne mijesite glatko tijesto; smjesa treba ostati gruba i mrvičasta.',
              'Pokrijte posudu i ostavite bigu 8 sati na sobnoj temperaturi.',
              'Prebacite bigu u hladnjak na još 16 sati pri 4°C.',
            ]
          : [
              'U posudi otopite kvasac u izračunatoj vodi za Poolish.',
              'Dodajte brašno za Poolish i promiješajte pjenjačom ili vilicom do glatke tekuće smjese.',
              `Pokrijte posudu i ostavite Poolish ${roomHours} ${roomHours === 1 ? 'sat' : 'sati'} na sobnoj temperaturi.`,
              ...(fridgeHours > 0 ? [`Prebacite Poolish u hladnjak na ${fridgeHours} sati.`] : []),
            ],
        timers: p1Timers,
      },
    {
      title: isBiga
        ? `Faza B: Dodavanje Bige i ${hand ? 'ručni zamjes' : 'zamjes mikserom'}`
        : `Faza B: Dodavanje Poolisha i ${hand ? 'ručni zamjes' : 'zamjes mikserom'}`,
      steps: [
        isBiga ? 'Bigu natrgajte na komade i dodajte preostalu vodu.' : 'Poolish prebacite u posudu za zamjes i dodajte preostalo brašno.',
        isBiga ? 'Dodajte preostalu vodu, sol i maslinovo ulje.' : `Dodajte ${isRoman ? 'brašno, sol i maslinovo ulje' : 'brašno, šećer, sol i maslinovo ulje'} postupno.`,
        isGlutenFree
          ? 'Bezglutensku smjesu miješajte špatulom ili na najnižoj brzini samo dok se ne poveže; ne razvijajte gluten.'
          : isManitoba
            ? `${hand ? 'Ručno mijesite snažno i dovoljno dugo' : 'Mijesite snažno i dovoljno dugo u mikseru'} da se razvije čvrsta glutenska opna; ulje dodajte na kraju.`
            : isSpelt || isWholeWheat
              ? `${hand ? 'Ručno mijesite kratko i nježno' : 'Miješajte kratko i nježno u mikseru'}; ulje dodajte na kraju i ne opterećujte strukturu.`
              : `${hand ? 'Ručno mijesite 12–14 minuta' : 'Mijesite u mikseru 7–9 minuta'}; ulje dodajte na kraju i ciljajte temperaturu tijesta 21–23°C.`,
      ],
    },
    {
      title: 'Faza C: Podjela i oblikovanje loptica (Bulice)',
      steps: [
        fridgeHours > 0 ? 'Ostavite tijesto 30–45 minuta na sobnoj temperaturi.' : `Ostavite tijesto ${roomHours} sati na sobnoj temperaturi prije oblikovanja kugli.`,
        isGlutenFree ? 'Ne radite Stretch & Fold; ostavite smjesu samo 15 minuta da se veže.' : isManitoba ? 'Napravite čvrste Stretch & Fold preklopa kako bi tijesto držalo visoku hidrataciju.' : isSpelt || isWholeWheat ? 'Napravite jedno nježno preklapanje; ne trgajte strukturu.' : hand ? 'Napravite jedno preklapanje na polovici bulka.' : 'Preklapanje nije potrebno, osim ako tijesto traži dodatnu strukturu.',
        isTray ? `Za tepsiju ${tray.width}×${tray.length} cm izvagajte ${tray.doughWeight} g tijesta.` : 'Nakon bulka oblikujte kugle.',
        isTray ? 'Ne oblikujte malu okruglu kuglu; komad tijesta je namijenjen cijeloj tepsiji.' : isRoman ? 'Kugle neka budu 200–220 g.' : isGlutenFree ? 'Oblikujte manje kugle nježno; NY format od 40 cm nije prikladan.' : isManitoba ? 'Kugle neka budu 350–450 g.' : isSpelt || isWholeWheat ? 'Kugle neka budu približno 350–400 g; ne planirajte rastezanje u zraku.' : 'Kugle neka budu 350–400 g.',
        ...(fridgeHours > 0 ? [`Ostavite kugle 30–60 minuta na sobnoj temperaturi, zatim ih stavite u hladnjak na ${fridgeHours} sati.`] : [`Ostavite kugle ${roomHours} sati na sobnoj temperaturi prije pečenja.`]),
      ].filter(Boolean) as string[],
      timers: [timer('style-preferment-bulk', 30 * 60, 'rt'), ...(fridgeHours > 0 ? [timer('style-preferment-fridge', fridgeHours * 3600, 'ballsFridge')] : [timer('style-preferment-room', roomHours * 3600, 'ballsRt')])],
    },
    {
      title: 'Faza D: Priprema, razvlačenje i nadijevanje',
      steps: isTray
        ? ['Izvadite tijesto 30–45 minuta prije oblikovanja.', `Tepsiju ${tray.width}×${tray.length} cm obilno nauljite.`, 'Istresite tijesto u tepsiju i utiskujte ga prstima od sredine prema rubovima bez rastezanja u zraku.', 'Dodajte nadjev ravnomjerno i pecite prema odabranoj pećnici.']
        : isRoman
          ? [`Izvadite loptice iz hladnjaka 15–20 minuta prije razvlačenja ili kada se približno udvostruče, ali pazite da ne predignu.`, 'Brzim i nježnim pokretom izvadite kuglu iz posude i stavite je naopako na semolu.', isSpelt ? 'Pirovo tijesto pažljivo utiskujte prstima; ne razvlačite ga agresivno.' : isWholeWheat ? 'Integralno tijesto nježno utiskujte prstima; baza će biti rustikalnija i manje prozračna.' : 'Radnu površinu pospite semolom i bez rastezanja u zraku oblikujte ravnu Romanu pažljivim pritiskanjem prstima ili valjkom.', 'Nafilujte tanko i ravnomjerno te pecite odmah.']
          : [`Izvadite loptice iz hladnjaka 15–20 minuta prije razvlačenja ili kada se približno udvostruče, ali pazite da ne predignu.`, 'Prstima istisnite zrak prema rubu i ostavite tanak centar s izraženim, mekanim rubom.', isGlutenFree ? 'Bezglutensko tijesto oblikujte samo pritiskanjem prstima; NY format od 40 cm i rastezanje u zraku nisu prikladni.' : isSpelt ? 'Pirovo tijesto otvorite isključivo pritiskanjem prstima; ne radite knuckle stretch.' : isWholeWheat ? 'Integralno tijesto otvorite pritiskanjem prstima; ne radite klasično rastezanje u zraku jer baza ostaje gušća.' : isManitoba ? 'Nakon pritiska dlanovima razvucite tijesto preko šaka (knuckle stretch) do tanke baze.' : 'Nakon pritiska dlanovima možete pažljivo razvlačiti tijesto u zraku do tanke baze.', 'Nafilujte ravnomjerno i ne preopterećujte sredinu; za NY prvo stavite suhu ribanu mozzarellu, zatim gusti umak i dodatke.'],
      timers: [timer('style-preferment-pre-bake', 15 * 60, 'preBake')],
    },
  ];
};

export function getStyleSteps(style: PizzaStyle, method: Method, mixing: 'hand' | 'mixer', roomHours: number, fridgeHours: number, lang: Lang, flour: FlourType, romanTray: RomanTray = false): StylePhase[] | null {
  if (lang !== 'hr') return null;
  if (style === 'neapolitan') return null;
  const actualMixing = mixing === 'hand' ? 'hand' : 'mixer';
  const instructionFlour = flour === 'custom' ? 'caputo00' : flour;
  if (method === 'direct') return direct(actualMixing, style, roomHours, fridgeHours, instructionFlour, romanTray);
  return preferment(method, actualMixing, style, roomHours, fridgeHours, instructionFlour, romanTray);
}
const baking = (style: 'romana' | 'ny_style', oven: OvenType): string[] => {
  const isRoman = style === 'romana';
  if (oven === 'ooni') {
    return isRoman
      ? ['Zagrijte peć na 350–400°C oko 20 minuta.', 'Pecite 2–3 minute na sredini kamena i okrećite svakih 30 sekundi.', 'Pizza treba biti ravna, zlatna i izrazito hrskava.']
      : ['Zagrijte peć na 320–350°C oko 20 minuta.', 'Smanjite plamen i pecite 3–4 minute, okrećući nakon 90 sekundi.', 'Rub treba biti mekan i obojen, a sredina savitljiva.'];
  }
  if (oven === 'homeStone') {
    return isRoman
      ? ['Postavite kamen ili čelik dvije rešetke ispod gornjeg grijača i zagrijte ga 45 minuta na 270–300°C.', 'Isključite grill i prebacite pećnicu na Pizza program, ako je dostupan. Ako Pizza program nije dostupan, odaberite gornji i donji grijač bez ventilatora te postavite maksimalnu temperaturu. Pecite pizzu približno 4–5 minuta.', 'Zatim uključite grill i pecite dok rub i vrh ne dobiju željenu boju. Pizza treba biti tanka, čvrsta i hrskava cijelom površinom.']
      : ['Postavite kamen ili čelik dvije rešetke ispod gornjeg grijača. Zagrijte ga 50 minuta na 250–280°C.', 'Pecite 5–7 minuta i uključite grill zadnje 2 minute.', 'Rub treba biti zlatan i mekan, a centar tanak i čvrst.'];
  }
  return isRoman
    ? ['Zagrijte obrnuti lim 30 minuta na 250°C.', 'Pecite 6–8 minuta i uključite grill zadnje 2 minute.', 'Pizza treba biti ravna, suha i krekerski hrskava.']
    : ['Zagrijte lim 35 minuta na 250°C.', 'Pecite 7–9 minuta i uključite grill zadnje 2 minute.', 'Koristite papir za pečenje; rub treba biti zlatan, a dno ravnomjerno pečeno.'];
};

export function getStyleBakingSteps(style: PizzaStyle, oven: OvenType, lang: Lang): string[] | null {
  if (lang !== 'hr') return null;
  return style === 'neapolitan' ? null : baking(style, oven);
}

export function getStyleBakingTemp(style: PizzaStyle, oven: OvenType, lang: Lang): string | null {
  if (lang !== 'hr' || style === 'neapolitan') return null;
  if (style === 'romana') {
    return oven === 'ooni' ? '350–400°C · 2–3 min' : oven === 'homeStone' ? '270–300°C · 4–5 min' : '250°C · 6–8 min';
  }
  return oven === 'ooni' ? '320–350°C · 3–4 min' : oven === 'homeStone' ? '250–280°C · 5–7 min' : '250°C · 7–9 min';
}

