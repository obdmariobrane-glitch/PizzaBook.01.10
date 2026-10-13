// Detailed BIGA and POOLISH step-by-step recipes, per language and per mixing method.
// P1 = Preferment build, P2 = Final mix (hand OR mixer), P3 = Rest / Balling / Baking.
import type { Lang } from './translations';
import type { PreferredYeastType } from '../preferences';
import { getSpiralMixingSteps, getSpiralMixingTitle } from './spiralMixing';

export type Phase = { title: string; steps: string[] };
export type Path = { p1: Phase; p2: Phase; p3: Phase };
export type MethodSteps = { hand: Path; mixer: Path };

// ============================ HR ============================
const HR_BIGA_P1: Phase = {
  title: 'Faza A: Izrada Bige',
  steps: [
    'U posudu stavite brašno i po njemu ravnomjerno izmrvite kvasac.',
    'Ulijte izračunatu hladnu vodu.',
    'Rukama samo ukratko pomiješajte sastojke bez miješenja glatkog tijesta (cilj je samo da brašno popije vodu i ostane mrvičasto).',
    'Nježno pritisnite smjesu rukom, pokrijte posudu i ostavite 8 sati na sobnoj temperaturi.',
    'Prebacite posudu u hladnjak na 16 sati (na 4–6°C).',
  ],
};
const HR_BIGA_HAND_P2: Phase = {
  title: 'Faza B: Završni zamjes (Ručno)',
  steps: [
    'Bigu izrežite nožem ili natrgajte rukama na manje komade direktno u posudu za ručni zamjes.',
    'Dodajte preostali kvasac i ulijte veći dio hladne vode.',
    'Prstima i šakama pritišćite komade Bige u vodi dok se ne omekšaju i ne počnu povezivati u smjesu.',
    'Kako tijesto upija, polako u mlazevima dolijevajte ostatak vode i mijesite.',
    'Kad ostane malo vode, ubacite sol, prelijte je s tom zadnjom vodom i nastavite energično mijesiti.',
    'Na samom kraju ulijte maslinovo ulje i mijesite dok ga tijesto potpuno ne upije i ne postane glatko.',
  ],
};
const HR_BIGA_MIXER_P2: Phase = {
  title: 'Faza B: Završni zamjes (Mikser)',
  steps: [
    'Bigu izrežite nožem na manje komade i ubacite u posudu miksera.',
    'Dodajte preostali kvasac i ulijte veći dio hladne vode (s ledom). Pokrenite mikser u 1. brzini.',
    'Kako tijesto upija, polako u mlazevima dolijevajte ostatak vode.',
    'Kad ostane malo vode, ubacite sol, prelijte zadnjom vodom i prebacite mikser u 2. brzinu.',
    'Ulijte maslinovo ulje i ugasite mikser čim ga tijesto potpuno upije.',
  ],
};
const HR_BIGA_P3: Phase = {
  title: 'Faza C: Odmor, loptice i pečenje',
  steps: [
    'Ostavite tijesto da odmori u posudi 6–7 minuta.',
    'Prebacite ga u nauljenu posudu, pokrijte i ostavite 30 minuta na sobnoj temperaturi.',
    'Preklopite tijesto par puta rukama (stretch & fold), pokrijte i ostavite 30 minuta na sobnoj temperaturi.',
    'Oblikujte čvrste loptice (bulice) od 260–300 g.',
    'Ostavite loptice 30–60 minuta na sobnoj temperaturi, pa ih spremite u hladnjak na odabrano vrijeme.',
    'Izvadite loptice 15–20 minuta prije razvlačenja ili kada se približno udvostruče, razvucite na semoli, nadjenite i pecite.',
  ],
};

const HR_POOLISH_P1: Phase = {
  title: 'Faza A: Izrada Poolisha',
  steps: [
    'U posudi otopite kvasac u izračunatoj vodi za Poolish.',
    'Dodajte brašno za Poolish i dobro pomiješajte pjenjačom ili vilicom dok ne dobijete glatku tekuću smjesu.',
    'Pokrijte posudu i ostavite Poolish da se odmori.',
    'Ostavite Poolish 1 sat na sobnoj temperaturi.',
    'Prebacite Poolish u hladnjak na 16 do 24 sata.',
  ],
};
const HR_POOLISH_HAND_P2: Phase = {
  title: 'Faza B: Dodavanje Poolisha i ručni zamjes',
  steps: [
    'Zreli Poolish prelijte u posudu za miješenje.',
    'Dodajte preostalo brašno i veći dio vode.',
    'Rukama ili kuhačom povežite Poolish s brašnom dok ne dobijete grubu smjesu.',
    'Polako dolijevajte ostatak vode i nastavite mijesiti dok se tijesto ne poveže.',
    'Dodajte sol kao zaseban korak i nastavite mijesiti dok se potpuno ne upije.',
    'Ulijte maslinovo ulje i mijesite rukama dok ga tijesto ne upije i ne postane svilenkasto.',
  ],
};
const HR_POOLISH_MIXER_P2: Phase = {
  title: 'Faza B: Dodavanje Poolisha i zamjes mikserom',
  steps: [
    'Zreli Poolish prelijte izravno u posudu miksera.',
    'Dodajte preostalo brašno i veći dio vode te pokrenite mikser u 1. brzini.',
    'Ubacite sol i polako u tankom mlazu dolijevajte ostatak vode dok mikser radi.',
    'Ulijte maslinovo ulje i mijesite dok tijesto u potpunosti ne upije ulje i ne postane glatko.',
  ],
};
const HR_POOLISH_P3: Phase = {
  title: 'Faza C: Odmor i bulk fermentacija',
  steps: [
    'Ostavite tijesto da odmori u posudi 6–7 minuta.',
    'Prebacite ga u nauljenu posudu, pokrijte i ostavite 30 minuta na sobnoj temperaturi.',
    'Napravite jedno preklapanje rukama (stretch & fold), pokrijte i ostavite još 30 minuta.',
    'Oblikujte tijesto u glatku kuglu i pripremite ga za podjelu.',
    'Podijelite tijesto i oblikujte glatke loptice od 260–280 g.',
    'Ostavite loptice da se opuste prije razvlačenja, zatim ih razvucite, nadjenite i pecite.',
  ],
};

// ============================ EN ============================
const EN_BIGA_P1: Phase = {
  title: 'Phase A: Making the Biga',
  steps: [
    'Place the flour in a bowl and evenly crumble the yeast over it.',
    'Pour in the calculated cold water.',
    'Briefly combine the ingredients by hand without kneading a smooth dough (the goal is just for the flour to absorb the water and stay crumbly).',
    'Gently press the mixture with your hand, cover the bowl and leave for 8 hours at room temperature.',
    'Move the bowl to the fridge for 16 hours (at 4–6°C).',
  ],
};
const EN_BIGA_HAND_P2: Phase = {
  title: 'Phase B: Final mix (Hand)',
  steps: [
    'Cut the Biga with a knife or tear it by hand into smaller pieces, directly into the mixing bowl.',
    'Add the remaining yeast and pour in most of the cold water.',
    'Press the Biga pieces in the water with your fingers and fists until they soften and start to bind into a mass.',
    'As the dough absorbs, slowly stream in the remaining water and knead.',
    'When only a little water is left, add the salt, pour it in with that last water and continue kneading energetically.',
    'At the very end, pour in the olive oil and knead until the dough fully absorbs it and becomes smooth.',
  ],
};
const EN_BIGA_MIXER_P2: Phase = {
  title: 'Phase B: Final mix (Mixer)',
  steps: [
    'Cut the Biga with a knife into smaller pieces and place them into the mixer bowl.',
    'Add the remaining yeast and pour in most of the cold water (with ice). Start the mixer on speed 1.',
    'As the dough absorbs, slowly stream in the remaining water.',
    'When only a little water is left, add the salt, pour it in with the last water and switch the mixer to speed 2.',
    'Pour in the olive oil and stop the mixer as soon as the dough fully absorbs it.',
  ],
};
const EN_BIGA_P3: Phase = {
  title: 'Phase C: Rest, balling and baking',
  steps: [
    'Let the dough rest in the bowl for 6–7 minutes.',
    'Transfer it to an oiled bowl, cover and leave for 30 minutes at room temperature.',
    'Fold the dough a few times by hand (stretch & fold), cover and place in the fridge for 60 to 90 minutes.',
    'Shape firm dough balls of 260–300 g.',
    'Leave the balls for 15 minutes at room temp, then place them in the fridge for another 5 to 6 hours.',
    'Take the balls out 10–15 minutes before baking, stretch on semolina, top and bake at the highest temperature.',
  ],
};

const EN_POOLISH_P1: Phase = {
  title: 'Phase A: Making the Poolish',
  steps: [
    'In a bowl, dissolve the yeast in the calculated water for Poolish.',
    'Add the flour for Poolish and mix well with a whisk or fork until you get a smooth, liquid mixture.',
    'Cover the bowl and let the Poolish rest.',
    'Leave the Poolish for 1 hour at room temperature.',
    'Move the Poolish to the fridge for 16 to 24 hours.',
  ],
};
const EN_POOLISH_HAND_P2: Phase = {
  title: 'Phase B: Adding the Poolish and hand mixing',
  steps: [
    'Pour the cold Poolish into the mixing bowl.',
    'Add the remaining flour and most of the water.',
    'Combine the Poolish and flour with a spoon or your hands until you have a rough mixture.',
    'Slowly add the remaining water and knead until the dough comes together.',
    'Add the salt separately and continue kneading until it is fully absorbed.',
    'Pour in the olive oil and knead by hand until the dough absorbs it and becomes silky.',
  ],
};
const EN_POOLISH_MIXER_P2: Phase = {
  title: 'Phase B: Adding the Poolish and mixer mixing',
  steps: [
    'Pour the cold Poolish directly into the mixer bowl.',
    'Add the remaining flour and most of the water, and start the mixer on speed 1.',
    'Add the salt and slowly, in a thin stream, pour in the remaining water while the mixer runs.',
    'Pour in the olive oil and knead until the dough fully absorbs the oil and becomes smooth.',
  ],
};
const EN_POOLISH_P3: Phase = {
  title: 'Phase C: Rest and bulk fermentation',
  steps: [
    'Let the dough rest in the bowl for 6–7 minutes.',
    'Transfer it to an oiled bowl, cover and leave for 30 minutes at room temperature.',
    'Do one stretch & fold by hand, cover and leave for another 30 minutes.',
    'Shape the dough into a smooth ball and prepare it for dividing.',
    'Divide the dough and shape smooth balls of 260–280 g.',
    'Let the balls relax before stretching, then stretch on semolina, top and bake.',
  ],
};

// ============================ DE ============================
const DE_BIGA_P1: Phase = {
  title: 'Phase A: Herstellung der Biga',
  steps: [
    'Geben Sie das Mehl in eine Schüssel und zerbröseln Sie die Hefe gleichmäßig darüber.',
    'Gießen Sie das berechnete kalte Wasser hinein.',
    'Vermengen Sie die Zutaten mit den Händen nur kurz, ohne einen glatten Teig zu kneten (Ziel ist, dass das Mehl das Wasser aufnimmt und krümelig bleibt).',
    'Drücken Sie die Masse sanft mit der Hand an, decken Sie die Schüssel ab und lassen Sie sie 8 Stunden bei Raumtemperatur ruhen.',
    'Stellen Sie die Schüssel für 16 Stunden in den Kühlschrank (bei 4–6°C).',
  ],
};
const DE_BIGA_HAND_P2: Phase = {
  title: 'Phase B: Endkneten (Hand)',
  steps: [
    'Schneiden Sie die Biga mit einem Messer oder reißen Sie sie mit den Händen in kleinere Stücke direkt in die Knetschüssel.',
    'Fügen Sie die restliche Hefe hinzu und gießen Sie den Großteil des kalten Wassers ein.',
    'Drücken Sie die Biga-Stücke mit Fingern und Fäusten im Wasser, bis sie weich werden und sich zu einer Masse verbinden.',
    'Während der Teig aufnimmt, gießen Sie langsam in Strömen das restliche Wasser ein und kneten weiter.',
    'Wenn nur noch wenig Wasser übrig ist, geben Sie das Salz dazu, übergießen Sie es mit dem letzten Wasser und kneten Sie kräftig weiter.',
    'Zum Schluss gießen Sie das Olivenöl ein und kneten, bis der Teig es vollständig aufnimmt und glatt wird.',
  ],
};
const DE_BIGA_MIXER_P2: Phase = {
  title: 'Phase B: Endkneten (Küchenmaschine)',
  steps: [
    'Schneiden Sie die Biga mit einem Messer in kleinere Stücke und geben Sie sie in die Mixerschüssel.',
    'Fügen Sie die restliche Hefe hinzu und gießen Sie den Großteil des kalten Wassers ein (mit Eis). Starten Sie den Mixer auf Stufe 1.',
    'Während der Teig aufnimmt, gießen Sie langsam in Strömen das restliche Wasser ein.',
    'Wenn nur noch wenig Wasser übrig ist, geben Sie das Salz dazu, übergießen Sie es mit dem letzten Wasser und schalten Sie den Mixer auf Stufe 2.',
    'Gießen Sie das Olivenöl ein und stoppen Sie den Mixer, sobald der Teig es vollständig aufgenommen hat.',
  ],
};
const DE_BIGA_P3: Phase = {
  title: 'Phase C: Ruhen, Teiglinge und Backen',
  steps: [
    'Lassen Sie den Teig 6–7 Minuten in der Schüssel ruhen.',
    'Geben Sie ihn in eine geölte Schüssel, decken Sie ab und lassen Sie ihn 30 Minuten bei Raumtemperatur ruhen.',
    'Falten Sie den Teig einige Male mit den Händen (Stretch & Fold), decken Sie ab und stellen Sie ihn für 60 bis 90 Minuten in den Kühlschrank.',
    'Formen Sie feste Teiglinge zu je 260–300 g.',
    'Lassen Sie die Teiglinge 15 Minuten bei Raumtemp., dann für weitere 5 bis 6 Stunden in den Kühlschrank.',
    'Nehmen Sie die Teiglinge 10–15 Minuten vor dem Backen heraus, ziehen Sie sie auf Semola aus, belegen und backen Sie bei höchster Temperatur.',
  ],
};

const DE_POOLISH_P1: Phase = {
  title: 'Phase A: Herstellung des Poolish',
  steps: [
    'In einer Schüssel die Hefe im berechneten Wasser für Poolish auflösen.',
    'Das Mehl für Poolish hinzufügen und mit einem Schneebesen oder einer Gabel gut vermischen, bis eine glatte, flüssige Masse entsteht.',
    'Die Schüssel abdecken und den Poolish ruhen lassen.',
    'Den Poolish 1 Stunde bei Raumtemperatur stehen lassen.',
    'Den Poolish für 16 bis 24 Stunden in den Kühlschrank stellen.',
  ],
};
const DE_POOLISH_HAND_P2: Phase = {
  title: 'Phase B: Poolish hinzufügen und von Hand kneten',
  steps: [
    'Den kalten Poolish in die Knetschüssel gießen.',
    'Das restliche Mehl und den Großteil des Wassers hinzufügen.',
    'Poolish und Mehl mit einem Löffel oder den Händen zu einer groben Masse verbinden.',
    'Das restliche Wasser langsam hinzufügen und kneten, bis der Teig zusammenkommt.',
    'Das Salz separat hinzufügen und weiterkneten, bis es vollständig aufgenommen ist.',
    'Das Olivenöl einfüllen und mit den Händen kneten, bis der Teig es aufgenommen hat und seidig wird.',
  ],
};
const DE_POOLISH_MIXER_P2: Phase = {
  title: 'Phase B: Poolish hinzufügen und mit der Maschine kneten',
  steps: [
    'Den kalten Poolish direkt in die Mixerschüssel gießen.',
    'Das restliche Mehl und den Großteil des Wassers hinzufügen und den Mixer auf Stufe 1 starten.',
    'Das Salz hinzufügen und langsam in einem dünnen Strahl das restliche Wasser einlaufen lassen, während der Mixer läuft.',
    'Das Olivenöl einfüllen und kneten, bis der Teig das Öl vollständig aufgenommen hat und glatt wird.',
  ],
};
const DE_POOLISH_P3: Phase = {
  title: 'Phase C: Ruhe und Stockgare',
  steps: [
    'Den Teig 6–7 Minuten in der Schüssel ruhen lassen.',
    'In eine geölte Schüssel geben, abdecken und 30 Minuten bei Raumtemperatur ruhen lassen.',
    'Ein Stretch & Fold von Hand machen, abdecken und weitere 30 Minuten ruhen lassen.',
    'Den Teig zu einer glatten Kugel formen und zum Teilen vorbereiten.',
    'Den Teig teilen und glatte Kugeln zu je 260–280 g formen.',
    'Die Kugeln entspannen lassen, dann auf Semola ausziehen, belegen und backen.',
  ],
};

// ============================ SL ============================
const SL_BIGA_P1: Phase = {
  title: 'Faza A: Priprava Bige',
  steps: [
    'V posodo stresite moko in po njej enakomerno zdrobite kvas.',
    'Vlijte izračunano hladno vodo.',
    'Z rokami sestavine na hitro premešajte, brez gnetenja gladkega testa (cilj je le, da moka vsrka vodo in ostane drobtinasta).',
    'Nežno pritisnite zmes z roko, pokrijte posodo in pustite 8 ur pri sobni temperaturi.',
    'Prestavite posodo v hladilnik za 16 ur (pri 4–6°C).',
  ],
};
const SL_BIGA_HAND_P2: Phase = {
  title: 'Faza B: Končno gnetenje (Ročno)',
  steps: [
    'Bigo z nožem razrežite ali z rokami raztrgajte na manjše kose neposredno v posodo za ročno gnetenje.',
    'Dodajte preostali kvas in vlijte večji del hladne vode.',
    'S prsti in pestmi stiskajte kose Bige v vodi, dokler ne omehčajo in se ne začnejo povezovati v zmes.',
    'Ko testo vpija, počasi v curkih dolivajte preostalo vodo in gnetite.',
    'Ko ostane malo vode, dodajte sol, prelijte z zadnjo vodo in nadaljujte z močnim gnetenjem.',
    'Na koncu vlijte oljčno olje in gnetite, dokler ga testo ne vpije popolnoma in postane gladko.',
  ],
};
const SL_BIGA_MIXER_P2: Phase = {
  title: 'Faza B: Končno gnetenje (Mešalnik)',
  steps: [
    'Bigo z nožem razrežite na manjše kose in jih dajte v posodo mešalnika.',
    'Dodajte preostali kvas in vlijte večji del hladne vode (z ledom). Zaženite mešalnik pri 1. hitrosti.',
    'Ko testo vpija, počasi v curkih dolivajte preostalo vodo.',
    'Ko ostane malo vode, dodajte sol, prelijte z zadnjo vodo in preklopite mešalnik na 2. hitrost.',
    'Vlijte oljčno olje in ustavite mešalnik, ko ga testo popolnoma vpije.',
  ],
};
const SL_BIGA_P3: Phase = {
  title: 'Faza C: Počitek, kepice in peka',
  steps: [
    'Pustite testo počivati v posodi 6–7 minut.',
    'Prestavite ga v naoljeno posodo, pokrijte in pustite 30 minut pri sobni temperaturi.',
    'Testo nekajkrat prepognite z rokami (stretch & fold), pokrijte in postavite v hladilnik za 60 do 90 minut.',
    'Oblikujte čvrste kepice po 260–300 g.',
    'Kepice pustite 15 minut pri sobni temp., nato pa jih spravite v hladilnik za še 5 do 6 ur.',
    'Vzemite kepice 10–15 minut pred peko, raztegnite na zdrobu, obložite in pecite pri najvišji temperaturi.',
  ],
};

const SL_POOLISH_P1: Phase = {
  title: 'Faza A: Priprava Poolisha',
  steps: [
    'V posodi raztopite kvas v izračunani vodi za Poolish.',
    'Dodajte moko za Poolish in dobro premešajte z metlico ali vilicami, da dobite gladko tekočo zmes.',
    'Pokrijte posodo in pustite Poolish počivati.',
    'Poolish pustite 1 uro pri sobni temperaturi.',
    'Poolish prestavite v hladilnik za 16 do 24 ur.',
  ],
};
const SL_POOLISH_HAND_P2: Phase = {
  title: 'Faza B: Dodajanje Poolisha in ročno gnetenje',
  steps: [
    'Hladni Poolish prelijte v posodo za gnetenje.',
    'Dodajte preostalo moko in večji del vode.',
    'Poolish in moko z zajemalko ali rokami povežite v grobo zmes.',
    'Počasi dodajajte preostalo vodo in gnetite, dokler se testo ne poveže.',
    'Sol dodajte ločeno in nadaljujte z gnetenjem, dokler se popolnoma ne vpije.',
    'Vlijte oljčno olje in z rokami gnetite, dokler ga testo ne vpije in ne postane svilnato.',
  ],
};
const SL_POOLISH_MIXER_P2: Phase = {
  title: 'Faza B: Dodajanje Poolisha in gnetenje z mešalnikom',
  steps: [
    'Hladni Poolish prelijte neposredno v posodo mešalnika.',
    'Dodajte preostalo moko in večji del vode ter zaženite mešalnik pri 1. hitrosti.',
    'Dodajte sol in počasi v tankem curku dolivajte preostalo vodo, medtem ko mešalnik dela.',
    'Vlijte oljčno olje in gnetite, dokler testo popolnoma ne vpije olja in ne postane gladko.',
  ],
};
const SL_POOLISH_P3: Phase = {
  title: 'Faza C: Počitek in prva fermentacija',
  steps: [
    'Testo pustite počivati v posodi 6–7 minut.',
    'Prestavite ga v naoljeno posodo, pokrijte in pustite 30 minut pri sobni temperaturi.',
    'Naredite en stretch & fold z rokami, pokrijte in pustite še 30 minut.',
    'Testo oblikujte v gladko kepo in ga pripravite za delitev.',
    'Testo razdelite in oblikujte gladke kepice po 260–280 g.',
    'Kepice pustite počivati, nato jih raztegnite na zdrobu, obložite in specite.',
  ],
};

// ============================ PACKS ============================
export const BIGA_STEPS: Record<Lang, MethodSteps> = {
  hr: {
    hand:  { p1: HR_BIGA_P1, p2: HR_BIGA_HAND_P2,  p3: HR_BIGA_P3 },
    mixer: { p1: HR_BIGA_P1, p2: HR_BIGA_MIXER_P2, p3: HR_BIGA_P3 },
  },
  en: {
    hand:  { p1: EN_BIGA_P1, p2: EN_BIGA_HAND_P2,  p3: EN_BIGA_P3 },
    mixer: { p1: EN_BIGA_P1, p2: EN_BIGA_MIXER_P2, p3: EN_BIGA_P3 },
  },
  de: {
    hand:  { p1: DE_BIGA_P1, p2: DE_BIGA_HAND_P2,  p3: DE_BIGA_P3 },
    mixer: { p1: DE_BIGA_P1, p2: DE_BIGA_MIXER_P2, p3: DE_BIGA_P3 },
  },
  sl: {
    hand:  { p1: SL_BIGA_P1, p2: SL_BIGA_HAND_P2,  p3: SL_BIGA_P3 },
    mixer: { p1: SL_BIGA_P1, p2: SL_BIGA_MIXER_P2, p3: SL_BIGA_P3 },
  },
};

export const POOLISH_STEPS: Record<Lang, MethodSteps> = {
  hr: {
    hand:  { p1: HR_POOLISH_P1, p2: HR_POOLISH_HAND_P2,  p3: HR_POOLISH_P3 },
    mixer: { p1: HR_POOLISH_P1, p2: HR_POOLISH_MIXER_P2, p3: HR_POOLISH_P3 },
  },
  en: {
    hand:  { p1: EN_POOLISH_P1, p2: EN_POOLISH_HAND_P2,  p3: EN_POOLISH_P3 },
    mixer: { p1: EN_POOLISH_P1, p2: EN_POOLISH_MIXER_P2, p3: EN_POOLISH_P3 },
  },
  de: {
    hand:  { p1: DE_POOLISH_P1, p2: DE_POOLISH_HAND_P2,  p3: DE_POOLISH_P3 },
    mixer: { p1: DE_POOLISH_P1, p2: DE_POOLISH_MIXER_P2, p3: DE_POOLISH_P3 },
  },
  sl: {
    hand:  { p1: SL_POOLISH_P1, p2: SL_POOLISH_HAND_P2,  p3: SL_POOLISH_P3 },
    mixer: { p1: SL_POOLISH_P1, p2: SL_POOLISH_MIXER_P2, p3: SL_POOLISH_P3 },
  },
};

const TEGLIA_P3: Record<Lang, Phase> = {
  hr: {
    title: 'Faza C: Podjela, završno dizanje i pečenje',
    steps: [
      'Tijesto tijekom preostale fermentacije drži pokriveno kao jednu masu; nemoj oblikovati kugle.',
      'Naulji plehove prema izračunatom broju i dimenzijama. Tijesto podijeli na izračunatu masu po plehu i nježno utisni do rubova. Ako se vraća, pokrij ga i ostavi do 15 minuta da se opusti prije nastavka.',
      'Pokrij plehove i nakon utiskivanja ostavi tijesto da se završno diže 60–120 minuta, prema rasporedu i stanju tijesta. Spremno je kada je vidljivo napuhnuto i mjehurasto. Ako raspored ne ostavlja barem 75 minuta za pripremu i dizanje, pomakni pečenje.',
      'Dodaj nadjev i peci prema uputama za odabranu pećnicu.',
    ],
  },
  en: {
    title: 'Phase C: Portion, final rise and bake',
    steps: [
      'Keep the dough covered as one mass during the remaining fermentation; do not shape balls.',
      'Oil the trays using the calculated count and dimensions. Divide the dough into the calculated weight per tray and gently press it to the edges. If it springs back, cover it and let it relax for up to 15 minutes before continuing.',
      'Cover the trays and, after pressing, let the dough complete its final rise for 60–120 minutes, guided by the schedule and dough condition. It is ready when noticeably puffy and bubbly. If the schedule leaves less than 75 minutes for preparation and rising, move the bake time.',
      'Add the toppings and bake according to the selected oven instructions.',
    ],
  },
  de: {
    title: 'Phase C: Teilen, Endgare und Backen',
    steps: [
      'Lassen Sie den Teig während der restlichen Gare abgedeckt als eine Masse; formen Sie keine Teiglinge.',
      'Ölen Sie die Bleche entsprechend der berechneten Anzahl und Maße. Teilen Sie den Teig in das berechnete Gewicht pro Blech und drücken Sie ihn vorsichtig bis zum Rand. Zieht er sich zurück, decken Sie ihn ab und lassen Sie ihn vor dem Weiterdrücken bis zu 15 Minuten entspannen.',
      'Decken Sie die Bleche ab und lassen Sie den Teig nach dem Eindrücken 60–120 Minuten endgaren; richten Sie sich nach Zeitplan und Teigzustand. Er ist bereit, wenn er sichtbar aufgegangen und blasig ist. Lässt der Zeitplan weniger als 75 Minuten für Vorbereitung und Gare, verschieben Sie den Backzeitpunkt.',
      'Geben Sie den Belag darauf und backen Sie nach den Anweisungen für den ausgewählten Ofen.',
    ],
  },
  sl: {
    title: 'Faza C: Razdelitev, končno vzhajanje in peka',
    steps: [
      'Testo med preostalo fermentacijo pusti pokrito kot eno maso; ne oblikuj kroglic.',
      'Pekače naolji glede na izračunano število in mere. Testo razdeli na izračunano maso za posamezen pekač in ga nežno vtisni do robov. Če se krči, ga pokrij in pred nadaljevanjem pusti počivati do 15 minut.',
      'Pekače pokrij in po vtiskovanju pusti testo končno vzhajati 60–120 minut; upoštevaj načrt in stanje testa. Pripravljeno je, ko je vidno napihnjeno in mehurčkasto. Če načrt ne omogoča vsaj 75 minut za pripravo in vzhajanje, prestavi peko.',
      'Dodaj nadev in peci po navodilih za izbrano pečico.',
    ],
  },
};

export function labelSelectedYeast(text: string, lang: Lang, yeastType: PreferredYeastType): string {
  const labels = {
    hr: { fresh: 'svježeg kvasca', activeDry: 'aktivnog suhog kvasca', dry: 'instant suhog kvasca' },
    en: { fresh: 'fresh yeast', activeDry: 'active dry yeast', dry: 'instant dry yeast' },
    de: { fresh: 'Frischhefe', activeDry: 'Aktiv-Trockenhefe', dry: 'Instant-Trockenhefe' },
    sl: { fresh: 'svežega kvasa', activeDry: 'aktivnega suhega kvasa', dry: 'instant suhega kvasa' },
  }[lang];
  const patterns = {
    hr: /svjež(?:eg kvasca|i kvasac)|aktivn(?:og suhog kvasca|i suhi kvasac)|instant su(?:hog kvasca|hi kvasac)/gi,
    en: /fresh yeast|active dry yeast|instant dry yeast/gi,
    de: /Frischhefe|Aktiv-Trockenhefe|Instant-Trockenhefe/gi,
    sl: /svež(?:ega kvasa|i kvas)|aktivn(?:ega suhega kvasa|i suhi kvas)|instant su(?:hega kvasa|hi kvas)/gi,
  }[lang];
  return text.replace(patterns, labels[yeastType]);
}

export function adaptDirectYeastStep(text: string, lang: Lang, yeastType: PreferredYeastType): string {
  const dissolvePattern = {
    hr: /[^.!?]*(?:otopite|rastopite)[^.!?]*kvasac[^.!?]*[.!?]?/i,
    en: /[^.!?]*dissolv(?:e|ed|ing)[^.!?]*yeast[^.!?]*[.!?]?/i,
    de: /[^.!?]*(?:lösen|aufgelöst|auflösen)[^.!?]*Hefe[^.!?]*[.!?]?/i,
    sl: /[^.!?]*(?:raztopite|raztopljen)[^.!?]*kvas[^.!?]*[.!?]?/i,
  }[lang];
  const lockedDirectHydrationPattern = {
    hr: /U približno\s*(80|90)% vode,\s*odnosno\s*\d+(?:[.,]\d+)?\s*g,\s*otopite kvasac\./i,
    en: /$^/,
    de: /$^/,
    sl: /$^/,
  }[lang];
  const yeastWaterPattern = {
    hr: /vodu s (?:otopljenim )?kvascem|voda s kvascem|kvasnu vodu/gi,
    en: /water with (?:the )?(?:dissolved )?yeast|yeast water/gi,
    de: /Wasser mit (?:der aufgelösten )?Hefe|Hefewasser/gi,
    sl: /vodo z (?:raztopljenim )?kvasom|voda s kvasom/gi,
  }[lang];
  const handling = {
    hr: {
      fresh: 'Svježi kvasac razmrvite ili otopite u dijelu izmjerene vode.',
      activeDry: 'Aktivni suhi kvas najprije otopite u dijelu tople izmjerene vode prema uputama na pakiranju; tu vodu uračunajte u ukupnu količinu.',
      dry: 'Instant suhi kvas ravnomjerno umiješajte u brašno; uz ledeno hladnu vodu dodajte ga nakon 1–2 minute početnog miješanja.',
    },
    en: {
      fresh: 'Crumble or dissolve fresh yeast in part of the measured water.',
      activeDry: 'First dissolve active dry yeast in part of the measured warm water according to the package directions; count that water toward the total.',
      dry: 'Mix instant dry yeast evenly into the flour; with ice-cold water, add it after 1–2 minutes of initial mixing.',
    },
    de: {
      fresh: 'Frischhefe in einem Teil des abgemessenen Wassers zerbröseln oder auflösen.',
      activeDry: 'Aktiv-Trockenhefe zunächst nach Packungsanleitung in einem Teil des abgemessenen warmen Wassers auflösen; dieses Wasser zur Gesamtmenge zählen.',
      dry: 'Instant-Trockenhefe gleichmäßig unter das Mehl mischen; bei eiskaltem Wasser erst nach 1–2 Minuten des anfänglichen Mischens zugeben.',
    },
    sl: {
      fresh: 'Sveži kvas nadrobite ali raztopite v delu odmerjene vode.',
      activeDry: 'Aktivni suhi kvas najprej raztopite v delu odmerjene tople vode po navodilih na embalaži; to vodo vštejte v skupno količino.',
      dry: 'Instant suhi kvas enakomerno vmešajte v moko; pri ledeno mrzli vodi ga dodajte po 1–2 minutah začetnega mešanja.',
    },
  }[lang];
  const labelled = labelSelectedYeast(text, lang, yeastType);
  if (lockedDirectHydrationPattern.test(labelled)) {
    return labelled;
  }
  const dissolveInstruction = labelled.match(dissolvePattern)?.[0];
  const measuredWater = dissolveInstruction?.match(/(\d+(?:[.,]\d+)?)\s*g/i)?.[1];
  const firstWaterNote = measuredWater
    ? {
      hr: ` Prvi dodani dio vode iznosi ${measuredWater} g; uračunajte ga u ukupnu količinu vode.`,
      en: ` The first water addition is ${measuredWater} g; count it toward the total water.`,
      de: ` Die erste Wasserzugabe beträgt ${measuredWater} g und wird zur Gesamtwassermenge gezählt.`,
      sl: ` Prvi dodani del vode znaša ${measuredWater} g; vštejte ga v skupno količino vode.`,
    }[lang]
    : '';
  const prepared = labelled.replace(dissolvePattern, `${handling[yeastType]}${firstWaterNote}`);
  return (yeastType === 'dry' ? prepared.replace(yeastWaterPattern, ({
    hr: 'vodo',
    en: 'water',
    de: 'Wasser',
    sl: 'vodo',
  }[lang])) : prepared);
}

export function adaptDirectMixingSteps(
  steps: string[],
  lang: Lang,
  yeastType: PreferredYeastType,
  mixing: 'hand' | 'mixer' | 'spiral',
  hasOil = false,
): string[] {
  if (mixing === 'spiral') {
    return getSpiralMixingSteps(lang, yeastType, { method: 'direct', hasOil });
  }
  return steps.map((step, index) => {
    if (mixing === 'hand' && index === 0) {
      return {
        hr: yeastType === 'fresh'
          ? 'Svježi kvasac otopite u dijelu izmjerene vode.'
          : yeastType === 'activeDry'
            ? 'Aktivni suhi kvas otopite u dijelu tople izmjerene vode prema uputama na pakiranju; tu vodu uračunajte u ukupnu količinu.'
            : 'Nemojte otapati instant suhi kvas u hladnoj vodi; umiješajte ga nakon početnog povezivanja brašna i vode.',
        en: yeastType === 'fresh'
          ? 'Dissolve fresh yeast in part of the measured water.'
          : yeastType === 'activeDry'
            ? 'Dissolve active dry yeast in part of the measured warm water according to the package directions; count that water toward the total.'
            : 'Do not dissolve instant dry yeast in cold water; add it after the flour and water have first come together.',
        de: yeastType === 'fresh'
          ? 'Frischhefe in einem Teil des abgemessenen Wassers auflösen.'
          : yeastType === 'activeDry'
            ? 'Aktiv-Trockenhefe nach Packungsanleitung in einem Teil des abgemessenen warmen Wassers auflösen; dieses Wasser zur Gesamtmenge zählen.'
            : 'Instant-Trockenhefe nicht in kaltem Wasser auflösen; erst zugeben, nachdem sich Mehl und Wasser zunächst verbunden haben.',
        sl: yeastType === 'fresh'
          ? 'Sveži kvas raztopite v delu odmerjene vode.'
          : yeastType === 'activeDry'
            ? 'Aktivni suhi kvas raztopite v delu odmerjene tople vode po navodilih na embalaži; to vodo vštejte v skupno količino.'
            : 'Instant suhega kvasa ne raztapljajte v hladni vodi; dodajte ga, ko se moka in voda najprej povežeta.',
      }[lang];
    }
    if (mixing === 'hand' && yeastType === 'dry' && index === 1) {
      return {
        hr: 'Postupno dodajte polovicu brašna u vodu i povežite; nakon 1–2 minute početnog miješanja dodajte instant suhi kvas i umiješajte ga.',
        en: 'Gradually add half the flour to the water and combine; after 1–2 minutes of initial mixing, add and incorporate the instant dry yeast.',
        de: 'Die Hälfte des Mehls nach und nach zum Wasser geben und vermengen; nach 1–2 Minuten anfänglichem Mischen die Instant-Trockenhefe zugeben und einarbeiten.',
        sl: 'Postopoma dodajte polovico moke v vodo in povežite; po 1–2 minutah začetnega mešanja dodajte instant suhi kvas in ga vmešajte.',
      }[lang];
    }
    if (mixing === 'mixer' && index === 2) {
      return {
        hr: yeastType === 'fresh'
          ? 'U posudi miksera 10 sekundi promiješajte brašno sa svježim kvascem.'
          : yeastType === 'activeDry'
            ? 'Aktivni suhi kvas pripremite u dijelu tople izmjerene vode prema uputama na pakiranju i sačuvajte do dodavanja.'
            : 'U posudi miksera miješajte samo brašno 10 sekundi; instant suhi kvas dodajte nakon početnog miješanja s vodom.',
        en: yeastType === 'fresh'
          ? 'Mix the flour and fresh yeast in the mixer bowl for 10 seconds.'
          : yeastType === 'activeDry'
            ? 'Prepare active dry yeast in part of the measured warm water according to the package directions and set it aside.'
            : 'Mix the flour alone in the mixer bowl for 10 seconds; add instant dry yeast after the initial mixing with water.',
        de: yeastType === 'fresh'
          ? 'Mehl und Frischhefe 10 Sekunden in der Mixerschüssel mischen.'
          : yeastType === 'activeDry'
            ? 'Aktiv-Trockenhefe nach Packungsanleitung in einem Teil des abgemessenen warmen Wassers vorbereiten und beiseitestellen.'
            : 'Das Mehl 10 Sekunden allein in der Mixerschüssel mischen; Instant-Trockenhefe erst nach dem ersten Mischen mit Wasser zugeben.',
        sl: yeastType === 'fresh'
          ? 'Moko in sveži kvas 10 sekund mešajte v posodi mešalnika.'
          : yeastType === 'activeDry'
            ? 'Aktivni suhi kvas pripravite v delu odmerjene tople vode po navodilih na embalaži in ga odložite do dodajanja.'
            : 'Moko v posodi mešalnika mešajte 10 sekund brez kvasa; instant suhi kvas dodajte po začetnem mešanju z vodo.',
      }[lang];
    }
    if (mixing === 'mixer' && yeastType === 'activeDry' && index === 3) {
      const preparedYeast = {
        hr: 'Dodajte pripremljenu otopinu aktivnog suhog kvasca; uračunajte je u količinu izmjerene vode.',
        en: 'Add the prepared active dry yeast solution; count it toward the measured water.',
        de: 'Die vorbereitete Aktiv-Trockenhefe-Lösung zugeben und zur abgemessenen Wassermenge zählen.',
        sl: 'Dodajte pripravljeno raztopino aktivnega suhega kvasa in jo vštejte v odmerjeno vodo.',
      }[lang];
      return `${step} ${preparedYeast}`;
    }
    if (mixing === 'mixer' && yeastType === 'dry' && index === 3) {
      const afterWater = {
        hr: 'Miješajte 1–2 minute, zatim dodajte instant suhi kvas i umiješajte ga prije preostale vode.',
        en: 'Mix for 1–2 minutes, then add and incorporate the instant dry yeast before adding the remaining water.',
        de: '1–2 Minuten mischen, dann die Instant-Trockenhefe zugeben und einarbeiten, bevor das restliche Wasser dazukommt.',
        sl: 'Mešajte 1–2 minuti, nato dodajte in vmešajte instant suhi kvas, preden dodate preostalo vodo.',
      }[lang];
      return `${step} ${afterWater}`;
    }
    return adaptDirectYeastStep(step, lang, yeastType);
  });
}

export function getYeastAwarePrefermentSteps(
  lang: Lang,
  method: 'biga' | 'poolish',
  mixing: 'hand' | 'mixer' | 'spiral',
  yeastType: PreferredYeastType,
  teglia = false,
  hasOil = false,
): Path {
  const path = (method === 'biga' ? BIGA_STEPS : POOLISH_STEPS)[lang][mixing === 'spiral' ? 'mixer' : mixing];
  const p1 = { ...path.p1, steps: [...path.p1.steps] };
  const p2 = { ...path.p2, steps: [...path.p2.steps] };
  const copy = {
    hr: {
      bigaFresh: 'U brašno ravnomjerno izmrvite svježi kvasac.',
      bigaActiveDry: 'Aktivni suhi kvas otopite u dijelu tople vode prema uputama na pakiranju; tu vodu oduzmite od izmjerene vode.',
      bigaDry: 'Instant suhi kvasac ravnomjerno umiješajte u brašno.',
      bigaFinalFresh: 'Preostali svježi kvasac otopite u manjem dijelu izmjerene hladne vode pa ga dodajte s većim dijelom te vode.',
      bigaFinalActiveDry: 'Preostali aktivni suhi kvas otopite u dijelu tople vode prema uputama na pakiranju; tu vodu uračunajte u izmjerenu vodu za završni zamjes.',
      bigaFinalDry: 'Preostali instant suhi kvasac ravnomjerno umiješajte u dio preostalog brašna pa dodajte uz veći dio hladne vode.',
      poolishFresh: 'Svježi kvasac otopite u izmjerenoj vodi za Poolish.',
      poolishActiveDry: 'Aktivni suhi kvas pripremite u dijelu tople izmjerene vode prema uputama na pakiranju; tu vodu uračunajte u vodu za Poolish.',
      poolishDry: 'Instant suhi kvasac ravnomjerno umiješajte u brašno za Poolish.',
      poolishWater: 'Dodajte izmjerenu vodu uz miješanje pjenjačom ili vilicom dok ne dobijete glatku smjesu.',
      poolishFinalFresh: 'Završni svježi kvasac otopite u dijelu izmjerene preostale vode; dodajte ga s preostalim brašnom i većim dijelom vode.',
      poolishFinalActiveDry: 'Aktivni suhi kvasac za završno tijesto pripremite u dijelu tople preostale vode prema uputama na pakiranju; uračunajte je u vodu za završni zamjes.',
      poolishFinalDry: 'Završni instant suhi kvasac ravnomjerno umiješajte u preostalo brašno pa dodajte veći dio preostale vode.',
    },
    en: {
      bigaFresh: 'Evenly crumble the fresh yeast through the flour.',
      bigaActiveDry: 'Dissolve active dry yeast in part of the warm water according to the package directions; subtract that water from the measured amount.',
      bigaDry: 'Mix the instant dry yeast evenly into the flour.',
      bigaFinalFresh: 'Dissolve the remaining fresh yeast in a small part of the measured cold water, then add it with most of that water.',
      bigaFinalActiveDry: 'Dissolve the remaining active dry yeast in part of the warm water according to the package directions; count that water toward the measured final-mix water.',
      bigaFinalDry: 'Mix the remaining instant dry yeast evenly into part of the remaining flour, then add it with most of the cold water.',
      poolishFresh: 'Dissolve the fresh yeast in the measured Poolish water.',
      poolishActiveDry: 'Prepare active dry yeast in part of the measured warm water according to the package directions; count that water toward the Poolish water.',
      poolishDry: 'Mix the instant dry yeast evenly into the Poolish flour.',
      poolishWater: 'Add the measured water while whisking or stirring with a fork until smooth.',
      poolishFinalFresh: 'Dissolve the final-dough fresh yeast in part of the measured remaining water; add it with the remaining flour and most of the water.',
      poolishFinalActiveDry: 'Prepare the final-dough active dry yeast in part of the warm remaining water according to the package directions; count it toward the final-mix water.',
      poolishFinalDry: 'Mix the final-dough instant dry yeast evenly into the remaining flour, then add most of the remaining water.',
    },
    de: {
      bigaFresh: 'Die frische Hefe gleichmäßig über das Mehl bröseln.',
      bigaActiveDry: 'Aktiv-Trockenhefe nach Packungsanleitung in einem Teil des warmen Wassers auflösen; dieses Wasser von der abgemessenen Menge abziehen.',
      bigaDry: 'Die Instant-Trockenhefe gleichmäßig unter das Mehl mischen.',
      bigaFinalFresh: 'Die restliche Frischhefe in einem kleinen Teil des abgemessenen kalten Wassers auflösen und mit dem größten Teil dieses Wassers zugeben.',
      bigaFinalActiveDry: 'Die restliche Aktiv-Trockenhefe nach Packungsanleitung in einem Teil des warmen Wassers auflösen; dieses Wasser zur abgemessenen Wassermenge für den Hauptteig zählen.',
      bigaFinalDry: 'Die restliche Instant-Trockenhefe gleichmäßig unter einen Teil des restlichen Mehls mischen und mit dem größten Teil des kalten Wassers zugeben.',
      poolishFresh: 'Die frische Hefe im abgemessenen Poolish-Wasser auflösen.',
      poolishActiveDry: 'Aktiv-Trockenhefe nach Packungsanleitung in einem Teil des abgemessenen warmen Wassers vorbereiten; dieses Wasser zum Poolish-Wasser zählen.',
      poolishDry: 'Die Instant-Trockenhefe gleichmäßig unter das Poolish-Mehl mischen.',
      poolishWater: 'Das abgemessene Wasser unter Rühren mit dem Schneebesen oder einer Gabel zugeben, bis die Mischung glatt ist.',
      poolishFinalFresh: 'Die Frischhefe für den Hauptteig in einem Teil des abgemessenen restlichen Wassers auflösen; mit dem restlichen Mehl und dem größten Teil des Wassers zugeben.',
      poolishFinalActiveDry: 'Die Aktiv-Trockenhefe für den Hauptteig nach Packungsanleitung in einem Teil des warmen restlichen Wassers vorbereiten; dieses Wasser zur abgemessenen Menge für den Hauptteig zählen.',
      poolishFinalDry: 'Die Instant-Trockenhefe für den Hauptteig gleichmäßig unter das restliche Mehl mischen und dann den größten Teil des restlichen Wassers zugeben.',
    },
    sl: {
      bigaFresh: 'Sveži kvas enakomerno nadrobite po moki.',
      bigaActiveDry: 'Aktivni suhi kvas raztopite v delu tople vode po navodilih na embalaži; to vodo odštejte od odmerjene količine.',
      bigaDry: 'Instant suhi kvas enakomerno vmešajte v moko.',
      bigaFinalFresh: 'Preostali sveži kvas raztopite v manjšem delu odmerjene hladne vode in ga dodajte z večino te vode.',
      bigaFinalActiveDry: 'Preostali aktivni suhi kvas raztopite v delu tople vode po navodilih na embalaži; to vodo vštejte v odmerjeno vodo za končno gnetenje.',
      bigaFinalDry: 'Preostali instant suhi kvas enakomerno vmešajte v del preostale moke in dodajte z večino hladne vode.',
      poolishFresh: 'Sveži kvas raztopite v odmerjeni vodi za Poolish.',
      poolishActiveDry: 'Aktivni suhi kvas pripravite v delu odmerjene tople vode po navodilih na embalaži; to vodo vštejte v vodo za Poolish.',
      poolishDry: 'Instant suhi kvas enakomerno vmešajte v moko za Poolish.',
      poolishWater: 'Med mešanjem z metlico ali vilicami dodajte odmerjeno vodo, da dobite gladko zmes.',
      poolishFinalFresh: 'Sveži kvas za končno testo raztopite v delu odmerjene preostale vode; dodajte ga s preostalo moko in večino vode.',
      poolishFinalActiveDry: 'Aktivni suhi kvas za končno testo pripravite v delu tople preostale vode po navodilih na embalaži; to vodo vštejte v vodo za končno gnetenje.',
      poolishFinalDry: 'Instant suhi kvas za končno testo enakomerno vmešajte v preostalo moko, nato dodajte večino preostale vode.',
    },
  }[lang];

  if (method === 'biga') {
    p1.steps[0] = yeastType === 'fresh' ? copy.bigaFresh : yeastType === 'activeDry' ? copy.bigaActiveDry : copy.bigaDry;
    p2.steps[1] = yeastType === 'fresh' ? copy.bigaFinalFresh : yeastType === 'activeDry' ? copy.bigaFinalActiveDry : copy.bigaFinalDry;
  } else {
    p1.steps[0] = yeastType === 'fresh' ? copy.poolishFresh : yeastType === 'activeDry' ? copy.poolishActiveDry : copy.poolishDry;
    p1.steps[1] = yeastType === 'fresh' ? path.p1.steps[1] : copy.poolishWater;
    p2.steps[1] = yeastType === 'fresh' ? copy.poolishFinalFresh : yeastType === 'activeDry' ? copy.poolishFinalActiveDry : copy.poolishFinalDry;
  }

  if (mixing === 'spiral') {
    p2.title = getSpiralMixingTitle(lang, method);
    p2.steps = getSpiralMixingSteps(lang, yeastType, { method, hasOil });
  }

  return { ...path, p1, p2, p3: teglia ? TEGLIA_P3[lang] : path.p3 };
}

// Localized "reset checked steps" button label
export const RESET_LABEL: Record<Lang, string> = {
  hr: 'Poništi označene korake',
  en: 'Reset checked steps',
  de: 'Markierte Schritte zurücksetzen',
  sl: 'Ponastavi označene korake',
};


// =========================================================================
// PHASE TIMERS - short alarm chips shown next to each phase title.
// Locale-agnostic durations + short localized labels via a shared kind system.
// =========================================================================
export type TimerKind = 'rt' | 'fridge' | 'rest' | 'ballsRt' | 'ballsFridge' | 'preBake' | 'roomToBake' | 'preheat' | 'bake' | 'bakeFinish' | 'rotate' | 'preferment';

export type BaseTimer = {
  id: string;
  seconds: number;
  kind: TimerKind;
  plannedStartAt?: number;
};

// Duration recipes per phaseKey (same across all languages)
export const PHASE_TIMER_DURATIONS: Record<string, BaseTimer[]> = {
  // ---- BIGA ----
  'biga-hand-P1': [
    { id: 'rt8h', seconds: 8 * 3600, kind: 'rt' },
    { id: 'fr16h', seconds: 16 * 3600, kind: 'fridge' },
  ],
  'biga-mixer-P1': [
    { id: 'rt8h', seconds: 8 * 3600, kind: 'rt' },
    { id: 'fr16h', seconds: 16 * 3600, kind: 'fridge' },
  ],
  'biga-hand-P3': [
    { id: 'rest7m', seconds: 7 * 60, kind: 'rest' },
    { id: 'rt30m', seconds: 30 * 60, kind: 'rt' },
    { id: 'fr60m', seconds: 60 * 60, kind: 'fridge' },
    { id: 'brt15m', seconds: 15 * 60, kind: 'ballsRt' },
    { id: 'bfr5h', seconds: 5 * 3600, kind: 'ballsFridge' },
    { id: 'pb15m', seconds: 15 * 60, kind: 'preBake' },
  ],
  'biga-mixer-P3': [
    { id: 'rest7m', seconds: 7 * 60, kind: 'rest' },
    { id: 'rt30m', seconds: 30 * 60, kind: 'rt' },
    { id: 'fr60m', seconds: 60 * 60, kind: 'fridge' },
    { id: 'brt15m', seconds: 15 * 60, kind: 'ballsRt' },
    { id: 'bfr5h', seconds: 5 * 3600, kind: 'ballsFridge' },
    { id: 'pb15m', seconds: 15 * 60, kind: 'preBake' },
  ],

  // ---- POOLISH ----
  'poolish-hand-P1': [
    { id: 'rt1h', seconds: 60 * 60, kind: 'rt' },
    { id: 'fr16h', seconds: 16 * 3600, kind: 'fridge' },
  ],
  'poolish-mixer-P1': [
    { id: 'rt1h', seconds: 60 * 60, kind: 'rt' },
    { id: 'fr16h', seconds: 16 * 3600, kind: 'fridge' },
  ],
  'poolish-hand-P3': [
    { id: 'rt30m', seconds: 30 * 60, kind: 'rt' },
    { id: 'rt30m2', seconds: 30 * 60, kind: 'rt' },
    { id: 'brt3h', seconds: 3 * 3600, kind: 'ballsRt' },
  ],
  'poolish-mixer-P3': [
    { id: 'rt30m', seconds: 30 * 60, kind: 'rt' },
    { id: 'rt30m2', seconds: 30 * 60, kind: 'rt' },
    { id: 'brt3h', seconds: 3 * 3600, kind: 'ballsRt' },
  ],

  // ---- DIRECT (existing A/B/C/D) ----
  'direct-hand-A': [
    { id: 'rest15m', seconds: 15 * 60, kind: 'rest' },
  ],
  'direct-hand-B': [
    { id: 'rt30m', seconds: 30 * 60, kind: 'rt' },
    { id: 'fr24h', seconds: 24 * 3600, kind: 'fridge' },
  ],
  'direct-hand-C': [
    { id: 'bfr4h', seconds: 4 * 3600, kind: 'ballsFridge' },
  ],
  'direct-hand-D': [
    { id: 'pb90m', seconds: 90 * 60, kind: 'preBake' },
  ],
  'direct-mixer-A': [
    { id: 'rest5m', seconds: 5 * 60, kind: 'rest' },
  ],
  'direct-mixer-B': [
    { id: 'rt30m', seconds: 30 * 60, kind: 'rt' },
    { id: 'rt30m2', seconds: 30 * 60, kind: 'rt' },
    { id: 'fr24h', seconds: 24 * 3600, kind: 'fridge' },
  ],
  'direct-mixer-C': [
    { id: 'brt45m', seconds: 45 * 60, kind: 'ballsRt' },
    { id: 'bfr4h', seconds: 4 * 3600, kind: 'ballsFridge' },
  ],
  'direct-mixer-D': [
    { id: 'pb17m', seconds: 17 * 60, kind: 'preBake' },
  ],
};

// Localized short label per kind
export const TIMER_KIND_LABEL: Record<Lang, Record<TimerKind, string>> = {
  hr: { rt: 'Sobna', fridge: 'Frižider', rest: 'Odmor', ballsRt: 'Loptice RT', ballsFridge: 'Loptice frižider', preBake: 'Prije pečenja', roomToBake: 'Sobna do pečenja', preheat: 'Zagrijavanje', bake: 'Pečenje', bakeFinish: 'Završno pečenje', rotate: 'Okretanje pizze', preferment: 'Fermentacija predtijesta' },
  en: { rt: 'Room temp', fridge: 'Fridge', rest: 'Rest', ballsRt: 'Balls RT', ballsFridge: 'Balls Fridge', preBake: 'Before baking', roomToBake: 'Room temp until baking', preheat: 'Preheating', bake: 'Baking', bakeFinish: 'Final bake', rotate: 'Rotate pizza', preferment: 'Preferment fermentation' },
  de: { rt: 'Raumtemp.', fridge: 'Kühlschrank', rest: 'Ruhezeit', ballsRt: 'Kugeln RT', ballsFridge: 'Kugeln Kühlschrank', preBake: 'Vor dem Backen', roomToBake: 'Raumtemp. bis Backen', preheat: 'Vorheizen', bake: 'Backen', bakeFinish: 'Fertigbacken', rotate: 'Pizza drehen', preferment: 'Vorteig-Fermentation' },
  sl: { rt: 'Sobna', fridge: 'Hladilnik', rest: 'Počitek', ballsRt: 'Kroglice RT', ballsFridge: 'Kroglice hladilnik', preBake: 'Pred peko', roomToBake: 'Sobna do peke', preheat: 'Segrevanje', bake: 'Peka', bakeFinish: 'Zaključna peka', rotate: 'Obračanje pice', preferment: 'Fermentacija predtesta' },
};

// Localized notification content
export const TIMER_NOTIF: Record<Lang, { title: string; body: (label: string) => string; running: string; expiredAlertTitle: string; expiredAlertBody: (label: string) => string }> = {
  hr: {
    title: '🍕 Pizzabook · Faza gotova',
    body: (l) => `${l} — vrijeme je isteklo. Idi na sljedeći korak.`,
    running: 'U tijeku',
    expiredAlertTitle: 'Faza gotova',
    expiredAlertBody: (l) => `${l} — vrijeme je isteklo!`,
  },
  en: {
    title: '🍕 Pizzabook · Phase finished',
    body: (l) => `${l} — time is up. Move to next step.`,
    running: 'Running',
    expiredAlertTitle: 'Phase finished',
    expiredAlertBody: (l) => `${l} — time is up!`,
  },
  de: {
    title: '🍕 Pizzabook · Phase beendet',
    body: (l) => `${l} — Zeit ist abgelaufen. Gehe zum nächsten Schritt.`,
    running: 'In Bearbeitung',
    expiredAlertTitle: 'Phase beendet',
    expiredAlertBody: (l) => `${l} — Zeit ist abgelaufen!`,
  },
  sl: {
    title: '🍕 Pizzabook · Faza končana',
    body: (l) => `${l} — čas je potekel. Pojdi na naslednji korak.`,
    running: 'V teku',
    expiredAlertTitle: 'Faza končana',
    expiredAlertBody: (l) => `${l} — čas je potekel!`,
  },
};

// Human-readable duration ("8 h", "30 min")
export function formatDuration(seconds: number, lang: Lang): string {
  void lang;
  const totalMinutes = Math.max(0, Math.round(seconds / 60));
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m} min`;
  return m ? `${h} h ${m} min` : `${h} h`;
}

// Countdown "HH:MM:SS" or "MM:SS"
export function formatCountdown(msRemaining: number): string {
  const total = Math.max(0, Math.ceil(msRemaining / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}
