import type { Lang } from './translations';
import type { PreferredYeastType } from '../preferences';
import { calculateProWaterSplit } from './proIceWaterInstructions';
export { calculateProWaterSplit };

export type SpiralMixingContext = {
  method: 'direct' | 'biga' | 'poolish';
  hasOil: boolean;
  recipe?: SpiralMixingRecipe;
  remainingFlourDescription?: string;
  directStyle?: 'napolitana' | 'romanaTonda' | 'romanaTeglia' | 'newYork';
  directInitialWaterGrams?: number;
  directInitialWaterPct?: 80 | 90;
  psyllium?: {
    amount: string;
    initialWaterGrams: number;
    initialWaterPct: 80 | 90;
  };
};

export type SpiralMixingRecipe = {
  flourGrams: number;
  flourLabel: string;
  flourBlendDescription?: string;
  prefermentGrams?: number;
  waterBaseGrams: number;
  liquidWaterGrams: number;
  iceGrams: number;
  initialWaterPct: 80 | 90;
  yeastGrams: number;
  saltGrams: number;
  oilGrams: number;
  psylliumGrams?: number;
  flourBehavior: 'standard' | 'manitoba' | 'spelt' | 'wholeWheat' | 'glutenFree';
  restMinutes?: number;
  targetDoughTemperature?: number;
  formatWeight: (grams: number, precise?: boolean) => string;
};

export type SpiralMixingStepInfo = { title: string; body: string };
export type SpiralMixingStepInfoList = Array<SpiralMixingStepInfo | SpiralMixingStepInfo[] | undefined>;

export function getSpiralMixingTitle(lang: Lang, method: SpiralMixingContext['method']): string {
  const copy = {
    hr: {
      direct: 'Faza A: Priprema i zamjes spiralnim mikserom',
      biga: 'Faza B: Završni zamjes spiralnim mikserom',
      poolish: 'Faza B: Dodavanje Poolisha i zamjes spiralnim mikserom',
    },
    en: {
      direct: 'Phase A: Preparation and spiral mixing',
      biga: 'Phase B: Final spiral mix',
      poolish: 'Phase B: Adding the Poolish and spiral mixing',
    },
    de: {
      direct: 'Phase A: Vorbereitung und Kneten im Spiralkneter',
      biga: 'Phase B: Hauptteig im Spiralkneter kneten',
      poolish: 'Phase B: Poolish zugeben und im Spiralkneter kneten',
    },
    sl: {
      direct: 'Faza A: Priprava in gnetenje s spiralnim mešalnikom',
      biga: 'Faza B: Končno gnetenje s spiralnim mešalnikom',
      poolish: 'Faza B: Dodajanje Poolisha in gnetenje s spiralnim mešalnikom',
    },
  }[lang];
  return copy[method];
}

export function removeProIceReferencesFromSteps(steps: readonly string[], lang: Lang): string[] {
  return steps.map((step) => {
    let adapted = step.replace(/\s*\((?:s ledom|with ice|mit Eis|z ledom)\)/gi, '');
    if (lang === 'hr') {
      adapted = adapted
        .replace(/\bledeno hladn/gi, 'hladn')
        .replace(/\bledena voda\b/gi, 'hladna voda');
    } else if (lang === 'en') {
      adapted = adapted
        .replace(/\bice-cold\b/gi, 'cold')
        .replace(/\bice water\b/gi, 'cold water');
    } else if (lang === 'de') {
      adapted = adapted
        .replace(/\beiskaltem\b/gi, 'kaltem')
        .replace(/\beiskalte\b/gi, 'kalte')
        .replace(/\beiskalter\b/gi, 'kalter')
        .replace(/\beiskaltes\b/gi, 'kaltes')
        .replace(/\beiskalt\b/gi, 'kalt')
        .replace(/\bEiswasser\b/gi, 'kaltes Wasser');
    } else {
      adapted = adapted
        .replace(/\bledeno mrzlo\b/gi, 'mrzlo')
        .replace(/\bledena voda\b/gi, 'hladna voda');
    }
    return adapted.replace(/\s{2,}/g, ' ').replace(/\s+([,.;:])/g, '$1').trim();
  });
}

export function adaptSpiralMixerSourceSteps(steps: readonly string[], lang: Lang): string[] {
  return removeProIceReferencesFromSteps(steps, lang).map((step) => {
    let adapted = step;
    if (lang === 'hr') {
      adapted = adapted
        .replace(/\bmikserom\b/gi, 'spiralnim mikserom')
        .replace(/\bmiksera\b/gi, 'spiralnog miksera')
        .replace(/\bmikseru\b/gi, 'spiralnom mikseru')
        .replace(/\bmikser\b/gi, 'spiralni mikser');
    } else if (lang === 'en') {
      adapted = adapted.replace(/\bmixer\b/gi, 'spiral mixer');
    } else if (lang === 'de') {
      adapted = adapted
        .replace(/\bMixerschüssel\b/gi, 'Schüssel des Spiralkneters')
        .replace(/\bMixer\b/gi, 'Spiralkneter');
    } else {
      adapted = adapted
        .replace(/\bmešalnikom\b/gi, 'spiralnim mešalnikom')
        .replace(/\bmešalnika\b/gi, 'spiralnega mešalnika')
        .replace(/\bmešalniku\b/gi, 'spiralnem mešalniku')
        .replace(/\bmešalnik\b/gi, 'spiralni mešalnik');
    }
    return adapted.replace(/\s{2,}/g, ' ').replace(/\s+([,.;:])/g, '$1').trim();
  });
}

function getDetailedProSpiralMixingSteps(
  lang: Lang,
  yeastType: PreferredYeastType,
  context: SpiralMixingContext,
  recipe: SpiralMixingRecipe,
): string[] {
  const { method, hasOil } = context;
  const split = calculateProWaterSplit({
    waterBaseGrams: recipe.waterBaseGrams,
    liquidWaterGrams: recipe.liquidWaterGrams,
    iceGrams: recipe.iceGrams,
    initialWaterPct: recipe.initialWaterPct,
  });
  const amounts = [
    recipe.flourBlendDescription
      ? `${recipe.formatWeight(recipe.flourGrams)} ${recipe.flourLabel} (${recipe.flourBlendDescription})`
      : `${recipe.formatWeight(recipe.flourGrams)} ${recipe.flourLabel}`,
    ...(method === 'direct'
      ? []
      : [`${recipe.formatWeight(recipe.prefermentGrams ?? 0)} ${method === 'biga' ? 'Biga' : 'Poolish'}`]),
    `${recipe.formatWeight(recipe.waterBaseGrams)} ${recipe.iceGrams > 0
      ? ({
        hr: 'ukupnog vodenog ekvivalenta',
        en: 'total water equivalent',
        de: 'Wasserequivalent',
        sl: 'skupnega vodnega ekvivalenta',
      }[lang])
      : ({
        hr: 'vode',
        en: 'water',
        de: 'Wasser',
        sl: 'vode',
      }[lang])}`,
    `${recipe.formatWeight(recipe.yeastGrams, true)} ${({
      hr: { fresh: 'svježeg kvasca', activeDry: 'aktivnog suhog kvasca', dry: 'instant suhog kvasca' },
      en: { fresh: 'fresh yeast', activeDry: 'active dry yeast', dry: 'instant dry yeast' },
      de: { fresh: 'Frischhefe', activeDry: 'Aktiv-Trockenhefe', dry: 'Instant-Trockenhefe' },
      sl: { fresh: 'svežega kvasa', activeDry: 'aktivnega suhega kvasa', dry: 'instant suhega kvasa' },
    }[lang][yeastType])}`,
    ...(recipe.saltGrams > 0
      ? [`${recipe.formatWeight(recipe.saltGrams, true)} ${({ hr: 'soli', en: 'salt', de: 'Salz', sl: 'soli' }[lang])}`]
      : []),
    ...(hasOil && recipe.oilGrams > 0
      ? [`${recipe.formatWeight(recipe.oilGrams)} ${({ hr: 'ulja', en: 'oil', de: 'Öl', sl: 'olja' }[lang])}`]
      : []),
    ...(recipe.psylliumGrams && recipe.psylliumGrams > 0
      ? [`${recipe.formatWeight(recipe.psylliumGrams, true)} ${({ hr: 'psylliuma', en: 'psyllium husk', de: 'Flohsamenschalen', sl: 'psylliuma' }[lang])}`]
      : []),
  ];
  const format = (grams: number, precise = false) => recipe.formatWeight(grams, precise);
  const initialWater = format(split.initialLiquidWaterGrams);
  const remainingWater = format(split.remainingLiquidWaterGrams);
  const hasPsyllium = (recipe.psylliumGrams ?? 0) > 0;
  const prefermentName = method === 'biga'
    ? ({ hr: 'Bigu', en: 'Biga', de: 'Biga', sl: 'Bigo' }[lang])
    : ({ hr: 'Poolish', en: 'Poolish', de: 'Poolish', sl: 'Poolish' }[lang]);
  const copy = ({
    hr: {
      prepare: 'Pripremite spiralni mikser i čistu posudu; provjerite da je posuda pravilno učvršćena.',
      measure: (items: string) => `Odvažite sastojke za ovu fazu: ${items}.`,
      yeast: {
        fresh: (amount: string) => `Svježi kvasac (${amount}) otopite u manjem dijelu početne tekuće vode; tu vodu uračunajte samo jednom u izmjerenu početnu porciju.`,
        activeDry: (amount: string) => `Aktivni suhi kvasac (${amount}) pripremite u manjem dijelu izmjerene tekuće vode prema uputama na pakiranju; tu vodu uračunajte u početnu porciju.`,
        dry: (amount: string) => `Instant suhi kvasac (${amount}) ravnomjerno umiješajte u brašno; nemojte ga otapati zasebno.`,
      },
      directStart: (water: string, pct: number) => `Dodajte brašno i početnih ${water} (${pct}% izmjerene tekuće vode) zajedno s otopinom kvasca ako je pripremljena; ako koristite instant kvasac, dodajte izmjerenu početnu vodu brašnu s kvascem.`,
      bigaStart: (water: string, pct: number) => `Zrelu ${prefermentName} natrgajte na manje komade u posudi, dodajte preostalo brašno i početnih ${water} (${pct}% tekuće vode za završni zamjes), uključujući otopinu kvasca ako je pripremljena.`,
      poolishStart: (water: string, pct: number) => `Ulijte zreli Poolish u posudu, dodajte preostalo brašno i početnih ${water} (${pct}% tekuće vode za završni zamjes), uključujući otopinu kvasca ako je pripremljena.`,
      psyllium: (amount: string) => `U brašno ravnomjerno umiješajte ${amount} psylliuma prije početnog miješanja; psyllium ne dodaje dodatnu vodu.`,
      addWater: (water: string) => `Kad se početna smjesa poveže, postupno dodajte preostalih ${water} tekuće vode; pustite da se svaki dio upije prije sljedećeg.`,
      salt: (amount: string) => `Kad se početna voda gotovo upije, dodajte ${amount} soli kao zaseban korak.`,
      mix: {
        standard: 'Pokrenite na niskoj prikladnoj brzini i mijesite dok tijesto ne postane glatko, elastično i počne se prikladno odvajati od stijenki posude.',
        manitoba: 'Počnite na niskoj prikladnoj brzini i mijesite dok tijesto ne razvije snažnu, glatku i elastičnu strukturu; pratite temperaturu umjesto fiksnog trajanja.',
        spelt: 'Miješajte kratko na niskoj do umjerenoj brzini, samo dok tijesto ne postane povezano i ujednačeno. Pir ima osjetljiviju strukturu; nemojte ga premijesiti.',
        wholeWheat: 'Miješajte na niskoj do umjerenoj brzini dok se tijesto ne poveže i zadrži strukturu. Mekinje mogu oslabiti gluten; izbjegavajte dugo ili agresivno miješanje.',
        glutenFree: 'Miješajte samo na najnižoj prikladnoj brzini dok ne nestanu suhi dijelovi i smjesa ne postane homogena i ljepljiva. Bezglutensko tijesto ne mijesite radi razvoja glutena.',
      },
      oil: (amount: string) => `Pred kraj dodajte ${amount} ulja i nastavite samo dok ga tijesto potpuno ne upije.`,
      finish: (includeOil: boolean) => includeOil
        ? 'Zaustavite spiralni mikser kad tijesto dosegne opisanu strukturu i potpuno upije ulje.'
        : 'Zaustavite spiralni mikser kad tijesto dosegne opisanu strukturu.',
      targetTemp: (temperature: number) => `Provjerite ciljnu završnu temperaturu tijesta od približno ${temperature} °C.`,
      rest: (minutes: number) => `Pokrijte tijesto i ostavite ga da odmori ${minutes} minuta u posudi; to je postojeći odmor recepta, ne dodatno fermentacijsko vrijeme.`,
    },
    en: {
      prepare: 'Prepare the spiral mixer and clean bowl; make sure the bowl is securely fitted.',
      measure: (items: string) => `Weigh the ingredients for this stage: ${items}.`,
      yeast: {
        fresh: (amount: string) => `Dissolve the fresh yeast (${amount}) in a small part of the initial liquid water; count that water once within the measured initial portion.`,
        activeDry: (amount: string) => `Prepare the active dry yeast (${amount}) in a small part of the measured liquid water according to the package directions; count that water within the initial portion.`,
        dry: (amount: string) => `Mix the instant dry yeast (${amount}) evenly into the flour; do not dissolve it separately.`,
      },
      directStart: (water: string, pct: number) => `Add the flour and initial ${water} (${pct}% of measured liquid water), including the yeast solution if prepared; with instant yeast, add the measured initial water to the flour and yeast.`,
      bigaStart: (water: string, pct: number) => `Tear the mature ${prefermentName} into small pieces in the bowl, add the remaining flour and initial ${water} (${pct}% of final-dough liquid water), including the yeast solution if prepared.`,
      poolishStart: (water: string, pct: number) => `Pour the mature Poolish into the bowl, add the remaining flour and initial ${water} (${pct}% of final-dough liquid water), including the yeast solution if prepared.`,
      psyllium: (amount: string) => `Distribute ${amount} of psyllium husk through the flour before the initial mix; psyllium does not add extra water.`,
      addWater: (water: string) => `Once the initial mixture comes together, gradually add the remaining ${water} liquid water, letting each addition absorb before adding the next.`,
      salt: (amount: string) => `When the initial water is almost absorbed, add ${amount} salt as a separate step.`,
      mix: {
        standard: 'Start at a low suitable speed and mix until the dough is smooth, elastic, and begins to release appropriately from the bowl.',
        manitoba: 'Start at a low suitable speed and mix to a strong, smooth, elastic structure; monitor dough temperature rather than relying on a fixed duration.',
        spelt: 'Mix briefly at low to medium speed, only until the dough is cohesive and even. Spelt has a more fragile structure; do not overmix.',
        wholeWheat: 'Mix at low to medium speed until the dough is cohesive and holds its structure. Bran can weaken gluten; avoid long or aggressive mixing.',
        glutenFree: 'Mix only at the lowest suitable speed until no dry patches remain and the mixture is homogeneous and sticky. Do not knead gluten-free dough to develop gluten.',
      },
      oil: (amount: string) => `Add ${amount} oil near the end and continue only until the dough has fully absorbed it.`,
      finish: (includeOil: boolean) => includeOil
        ? 'Stop the spiral mixer once the described structure is reached and the oil is fully absorbed.'
        : 'Stop the spiral mixer once the described structure is reached.',
      targetTemp: (temperature: number) => `Check for the target final dough temperature of about ${temperature} °C.`,
      rest: (minutes: number) => `Cover the dough and let it rest in the bowl for ${minutes} minutes; this is the recipe's existing rest, not extra fermentation time.`,
    },
    de: {
      prepare: 'Bereiten Sie den Spiralkneter und eine saubere Schüssel vor; prüfen Sie den sicheren Sitz der Schüssel.',
      measure: (items: string) => `Wiegen Sie die Zutaten für diese Phase ab: ${items}.`,
      yeast: {
        fresh: (amount: string) => `Lösen Sie die Frischhefe (${amount}) in einem kleinen Teil des anfänglichen flüssigen Wassers auf; dieses Wasser nur einmal zur abgemessenen Anfangsportion zählen.`,
        activeDry: (amount: string) => `Bereiten Sie die Aktiv-Trockenhefe (${amount}) gemäß Packungsanleitung in einem kleinen Teil des abgemessenen flüssigen Wassers vor; dieses Wasser zur Anfangsportion zählen.`,
        dry: (amount: string) => `Mischen Sie die Instant-Trockenhefe (${amount}) gleichmäßig unter das Mehl; nicht separat auflösen.`,
      },
      directStart: (water: string, pct: number) => `Geben Sie das Mehl und die anfänglichen ${water} (${pct}% des abgemessenen flüssigen Wassers) dazu, einschließlich der Hefelösung, falls vorbereitet; bei Instanthefe das abgemessene Anfangswasser zum Mehl mit Hefe geben.`,
      bigaStart: (water: string, pct: number) => `Zerteilen Sie die reife ${prefermentName} in kleine Stücke in der Schüssel, geben Sie das restliche Mehl und die anfänglichen ${water} (${pct}% des flüssigen Wassers für den Hauptteig) dazu, einschließlich der Hefelösung, falls vorbereitet.`,
      poolishStart: (water: string, pct: number) => `Gießen Sie den reifen Poolish in die Schüssel, geben Sie das restliche Mehl und die anfänglichen ${water} (${pct}% des flüssigen Wassers für den Hauptteig) dazu, einschließlich der Hefelösung, falls vorbereitet.`,
      psyllium: (amount: string) => `Verteilen Sie ${amount} Flohsamenschalen vor dem ersten Mischen gleichmäßig im Mehl; Flohsamenschalen bringen kein zusätzliches Wasser ein.`,
      addWater: (water: string) => `Sobald sich die Anfangsmischung verbindet, die übrigen ${water} flüssiges Wasser nach und nach zugeben und jede Zugabe erst aufnehmen lassen.`,
      salt: (amount: string) => `Wenn das Anfangswasser fast aufgenommen ist, ${amount} Salz als separaten Schritt zugeben.`,
      mix: {
        standard: 'Beginnen Sie mit einer niedrigen geeigneten Stufe und kneten Sie, bis der Teig glatt und elastisch ist und sich angemessen von der Schüsselwand zu lösen beginnt.',
        manitoba: 'Beginnen Sie mit einer niedrigen geeigneten Stufe und kneten Sie bis zu einer kräftigen, glatten, elastischen Struktur; überwachen Sie die Teigtemperatur statt einer festen Zeit.',
        spelt: 'Kurz bei niedriger bis mittlerer Geschwindigkeit mischen, nur bis der Teig verbunden und gleichmäßig ist. Dinkel hat eine empfindlichere Struktur; nicht überkneten.',
        wholeWheat: 'Bei niedriger bis mittlerer Geschwindigkeit mischen, bis der Teig verbunden ist und seine Struktur hält. Kleie kann das Gluten schwächen; langes oder aggressives Mischen vermeiden.',
        glutenFree: 'Nur auf der niedrigsten geeigneten Stufe mischen, bis keine trockenen Stellen mehr vorhanden sind und eine homogene, klebrige Masse entsteht. Glutenfreien Teig nicht zur Glutenentwicklung kneten.',
      },
      oil: (amount: string) => `Gegen Ende ${amount} Öl zugeben und nur weiter mischen, bis der Teig es vollständig aufgenommen hat.`,
      finish: (includeOil: boolean) => includeOil
        ? 'Stoppen Sie den Spiralkneter, sobald die beschriebene Struktur erreicht und das Öl vollständig aufgenommen ist.'
        : 'Stoppen Sie den Spiralkneter, sobald die beschriebene Struktur erreicht ist.',
      targetTemp: (temperature: number) => `Prüfen Sie die angestrebte Endteigtemperatur von etwa ${temperature} °C.`,
      rest: (minutes: number) => `Decken Sie den Teig ab und lassen Sie ihn ${minutes} Minuten in der Schüssel ruhen; dies ist die vorhandene Ruhezeit des Rezepts und keine zusätzliche Fermentationszeit.`,
    },
    sl: {
      prepare: 'Pripravite spiralni mešalnik in čisto posodo; preverite, da je posoda varno nameščena.',
      measure: (items: string) => `Odtehtajte sestavine za to fazo: ${items}.`,
      yeast: {
        fresh: (amount: string) => `Sveži kvas (${amount}) raztopite v manjšem delu začetne tekoče vode; to vodo samo enkrat vštejte v odmerjeni začetni del.`,
        activeDry: (amount: string) => `Aktivni suhi kvas (${amount}) pripravite v manjšem delu odmerjene tekoče vode po navodilih na embalaži; to vodo vštejte v začetni del.`,
        dry: (amount: string) => `Instant suhi kvas (${amount}) enakomerno vmešajte v moko; ne raztapljajte ga posebej.`,
      },
      directStart: (water: string, pct: number) => `Dodajte moko in začetnih ${water} (${pct}% odmerjene tekoče vode), vključno z raztopino kvasa, če ste jo pripravili; pri instant kvasu odmerjeno začetno vodo dodajte moki s kvasom.`,
      bigaStart: (water: string, pct: number) => `Zrelo bigo natrgajte na manjše kose v posodi, dodajte preostalo moko in začetnih ${water} (${pct}% tekoče vode za končno testo), vključno z raztopino kvasa, če ste jo pripravili.`,
      poolishStart: (water: string, pct: number) => `Zreli Poolish prelijte v posodo, dodajte preostalo moko in začetnih ${water} (${pct}% tekoče vode za končno testo), vključno z raztopino kvasa, če ste jo pripravili.`,
      psyllium: (amount: string) => `Pred začetnim mešanjem enakomerno vmešajte ${amount} psylliuma v moko; psyllium ne pomeni dodatne vode.`,
      addWater: (water: string) => `Ko se začetna zmes poveže, postopoma dodajte preostalih ${water} tekoče vode; vsak del naj se vpije, preden dodate naslednjega.`,
      salt: (amount: string) => `Ko je začetna voda skoraj vpita, dodajte ${amount} soli kot ločen korak.`,
      mix: {
        standard: 'Začnite pri nizki primerni hitrosti in mešajte, dokler testo ni gladko, elastično ter se začne primerno ločevati od stene posode.',
        manitoba: 'Začnite pri nizki primerni hitrosti in mešajte do močne, gladke in elastične strukture; spremljajte temperaturo testa namesto fiksnega časa.',
        spelt: 'Kratko mešajte pri nizki do srednji hitrosti, samo dokler testo ni povezano in enakomerno. Pir ima občutljivejšo strukturo; ne premešajte ga.',
        wholeWheat: 'Mešajte pri nizki do srednji hitrosti, dokler se testo ne poveže in ohrani strukturo. Otrobi lahko oslabijo gluten; izogibajte se dolgemu ali agresivnemu mešanju.',
        glutenFree: 'Mešajte samo pri najnižji primerni hitrosti, dokler ne izginejo suhi deli in zmes ne postane homogena in lepljiva. Brezglutenskega testa ne gnetite za razvoj glutena.',
      },
      oil: (amount: string) => `Proti koncu dodajte ${amount} olja in nadaljujte samo, dokler ga testo popolnoma ne vpije.`,
      finish: (includeOil: boolean) => includeOil
        ? 'Spiralni mešalnik ustavite, ko testo doseže opisano strukturo in popolnoma vpije olje.'
        : 'Spiralni mešalnik ustavite, ko testo doseže opisano strukturo.',
      targetTemp: (temperature: number) => `Preverite ciljno končno temperaturo testa, približno ${temperature} °C.`,
      rest: (minutes: number) => `Testo pokrijte in ga pustite počivati ${minutes} minut v posodi; to je obstoječi počitek recepta, ne dodatni čas fermentacije.`,
    },
  }[lang]);
  const yeastAmount = format(recipe.yeastGrams, true);
  const firstMix = method === 'direct'
    ? copy.directStart(initialWater, recipe.initialWaterPct)
    : method === 'biga'
      ? copy.bigaStart(initialWater, recipe.initialWaterPct)
      : copy.poolishStart(initialWater, recipe.initialWaterPct);

  if (
    ![
      recipe.flourGrams,
      recipe.waterBaseGrams,
      recipe.liquidWaterGrams,
      recipe.iceGrams,
      recipe.yeastGrams,
      recipe.saltGrams,
      recipe.oilGrams,
      recipe.psylliumGrams ?? 0,
      recipe.restMinutes ?? 0,
      recipe.targetDoughTemperature ?? 0,
    ].every(Number.isFinite)
    || [
      recipe.flourGrams,
      recipe.waterBaseGrams,
      recipe.liquidWaterGrams,
      recipe.iceGrams,
      recipe.yeastGrams,
      recipe.saltGrams,
      recipe.oilGrams,
      recipe.psylliumGrams ?? 0,
      recipe.restMinutes ?? 0,
    ].some((amount) => amount < 0)
    || (method !== 'direct' && (!Number.isFinite(recipe.prefermentGrams) || (recipe.prefermentGrams ?? 0) <= 0))
    || (recipe.flourBehavior === 'glutenFree' && !(recipe.psylliumGrams && recipe.psylliumGrams > 0))
    || (recipe.flourBehavior !== 'glutenFree' && (recipe.psylliumGrams ?? 0) > 0)
    || (hasOil !== (recipe.oilGrams > 0))
  ) {
    throw new RangeError('Invalid PRO spiral-mixing recipe details.');
  }

  const steps = [
    copy.prepare,
    copy.measure(amounts.join(', ')),
    copy.yeast[yeastType](yeastAmount),
    ...(hasPsyllium ? [copy.psyllium(format(recipe.psylliumGrams!, true))] : []),
    firstMix,
    ...(split.remainingLiquidWaterGrams > 0 ? [copy.addWater(remainingWater)] : []),
    ...(recipe.saltGrams > 0 ? [copy.salt(format(recipe.saltGrams, true))] : []),
    copy.mix[recipe.flourBehavior],
    ...(hasOil ? [copy.oil(format(recipe.oilGrams))] : []),
    ...(recipe.targetDoughTemperature && recipe.targetDoughTemperature > 0
      ? [copy.targetTemp(recipe.targetDoughTemperature)]
      : []),
    copy.finish(hasOil),
    ...(recipe.restMinutes && recipe.restMinutes > 0 ? [copy.rest(recipe.restMinutes)] : []),
  ];
  return steps;
}

function getProMixingStepInfo(
  lang: Lang,
  recipe: SpiralMixingRecipe,
  sourceSteps?: readonly string[],
  equipment: 'homeMixer' | 'spiralMixer' = 'spiralMixer',
): SpiralMixingStepInfoList {
  const info: SpiralMixingStepInfoList = [];
  const blendDescription = recipe.flourBlendDescription?.trim();
  const isGlutenFree = recipe.flourBehavior === 'glutenFree';
  const speedInfo: SpiralMixingStepInfo = {
    title: {
      hr: equipment === 'homeMixer' ? 'Brzina kućnog miksera' : 'Brzina spiralnog miksera',
      en: equipment === 'homeMixer' ? 'Home mixer speed' : 'Spiral mixer speed',
      de: equipment === 'homeMixer' ? 'Geschwindigkeit des Haushaltsmixers' : 'Geschwindigkeit des Spiralkneters',
      sl: equipment === 'homeMixer' ? 'Hitrost domačega mešalnika' : 'Hitrost spiralnega mešalnika',
    }[lang],
    body: {
      hr: equipment === 'homeMixer'
        ? 'Započnite zamjes na niskoj brzini. Višu brzinu koristite tek kada se sastojci povežu i ako je dopuštena za vaš kućni mikser. Brzinu i trajanje prilagodite uputama proizvođača.'
        : 'Započnite zamjes na niskoj brzini. Višu brzinu koristite tek kada se sastojci povežu i ako je dopuštena za vaš mikser. Brzinu i trajanje prilagodite uputama proizvođača.',
      en: equipment === 'homeMixer'
        ? 'Start mixing at a low speed. Use a higher speed only after the ingredients have come together and if your home mixer permits it. Adjust speed and duration according to the manufacturer’s instructions.'
        : 'Start mixing at a low speed. Use a higher speed only after the ingredients have come together and if your mixer permits it. Adjust speed and duration according to the manufacturer’s instructions.',
      de: equipment === 'homeMixer'
        ? 'Beginnen Sie mit niedriger Geschwindigkeit. Verwenden Sie eine höhere Stufe erst, wenn sich die Zutaten verbunden haben und Ihr Haushaltsmixer dies zulässt. Passen Sie Geschwindigkeit und Dauer gemäß den Herstellerangaben an.'
        : 'Beginnen Sie mit niedriger Geschwindigkeit. Verwenden Sie eine höhere Stufe erst, wenn sich die Zutaten verbunden haben und Ihr Spiralkneter dies zulässt. Passen Sie Geschwindigkeit und Dauer gemäß den Herstellerangaben an.',
      sl: equipment === 'homeMixer'
        ? 'Zames začnite pri nizki hitrosti. Višjo hitrost uporabite šele, ko se sestavine povežejo, in samo, če jo domači mešalnik dovoljuje. Hitrost in trajanje prilagodite navodilom proizvajalca.'
        : 'Zames začnite pri nizki hitrosti. Višjo hitrost uporabite šele, ko se sestavine povežejo, in samo, če jo mešalnik dovoljuje. Hitrost in trajanje prilagodite navodilom proizvajalca.',
    }[lang],
  };
  const doughTemperatureInfo: SpiralMixingStepInfo = {
    title: {
      hr: 'Temperatura tijesta',
      en: 'Dough temperature',
      de: 'Teigtemperatur',
      sl: 'Temperatura testa',
    }[lang],
    body: {
      hr: 'Tijekom zamjesa pratite temperaturu tijesta. Ako se tijesto previše zagrijava, prilagodite postupak kako biste izbjegli prekomjerno zagrijavanje. Ciljnu temperaturu koristite samo ako je izračunata ili definirana postojećim receptom.',
      en: 'Monitor the dough temperature while mixing. If the dough heats up too much, adjust the process to avoid excessive warming. Use a target temperature only if it is calculated or defined by the existing recipe.',
      de: 'Überwachen Sie während des Knetens die Teigtemperatur. Wenn sich der Teig zu stark erwärmt, passen Sie den Ablauf an, um eine übermäßige Erwärmung zu vermeiden. Verwenden Sie eine Zieltemperatur nur, wenn sie berechnet oder im bestehenden Rezept festgelegt ist.',
      sl: 'Med gnetenjem spremljajte temperaturo testa. Če se testo preveč segreva, prilagodite postopek, da preprečite prekomerno segrevanje. Ciljno temperaturo uporabite samo, če je izračunana ali določena v obstoječem receptu.',
    }[lang],
  };

  const flourInfo = blendDescription ? {
    title: {
      hr: 'Mješavina brašna',
      en: 'Flour blend',
      de: 'Mehlmischung',
      sl: 'Mešanica moke',
    }[lang],
    body: {
      hr: `Odabrana mješavina sadrži ukupno ${recipe.formatWeight(recipe.flourGrams)} brašna: ${blendDescription}. Prije zamjesa ravnomjerno rasporedite sve komponente brašna.`,
      en: `The selected blend contains ${recipe.formatWeight(recipe.flourGrams)} total flour: ${blendDescription}. Distribute all flour components evenly before mixing.`,
      de: `Die ausgewählte Mischung enthält insgesamt ${recipe.formatWeight(recipe.flourGrams)} Mehl: ${blendDescription}. Verteilen Sie alle Mehlbestandteile vor dem Kneten gleichmäßig.`,
      sl: `Izbrana mešanica vsebuje skupaj ${recipe.formatWeight(recipe.flourGrams)} moke: ${blendDescription}. Pred gnetenjem vse sestavine moke enakomerno premešajte.`,
    }[lang],
  } satisfies SpiralMixingStepInfo : undefined;
  const glutenFreeInfo = isGlutenFree ? {
    title: {
      hr: 'Bezglutensko tijesto',
      en: 'Gluten-free dough',
      de: 'Glutenfreier Teig',
      sl: 'Brezglutensko testo',
    }[lang],
    body: {
      hr: 'Bezglutensko tijesto ne razvija tradicionalnu glutensku mrežu. Slijedite upute za miješanje i hidrataciju specifične za ovaj recept; zadržite propisanu količinu psylliuma iz recepta.',
      en: 'Gluten-free dough does not form a traditional gluten network. Follow this recipe’s specific mixing and hydration instructions, including its listed psyllium requirement.',
      de: 'Glutenfreier Teig bildet kein herkömmliches Glutennetz. Befolgen Sie die rezeptbezogenen Misch- und Hydratationsanweisungen sowie die angegebene Psylliummenge.',
      sl: 'Brezglutensko testo ne razvije običajne glutenske mreže. Upoštevajte navodila za gnetenje in hidracijo za ta recept ter predpisano količino psylliuma.',
    }[lang],
  } satisfies SpiralMixingStepInfo : undefined;

  const flourInfoItems = [flourInfo, glutenFreeInfo].filter((item): item is SpiralMixingStepInfo => item !== undefined);
  if (sourceSteps !== undefined) {
    const info: SpiralMixingStepInfoList = [];
    const setInfo = (index: number, item: SpiralMixingStepInfo) => {
      const existing = info[index];
      info[index] = existing === undefined
        ? [item]
        : [...(Array.isArray(existing) ? existing : [existing]), item];
    };
    const flourPreparationIndex = sourceSteps.findIndex((step) => /flour|brašn|mehl|mok[aeio]/i.test(step));
    if (flourInfoItems.length > 0) {
      if (flourPreparationIndex < 0) throw new Error('PRO spiral-mixing flour preparation step is missing from the displayed phase.');
      info[flourPreparationIndex] = flourInfoItems;
    }
    const speedPatterns = {
      hr: /brzin|sporoj brzini|miješ(?:ajte|ati|a)|mijes(?:ite|iti)|pokrenite mikser/i,
      en: /\bspeed\s*\d|(?:mix|mixer).*(?:low|slow|speed)|\b(?:mix|mixing)\s+(?:at|on)\s+(?:a )?(?:low|slow)/i,
      de: /Stufe\s*\d|Geschwindigkeit|(?:Mixer|Kneter).*(?:Stufe|langsam)|(?:mischen|kneten).*(?:Stufe|Geschwindigkeit)/i,
      sl: /hitrost|pri nizki|meš(?:ajte|ati|a).*(?:mešalnik|hitrost)|zaženite mešalnik/i,
    }[lang];
    const speedIndex = sourceSteps.findIndex((step) => speedPatterns.test(step));
    if (speedIndex >= 0) setInfo(speedIndex, speedInfo);
    let mixingEndIndex = -1;
    const mixingEndPattern = {
      hr: /miješ|mijes|gnet|upij|glatko|elastič/i,
      en: /\bmix(?:ing)?\b|\bknead(?:ing)?\b|\babsorb(?:s|ed|ing)?\b|\bsmooth\b|\belastic\b/i,
      de: /\bmisch(?:en|t|te|end)?\b|\bknet(?:en|et|ete|end)?\b|\baufnehm\w*\b|\bstopp\w*\b|\bglatt\b|\belastisch\b/i,
      sl: /meš(?:ajte|ati|a|ajo|eno)|gnet|vpij|gladk|elastič/i,
    }[lang];
    sourceSteps.forEach((step, index) => {
      if (mixingEndPattern.test(step)) mixingEndIndex = index;
    });
    if (mixingEndIndex >= 0) setInfo(mixingEndIndex, doughTemperatureInfo);
    return info;
  }
  if (flourInfoItems.length > 0) info[1] = flourInfoItems;

  const split = calculateProWaterSplit({
    waterBaseGrams: recipe.waterBaseGrams,
    liquidWaterGrams: recipe.liquidWaterGrams,
    iceGrams: recipe.iceGrams,
    initialWaterPct: recipe.initialWaterPct,
  });
  let nextStepIndex = 3 + Number(isGlutenFree) + 1;
  if (split.remainingLiquidWaterGrams > 0) nextStepIndex += 1;
  if (recipe.saltGrams > 0) nextStepIndex += 1;
  info[nextStepIndex] = [speedInfo];

  nextStepIndex += 1;
  if (recipe.oilGrams > 0) nextStepIndex += 1;
  if (recipe.targetDoughTemperature && recipe.targetDoughTemperature > 0) nextStepIndex += 1;
  info[nextStepIndex] = [doughTemperatureInfo];
  return info;
}

export function getProSpiralMixingStepInfo(
  lang: Lang,
  recipe: SpiralMixingRecipe,
  sourceSteps?: readonly string[],
): SpiralMixingStepInfoList {
  return getProMixingStepInfo(lang, recipe, sourceSteps, 'spiralMixer');
}

export function getProHomeMixerStepInfo(
  lang: Lang,
  recipe: SpiralMixingRecipe,
  sourceSteps?: readonly string[],
): SpiralMixingStepInfoList {
  return getProMixingStepInfo(lang, recipe, sourceSteps, 'homeMixer');
}

export function getSpiralMixingSteps(
  lang: Lang,
  yeastType: PreferredYeastType,
  context: SpiralMixingContext,
): string[] {
  if (context.recipe) {
    return getDetailedProSpiralMixingSteps(lang, yeastType, context, context.recipe);
  }
  const hrDirectYeastWaterStep = context.method === 'direct' && typeof context.directInitialWaterGrams === 'number' && typeof context.directInitialWaterPct === 'number'
    ? `U približno ${context.directInitialWaterPct}% vode, odnosno ${context.directInitialWaterGrams} g, otopite kvasac.`
    : null;
  const psyllium = context.method === 'direct' ? context.psyllium : undefined;

  const text = {
    hr: {
      bowl: context.method === 'direct'
        ? 'U posudu spiralnog miksera stavite brašno.'
        : `U posudu spiralnog miksera stavite zrelu ${context.method === 'biga' ? 'Bigu' : 'Poolish'}, zatim preostalo brašno${context.method === 'biga' && context.remainingFlourDescription ? ` (${context.remainingFlourDescription})` : ''}.`,
      yeast: context.method === 'direct' && hrDirectYeastWaterStep
        ? hrDirectYeastWaterStep
        : yeastType === 'fresh'
          ? 'Upotrijebite količinu svježeg kvasca navedenu u sastojcima; ravnomjerno ga izmrvite po brašnu ili otopite u manjem dijelu izmjerene vode.'
        : yeastType === 'activeDry'
          ? 'Upotrijebite količinu aktivnog suhog kvasca navedenu u sastojcima i pripremite ga prema uputama na pakiranju u dijelu izmjerene vode; tu vodu uračunajte u ukupnu količinu.'
          : 'Upotrijebite količinu instant suhog kvasca navedenu u sastojcima i ravnomjerno ga umiješajte u brašno.',
      water: psyllium
        ? `Sačuvajte preostalu izmjerenu vodu za postupno dodavanje; prva porcija (${psyllium.initialWaterPct}%, odnosno ${psyllium.initialWaterGrams} g) već je uključena u ukupnu količinu.`
        : 'Odvojite dio izmjerene vode, a ostatak dodajte brašnu i sastojcima u posudi.',
      psyllium: psyllium
        ? `U tu prvu porciju vode umiješajte ${psyllium.amount} psyllium ljuskica i povežite ih s bezglutenskim brašnom u posudi. To je ista izmjerena voda; nemojte je dodavati ponovno.`
        : '',
      mix: psyllium
        ? 'Pokrenite mikser prema uputama proizvođača na najnižoj prikladnoj brzini i miješajte samo dok ne nestanu suhi dijelovi.'
        : 'Pokrenite mikser prema uputama proizvođača. Brzina i trajanje ovise o konkretnom mikseru.',
      addWater: psyllium
        ? 'Kad se početna smjesa počne povezivati, postupno dodajte samo preostalu izmjerenu vodu.'
        : 'Kad se tijesto počne povezivati i upijati vodu, postupno dodajte sačuvanu vodu.',
      salt: 'Kad se brašno navlaži i tijesto počne povezivati, dodajte sol.',
      oil: 'Ako recept sadrži ulje, dodajte ga pri kraju i pričekajte da ga tijesto upije.',
      finish: psyllium
        ? 'Miješajte samo dok se sastojci ne povežu u homogenu, ljepljivu masu; bezglutensko tijesto ne mijesite radi razvoja glutena. Brzinu i trajanje zamjesa odredite prema priručniku miksera.'
        : 'Za brzinu i trajanje zamjesa slijedite priručnik konkretnog miksera; ne postoji jedna postavka koja vrijedi za sve modele.',
    },
    en: {
      bowl: context.method === 'direct'
        ? 'Place the flour in the spiral mixer bowl.'
        : `Place the mature ${context.method === 'biga' ? 'Biga' : 'Poolish'} and then the remaining flour${context.method === 'biga' && context.remainingFlourDescription ? ` (${context.remainingFlourDescription})` : ''} in the spiral mixer bowl.`,
      yeast: yeastType === 'fresh'
        ? 'Use the fresh-yeast amount shown in the ingredients; crumble it evenly through the flour or dissolve it in a small part of the measured water.'
        : yeastType === 'activeDry'
          ? 'Use the active-dry-yeast amount shown in the ingredients and prepare it in part of the measured water according to the package directions; count that water toward the total.'
          : 'Use the instant-dry-yeast amount shown in the ingredients and mix it evenly into the flour.',
      water: psyllium
        ? `Reserve the remaining measured water for gradual addition; the initial portion (${psyllium.initialWaterPct}% or ${psyllium.initialWaterGrams} g) is already included in the recipe total.`
        : 'Set aside part of the measured water; add the rest to the flour and ingredients in the bowl.',
      psyllium: psyllium
        ? `Add the listed ${psyllium.amount} of psyllium husk to that same initial water portion and combine it with the gluten-free flour in the bowl. This water is already counted; do not add it again.`
        : '',
      mix: psyllium
        ? 'Start the mixer according to its manufacturer instructions at the lowest suitable speed; mix only until no dry patches remain.'
        : 'Start the mixer according to its manufacturer instructions. Speed and mixing time depend on the specific mixer.',
      addWater: psyllium
        ? 'As the initial mixture starts to come together, gradually add only the remaining measured water.'
        : 'As the dough starts to come together and absorb water, add the reserved water gradually.',
      salt: 'Once the flour is hydrated and the dough begins to come together, add the salt.',
      oil: 'If the recipe contains oil, add it near the end and let the dough absorb it.',
      finish: psyllium
        ? 'Mix only until the ingredients form a homogeneous, sticky mass; do not knead gluten-free dough to develop gluten. Follow the mixer manual for speed and mixing time.'
        : 'Follow the specific mixer manual for speed and mixing time; there is no single setting that applies to every model.',
    },
    de: {
      bowl: context.method === 'direct'
        ? 'Geben Sie das Mehl in die Schüssel des Spiralkneters.'
        : `Geben Sie den reifen ${context.method === 'biga' ? 'Biga' : 'Poolish'} und anschließend das restliche Mehl${context.method === 'biga' && context.remainingFlourDescription ? ` (${context.remainingFlourDescription})` : ''} in die Schüssel des Spiralkneters.`,
      yeast: yeastType === 'fresh'
        ? 'Die in den Zutaten angegebene Frischhefemenge verwenden; gleichmäßig über das Mehl bröseln oder in einem kleinen Teil des abgemessenen Wassers auflösen.'
        : yeastType === 'activeDry'
          ? 'Die in den Zutaten angegebene Aktiv-Trockenhefemenge verwenden und nach Packungsanleitung in einem Teil des abgemessenen Wassers vorbereiten; dieses Wasser zur Gesamtmenge zählen.'
          : 'Die in den Zutaten angegebene Instant-Trockenhefemenge verwenden und gleichmäßig unter das Mehl mischen.',
      water: psyllium
        ? `Halten Sie das restliche abgemessene Wasser zur schrittweisen Zugabe zurück; die erste Portion (${psyllium.initialWaterPct} % bzw. ${psyllium.initialWaterGrams} g) ist bereits in der Gesamtmenge enthalten.`
        : 'Einen Teil des abgemessenen Wassers zurückhalten; den Rest zu Mehl und Zutaten in der Schüssel geben.',
      psyllium: psyllium
        ? `Rühren Sie die angegebenen ${psyllium.amount} Flohsamenschalen in dieselbe erste Wasserportion und verbinden Sie sie mit dem glutenfreien Mehl in der Schüssel. Dieses Wasser ist bereits eingerechnet; geben Sie es nicht erneut hinzu.`
        : '',
      mix: psyllium
        ? 'Starten Sie den Kneter gemäß Herstelleranleitung auf der niedrigsten geeigneten Stufe und mischen Sie nur, bis keine trockenen Stellen mehr vorhanden sind.'
        : 'Den Kneter nach Herstellerangaben starten. Geschwindigkeit und Knetdauer hängen vom jeweiligen Gerät ab.',
      addWater: psyllium
        ? 'Sobald sich die Anfangsmischung verbindet, das restliche abgemessene Wasser nach und nach zugeben.'
        : 'Sobald sich der Teig verbindet und Wasser aufnimmt, das zurückgehaltene Wasser nach und nach zugeben.',
      salt: 'Sobald das Mehl befeuchtet ist und der Teig beginnt, sich zu verbinden, das Salz zugeben.',
      oil: 'Wenn das Rezept Öl enthält, dieses gegen Ende zugeben und vom Teig aufnehmen lassen.',
      finish: psyllium
        ? 'Mischen Sie nur, bis eine homogene, klebrige Masse entsteht; glutenfreien Teig nicht zur Glutenentwicklung kneten. Geschwindigkeit und Dauer gemäß Geräteanleitung wählen.'
        : 'Geschwindigkeit und Knetdauer gemäß der Anleitung des jeweiligen Kneters einstellen; eine universelle Einstellung gibt es nicht.',
    },
    sl: {
      bowl: context.method === 'direct'
        ? 'Moko dajte v posodo spiralnega mešalnika.'
        : `Zreli ${context.method === 'biga' ? 'bigi' : 'Poolishu'} dodajte preostalo moko${context.method === 'biga' && context.remainingFlourDescription ? ` (${context.remainingFlourDescription})` : ''} v posodo spiralnega mešalnika.`,
      yeast: yeastType === 'fresh'
        ? 'Uporabite količino svežega kvasa iz sestavin; enakomerno ga nadrobite po moki ali raztopite v manjšem delu odmerjene vode.'
        : yeastType === 'activeDry'
          ? 'Uporabite količino aktivnega suhega kvasa iz sestavin in ga pripravite v delu odmerjene vode po navodilih na embalaži; to vodo vštejte v skupno količino.'
          : 'Uporabite količino instant suhega kvasa iz sestavin in ga enakomerno vmešajte v moko.',
      water: psyllium
        ? `Preostalo odmerjeno vodo prihranite za postopno dodajanje; začetni del (${psyllium.initialWaterPct} % oziroma ${psyllium.initialWaterGrams} g) je že vštet v skupno količino.`
        : 'Del odmerjene vode prihranite; preostanek dodajte moki in sestavinam v posodi.',
      psyllium: psyllium
        ? `Navedeno količino psylliuma (${psyllium.amount}) vmešajte v isti začetni del vode in ga povežite z brezglutensko moko v posodi. Ta voda je že všteta; ne dodajajte je ponovno.`
        : '',
      mix: psyllium
        ? 'Mešalnik zaženite po navodilih proizvajalca pri najnižji primerni hitrosti in mešajte samo, dokler ne izginejo suhi deli.'
        : 'Mešalnik zaženite po navodilih proizvajalca. Hitrost in čas gnetenja sta odvisna od konkretnega mešalnika.',
      addWater: psyllium
        ? 'Ko se začetna zmes začne povezovati, postopoma dodajte samo preostalo odmerjeno vodo.'
        : 'Ko se testo začne povezovati in vpijati vodo, postopoma dodajte prihranjeno vodo.',
      salt: 'Ko se moka navlaži in se testo začne povezovati, dodajte sol.',
      oil: 'Če recept vsebuje olje, ga dodajte proti koncu in počakajte, da ga testo vpije.',
      finish: psyllium
        ? 'Mešajte samo, dokler se sestavine ne povežejo v homogeno, lepljivo zmes; brezglutenskega testa ne gnetite za razvoj glutena. Hitrost in čas določite po navodilih mešalnika.'
        : 'Hitrost in čas gnetenja določite po navodilih konkretnega mešalnika; enaka nastavitev ne velja za vse modele.',
    },
  }[lang];

  return [
    text.bowl,
    text.yeast,
    text.water,
    ...(psyllium ? [text.psyllium] : []),
    text.mix,
    text.addWater,
    text.salt,
    ...(context.hasOil ? [text.oil] : []),
    text.finish,
  ];
}

export function getSpiralPlannerNote(lang: Lang): string {
  return ({
    hr: 'Spiralni mikser: vodu dodaj postupno nakon početnog povezivanja; sol dodaj kad se brašno navlaži, a ulje pred kraj samo ako ga recept sadrži. Brzinu i trajanje odredi prema priručniku miksera.',
    en: 'Spiral mixer: add water gradually after the initial mix comes together; add salt once the flour is hydrated, and oil near the end only if the recipe includes it. Follow the mixer manual for speed and duration.',
    de: 'Spiralkneter: Wasser nach dem ersten Verbinden nach und nach zugeben; Salz nach dem Befeuchten des Mehls und Öl gegen Ende nur dann, wenn es im Rezept steht. Geschwindigkeit und Dauer gemäß Geräteanleitung wählen.',
    sl: 'Spiralni mešalnik: vodo postopoma dodajajte, ko se zmes začne povezovati; sol dodajte, ko je moka navlažena, olje pa proti koncu le, če ga recept vsebuje. Hitrost in čas določite po navodilih mešalnika.',
  }[lang]);
}
