import type { Lang } from './translations';

type ProIceWaterMixing = 'hand' | 'mixer' | 'spiral';
type ProIceWaterMethod = 'direct' | 'biga' | 'poolish';

type ProIceWaterInstructionInput = {
  lang: Lang;
  method: ProIceWaterMethod;
  mixing: ProIceWaterMixing;
  waterBaseGrams: number;
  liquidWaterGrams: number;
  iceGrams: number;
  initialWaterPct: 80 | 90;
  formatWeight: (grams: number) => string;
};

export type ProWaterSplit = {
  initialLiquidWaterGrams: number;
  remainingLiquidWaterGrams: number;
};

export function calculateProWaterSplit({
  waterBaseGrams,
  liquidWaterGrams,
  iceGrams,
  initialWaterPct,
}: Pick<ProIceWaterInstructionInput, 'waterBaseGrams' | 'liquidWaterGrams' | 'iceGrams' | 'initialWaterPct'>): ProWaterSplit {
  if (
    ![waterBaseGrams, liquidWaterGrams, iceGrams].every(Number.isFinite)
    || waterBaseGrams < 0
    || liquidWaterGrams < 0
    || iceGrams < 0
    || Math.abs(liquidWaterGrams + iceGrams - waterBaseGrams) > 1
    || (initialWaterPct !== 80 && initialWaterPct !== 90)
  ) {
    throw new RangeError('Invalid PRO ice/water split.');
  }

  const initialLiquidWaterGrams = Math.round(liquidWaterGrams * (initialWaterPct / 100));
  const remainingLiquidWaterGrams = liquidWaterGrams - initialLiquidWaterGrams;
  if (initialLiquidWaterGrams < 0 || remainingLiquidWaterGrams < 0) {
    throw new RangeError('Invalid PRO liquid-water portions.');
  }
  return { initialLiquidWaterGrams, remainingLiquidWaterGrams };
}

export function getProIceWaterInstructions({
  lang,
  method,
  mixing,
  waterBaseGrams,
  liquidWaterGrams,
  iceGrams,
  initialWaterPct,
  formatWeight,
}: ProIceWaterInstructionInput): { step?: string; waterInfo: string } {
  const split = calculateProWaterSplit({ waterBaseGrams, liquidWaterGrams, iceGrams, initialWaterPct });

  if (
    iceGrams <= 0
  ) {
    throw new RangeError('Invalid PRO ice/water split.');
  }

  const total = formatWeight(waterBaseGrams);
  const liquid = formatWeight(liquidWaterGrams);
  const ice = formatWeight(iceGrams);
  const initialLiquidWater = formatWeight(split.initialLiquidWaterGrams);
  const remainingLiquidWater = formatWeight(split.remainingLiquidWaterGrams);
  const waterScope = ({
    hr: method === 'direct' ? 'tekuće vode' : 'tekuće vode za završni zamjes',
    en: method === 'direct' ? 'of measured liquid water' : 'of final-dough liquid water',
    de: method === 'direct' ? 'der abgemessenen flüssigen Wassermenge' : 'der flüssigen Wassermenge für den Hauptteig',
    sl: method === 'direct' ? 'odmerjene tekoče vode' : 'tekoče vode za končno testo',
  }[lang]);
  const waterBaseLabel = ({
    hr: method === 'direct' ? 'Ukupno vode u receptu' : 'Voda za završni zamjes',
    en: method === 'direct' ? 'Total recipe water' : 'Final-dough water',
    de: method === 'direct' ? 'Gesamtwassermenge des Rezepts' : 'Wassermenge für den Hauptteig',
    sl: method === 'direct' ? 'Skupna količina vode v receptu' : 'Voda za končno testo',
  }[lang]);
  const waterInfoBase = ({
    hr: `${method === 'direct' ? 'Ukupna voda recepta' : 'Voda za završni zamjes'}: ${total} ukupnog vodenog ekvivalenta (${liquid} tekuće vode + ${ice} leda). Odmjerite početnih ${initialLiquidWater} tekuće vode (${initialWaterPct}% ${waterScope}) i sačuvajte preostalih ${remainingLiquidWater} tekuće vode. Led zamjenjuje dio ukupne vode i ne dodaje se povrh ${total}.`,
    en: `${method === 'direct' ? 'Total recipe water' : 'Final-dough water'}: ${total} total water equivalent (${liquid} liquid water + ${ice} ice). Measure the initial ${initialLiquidWater} liquid water (${initialWaterPct}% ${waterScope}) and reserve the remaining ${remainingLiquidWater} liquid water. Ice replaces part of the total water and is not added on top of ${total}.`,
    de: `${method === 'direct' ? 'Gesamtwassermenge des Rezepts' : 'Wassermenge für den Hauptteig'}: ${total} Wasserequivalent (${liquid} flüssiges Wasser + ${ice} Eis). Messen Sie zunächst ${initialLiquidWater} flüssiges Wasser ab (${initialWaterPct}% ${waterScope}) und halten Sie die übrigen ${remainingLiquidWater} flüssiges Wasser zurück. Das Eis ersetzt einen Teil der Gesamtwassermenge und wird nicht zusätzlich zu ${total} hinzugefügt.`,
    sl: `${method === 'direct' ? 'Skupna količina vode v receptu' : 'Voda za končno testo'}: ${total} skupnega vodnega ekvivalenta (${liquid} tekoče vode + ${ice} ledu). Odmerite začetnih ${initialLiquidWater} tekoče vode (${initialWaterPct}% ${waterScope}) in prihranite preostalih ${remainingLiquidWater} tekoče vode. Led nadomesti del skupne vode in se ne dodaja poleg ${total}.`,
  }[lang]);
  const mixingAction = ({
    hr: mixing === 'spiral'
      ? 'Pripremljenu početnu porciju upotrijebite u sljedećem koraku spiralnog zamjesa.'
      : mixing === 'hand'
        ? 'Početnu porciju uključite u ručni zamjes, a ostatak dodajte postupno.'
        : 'Početnu porciju dodajte u posudu, a ostatak postupno ulijevajte dok mikser radi na maloj brzini.',
    en: mixing === 'spiral'
      ? 'Use this prepared initial portion in the spiral-mixing step below.'
      : mixing === 'hand'
        ? 'Use the initial portion in the hand mix and add the rest gradually.'
        : 'Add the initial portion to the bowl and stream in the rest gradually at low speed.',
    de: mixing === 'spiral'
      ? 'Verwenden Sie diese vorbereitete Anfangsportion im folgenden Schritt zum Spiralkneten.'
      : mixing === 'hand'
        ? 'Verwenden Sie die Anfangsportion beim Handkneten und geben Sie den Rest nach und nach dazu.'
        : 'Geben Sie die Anfangsportion in die Schüssel und lassen Sie den Rest bei niedriger Geschwindigkeit nach und nach einlaufen.',
    sl: mixing === 'spiral'
      ? 'Pripravljeno začetno porcijo uporabite v naslednjem koraku spiralnega gnetenja.'
      : mixing === 'hand'
        ? 'Začetno porcijo uporabite pri ročnem gnetenju, preostanek pa dodajajte postopoma.'
        : 'Začetno porcijo dodajte v posodo, preostanek pa postopoma prilivajte pri nizki hitrosti.',
  }[lang]);
  const equipmentGuidance = ({
    hr: mixing === 'spiral'
      ? `Za spiralni mikser potpuno otopite ${ice} leda u dijelu početnih ${initialLiquidWater} tekuće vode prije ulijevanja. Ako kvasac otapate zasebno, koristite drugi dio iste početne porcije. Ne stavljajte tvrde kocke izravno u posudu osim ako proizvođač to izričito dopušta.`
      : mixing === 'mixer'
        ? `Otopite ${ice} leda u dijelu početnih ${initialLiquidWater} tekuće vode prije dodavanja u kućni mikser; ako kvasac pripremate zasebno, koristite drugi dio iste početne porcije. Tvrde kocke ne stavljajte u uređaj ako to priručnik izričito ne dopušta.`
        : `Otopite ${ice} leda u dijelu početnih ${initialLiquidWater} tekuće vode pa tu ohlađenu porciju dodajte tijekom ručnog zamjesa.`,
    en: mixing === 'spiral'
      ? `For a spiral mixer, fully melt the ${ice} of ice in part of the initial ${initialLiquidWater} liquid water before pouring it in. If dissolving yeast separately, use another part of the same initial portion. Do not put hard ice cubes directly into the bowl unless the manufacturer explicitly allows it.`
      : mixing === 'mixer'
        ? `Melt the ${ice} of ice in part of the initial ${initialLiquidWater} liquid water before adding it to a home mixer; if you prepare yeast separately, use another part of the same initial portion. Do not put hard cubes into the appliance unless its manual explicitly permits this.`
        : `Fully melt the ${ice} of ice in part of the initial ${initialLiquidWater} liquid water, then add that chilled portion during hand mixing.`,
    de: mixing === 'spiral'
      ? `Schmelzen Sie die ${ice} Eis für den Spiralkneter vor dem Einfüllen vollständig in einem Teil der anfänglichen ${initialLiquidWater} flüssigen Wassermenge. Falls Sie Hefe separat auflösen, verwenden Sie einen anderen Teil derselben Anfangsportion. Harte Eiswürfel nur dann direkt in die Schüssel geben, wenn der Hersteller dies ausdrücklich erlaubt.`
      : mixing === 'mixer'
        ? `Schmelzen Sie die ${ice} Eis vor der Zugabe zum Haushaltsmixer in einem Teil der anfänglichen ${initialLiquidWater} flüssigen Wassermenge; falls Sie Hefe separat vorbereiten, verwenden Sie einen anderen Teil derselben Anfangsportion. Harte Eiswürfel nur dann in das Gerät geben, wenn die Anleitung dies ausdrücklich erlaubt.`
        : `Schmelzen Sie die ${ice} Eis vollständig in einem Teil der anfänglichen ${initialLiquidWater} flüssigen Wassermenge und geben Sie diese gekühlte Portion beim Handkneten dazu.`,
    sl: mixing === 'spiral'
      ? `Za spiralni mešalnik ${ice} ledu pred vlivanjem popolnoma stopite v delu začetnih ${initialLiquidWater} tekoče vode. Če kvas raztapljate ločeno, uporabite drug del iste začetne porcije. Trdih kock ne dajajte neposredno v posodo, razen če proizvajalec to izrecno dovoljuje.`
      : mixing === 'mixer'
        ? `Pred dodajanjem v domači mešalnik ${ice} ledu stopite v delu začetnih ${initialLiquidWater} tekoče vode; če kvas pripravite ločeno, uporabite drug del iste začetne porcije. Trdih kock ne dajajte v napravo, razen če to izrecno dovoljujejo navodila.`
        : `${ice} ledu popolnoma stopite v delu začetnih ${initialLiquidWater} tekoče vode, nato to ohlajeno porcijo dodajte med ročnim gnetenjem.`,
  }[lang]);
  const waterInfo = `${waterInfoBase} ${equipmentGuidance}`;
  const step = ({
    hr: `${waterBaseLabel}: ${total} ukupnog vodenog ekvivalenta (${liquid} tekuće vode + ${ice} leda). Led zamjenjuje dio vode i ne dodaje se povrh ukupne količine. Odmjerite početnih ${initialLiquidWater} (${initialWaterPct}% ${waterScope}) i sačuvajte preostalih ${remainingLiquidWater} tekuće vode. Otopite ${ice} leda u manjem dijelu iste početne porcije; otopinu uračunajte samo jednom. ${mixingAction}`,
    en: `${waterBaseLabel}: ${total} total water equivalent (${liquid} liquid water + ${ice} ice). Ice replaces part of the water and is not added on top. Measure the initial ${initialLiquidWater} (${initialWaterPct}% ${waterScope}) and reserve the remaining ${remainingLiquidWater} liquid water. Melt the ${ice} of ice in a small part of that same initial portion; count the melt only once. ${mixingAction}`,
    de: `${waterBaseLabel}: ${total} Wasserequivalent (${liquid} flüssiges Wasser + ${ice} Eis). Das Eis ersetzt einen Teil des Wassers und wird nicht zusätzlich hinzugefügt. Messen Sie zunächst ${initialLiquidWater} ab (${initialWaterPct}% ${waterScope}) und halten Sie die übrigen ${remainingLiquidWater} flüssiges Wasser zurück. Lösen Sie das Eis in einem kleinen Teil derselben Anfangsportion auf und rechnen Sie die Schmelze nur einmal an. ${mixingAction}`,
    sl: `${waterBaseLabel}: ${total} skupnega vodnega ekvivalenta (${liquid} tekoče vode + ${ice} ledu). Led nadomesti del vode in se ne dodaja dodatno. Odmerite začetnih ${initialLiquidWater} (${initialWaterPct}% ${waterScope}) in prihranite preostalih ${remainingLiquidWater} tekoče vode. ${ice} ledu stopite v manjšem delu iste začetne porcije; stopljeni led vštejte samo enkrat. ${mixingAction}`,
  }[lang]);

  return { step: mixing === 'hand' ? step : undefined, waterInfo };
}
