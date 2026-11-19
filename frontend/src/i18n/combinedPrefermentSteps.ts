export type CombinedInstructionsLanguage = 'hr' | 'en' | 'de' | 'sl';
export type CombinedInstructionsMixing = 'hand' | 'mixer' | 'spiral';
export type CombinedInstructionsYeast = 'fresh' | 'activeDry' | 'dry';
export type CombinedPrefermentAmounts = { flour: number; water: number; yeast: number };
export type CombinedSchedulePhase = { environment: 'room' | 'fridge'; hours: number; temperature: number };
export type CombinedInstructionTimer = { id: string; seconds: number; kind: 'rt' | 'fridge' | 'rest' | 'ballsRt' | 'ballsFridge'; label?: string };
export type CombinedInstructionPhase = { title: string; info: string; steps: string[]; timers: CombinedInstructionTimer[] };

type CombinedP3Timer = { id: string; seconds: number; kind: 'rest' | 'rt' | 'fridge' | 'ballsRt' | 'ballsFridge' | 'preBake'; label: string };

export type CombinedP3InitialInterval = {
  kind: 'mix-rest' | 'room-rest' | 'ball-rest' | 'fridge-rest';
  seconds: number;
};

const COMBINED_P3_MIX_REST_SECONDS = 5 * 60;
const COMBINED_P3_ROOM_REST_SECONDS = 30 * 60;
const COMBINED_P3_BALL_REST_SECONDS = 15 * 60;
const COMBINED_P3_GLUTEN_FREE_FRIDGE_SECONDS = 60 * 60;

export function getCombinedP3InitialIntervals(isGlutenFree: boolean): CombinedP3InitialInterval[] {
  return [
    { kind: 'mix-rest', seconds: COMBINED_P3_MIX_REST_SECONDS },
    { kind: 'room-rest', seconds: COMBINED_P3_ROOM_REST_SECONDS },
    {
      kind: isGlutenFree ? 'fridge-rest' : 'room-rest',
      seconds: isGlutenFree ? COMBINED_P3_GLUTEN_FREE_FRIDGE_SECONDS : COMBINED_P3_ROOM_REST_SECONDS,
    },
    { kind: 'ball-rest', seconds: COMBINED_P3_BALL_REST_SECONDS },
  ];
}

type Input = {
  lang: CombinedInstructionsLanguage;
  mixing: CombinedInstructionsMixing;
  yeastType: CombinedInstructionsYeast;
  yeastLabel: string;
  biga: CombinedPrefermentAmounts;
  poolish: CombinedPrefermentAmounts;
  remaining: { flour: number; water: number; yeast: number; salt: number; oil: number; psyllium?: number };
  bigaPct: number;
  bigaHydrationPct: number;
  poolishPct: number;
  poolishHydrationPct: number;
  bigaPhases: readonly CombinedSchedulePhase[];
  poolishPhases: readonly CombinedSchedulePhase[];
  ballCount: number;
  ballWeight: string;
  baseFinalMixSteps: readonly string[];
  basePostMixSteps: readonly string[];
  formatWeight: (grams: number) => string;
  formatFlourWeight?: (grams: number) => string;
  formatYeastWeight: (grams: number) => string;
  formatDuration: (hours: number) => string;
  formatTemperature: (celsius: number) => string;
  fridgeTemperatureC?: number;
};

const COPY = {
  hr: {
    titles: ['Priprema Bige', 'Priprema Poolisha'],
    info: (name: string, share: number, hydration: number) => `${name} koristi ${share}% ukupnog brašna uz ${hydration}% hidratacije. Pripremite je neovisno o drugoj grani; spojite ih tek u završnom zamjesu.`,
    wash: 'Operite i temeljito osušite ruke.',
    measure: (name: string, ingredients: string) => `Odvažite ${ingredients} za ${name}.`,
    bigaMix: { hand: 'Rukama kratko povežite Bigu u grubu, mrvičastu smjesu; nemojte mijesiti do glatkog.', mixer: 'Kućnim mikserom kratko miješajte Bigu na niskoj brzini, samo dok smjesa ostane mrvičasta.', spiral: 'Spiralnim mikserom kratko miješajte Bigu na niskoj brzini, samo dok smjesa ostane mrvičasta.' },
    poolishMix: 'Dodajte izmjereno brašno i vodu za Poolish te ih izmiješajte pjenjačom ili vilicom dok smjesa ne postane glatka.',
    independent: 'Ova grana fermentira prema vlastitom rasporedu i timerima; ne spajajte je s drugom granom prije završnog zamjesa.',
    ballsFermentation: (roomDuration: string, fridgeDuration: string | null, temperature: string) => `Ostavite loptice ${roomDuration} na sobnoj temperaturi${fridgeDuration ? `, pa ih spremite u hladnjak na ${fridgeDuration} pri ${temperature}` : ''}.`,
    roomOnlyFermentation: (duration: string) => `Nakon kratkih odmora ostavite završno tijesto ${duration} na sobnoj temperaturi, zatim oblikujte kugle.`,
    roomOnlyLabel: 'Završna sobna fermentacija',
    roomFirst: (name: string, duration: string, temp: string) => `Pokrijte ${name} i ostavite ga ${duration} na sobnoj temperaturi (${temp}).`,
    roomNext: (name: string, duration: string, temp: string) => `Nakon prethodne faze izvadite ${name} iz hladnjaka i ostavite ga ${duration} na sobnoj temperaturi (${temp}).`,
    fridgeFirst: (name: string, duration: string, temp: string) => `Pokrijte ${name} i stavite ga u hladnjak na ${duration} pri ${temp}.`,
    fridgeNext: (name: string, duration: string, temp: string) => `Nakon prethodne faze premjestite pokriveni ${name} u hladnjak na ${duration} pri ${temp}.`,
    roomLabel: 'sobna faza', fridgeLabel: 'faza u hladnjaku',
    addPoolish: (mixing: CombinedInstructionsMixing) => ({
      hand: 'Pripremljeni Poolish u cijelosti dodajte u istu posudu za ručni zamjes s Bigom prije nastavka završnog zamjesa.',
      mixer: 'Pripremljeni Poolish u cijelosti dodajte u istu posudu kućnog miksera s Bigom prije nastavka završnog zamjesa.',
      spiral: 'Pripremljeni Poolish u cijelosti dodajte u istu posudu spiralnog miksera s Bigom prije nastavka završnog zamjesa.',
    })[mixing],
    balls: (count: number, weight: string) => `Podijelite tijesto na ${count} kuglica od ${weight}.`,
  },
  en: {
    titles: ['Biga preparation', 'Poolish preparation'],
    info: (name: string, share: number, hydration: number) => `${name} uses ${share}% of the total flour at ${hydration}% hydration. Prepare it independently from the other branch; combine them only in the final mix.`,
    wash: 'Wash and thoroughly dry your hands.',
    measure: (name: string, ingredients: string) => `Measure ${ingredients} for the ${name}.`,
    bigaMix: { hand: 'Briefly combine the Biga by hand into a rough, crumbly mixture; do not knead it smooth.', mixer: 'Mix the Biga briefly with the home mixer at low speed, stopping while it is still crumbly.', spiral: 'Mix the Biga briefly with the spiral mixer at low speed, stopping while it is still crumbly.' },
    poolishMix: 'Add the measured Poolish flour and water, then whisk or stir with a fork until smooth.',
    independent: 'This branch ferments on its own schedule with its own timers; keep it separate from the other branch until the final mix.',
    ballsFermentation: (roomDuration: string, fridgeDuration: string | null, temperature: string) => `Leave the balls at room temperature for ${roomDuration}${fridgeDuration ? `, then refrigerate them at ${temperature} for ${fridgeDuration}` : ''}.`,
    roomOnlyFermentation: (duration: string) => `After the short rests, leave the final dough at room temperature for ${duration}, then shape the balls.`,
    roomOnlyLabel: 'Final room fermentation',
    roomFirst: (name: string, duration: string, temp: string) => `Cover the ${name} and leave it at room temperature (${temp}) for ${duration}.`,
    roomNext: (name: string, duration: string, temp: string) => `After the previous phase, remove the ${name} from the refrigerator and leave it at room temperature (${temp}) for ${duration}.`,
    fridgeFirst: (name: string, duration: string, temp: string) => `Cover the ${name} and refrigerate it at ${temp} for ${duration}.`,
    fridgeNext: (name: string, duration: string, temp: string) => `After the previous phase, move the covered ${name} to the refrigerator at ${temp} for ${duration}.`,
    roomLabel: 'room phase', fridgeLabel: 'refrigerator phase',
    addPoolish: (mixing: CombinedInstructionsMixing) => ({
      hand: 'Add the entire prepared Poolish to the same hand-mixing bowl as the Biga before continuing the final mix.',
      mixer: 'Add the entire prepared Poolish to the same home-mixer bowl as the Biga before continuing the final mix.',
      spiral: 'Add the entire prepared Poolish to the same spiral-mixer bowl as the Biga before continuing the final mix.',
    })[mixing],
    balls: (count: number, weight: string) => `Divide the dough into ${count} balls of ${weight}.`,
  },
  de: {
    titles: ['Biga zubereiten', 'Poolish zubereiten'],
    info: (name: string, share: number, hydration: number) => `${name} verwendet ${share}% des Gesamtmehls bei ${hydration}% Hydration. Bereiten Sie ihn unabhängig vom anderen Zweig zu; vermengen Sie beide erst im Hauptteig.`,
    wash: 'Waschen und trocknen Sie Ihre Hände gründlich.',
    measure: (name: string, ingredients: string) => `Wiegen Sie ${ingredients} für ${name} ab.`,
    bigaMix: { hand: 'Vermengen Sie die Biga kurz von Hand zu einer groben, krümeligen Masse; kneten Sie sie nicht glatt.', mixer: 'Mischen Sie die Biga kurz mit dem Haushaltsmixer auf niedriger Stufe; stoppen Sie, solange sie krümelig ist.', spiral: 'Mischen Sie die Biga kurz mit dem Spiralkneter auf niedriger Stufe; stoppen Sie, solange sie krümelig ist.' },
    poolishMix: 'Geben Sie das abgemessene Poolish-Mehl und Wasser dazu und verrühren Sie alles mit Schneebesen oder Gabel, bis die Mischung glatt ist.',
    independent: 'Dieser Zweig fermentiert nach eigenem Zeitplan und mit eigenen Timern; halten Sie ihn bis zum Hauptteig getrennt.',
    ballsFermentation: (roomDuration: string, fridgeDuration: string | null, temperature: string) => `Lassen Sie die Teiglinge ${roomDuration} bei Raumtemperatur stehen${fridgeDuration ? ` und stellen Sie sie anschließend für ${fridgeDuration} bei ${temperature} in den Kühlschrank` : ''}.`,
    roomOnlyFermentation: (duration: string) => `Lassen Sie den Hauptteig nach den kurzen Ruhezeiten ${duration} bei Raumtemperatur gehen und formen Sie anschließend die Teigkugeln.`,
    roomOnlyLabel: 'Abschließende Raumgare',
    roomFirst: (name: string, duration: string, temp: string) => `Decken Sie ${name} ab und lassen Sie ihn ${duration} bei Raumtemperatur (${temp}) stehen.`,
    roomNext: (name: string, duration: string, temp: string) => `Nehmen Sie ${name} nach der vorherigen Phase aus dem Kühlschrank und lassen Sie ihn ${duration} bei Raumtemperatur (${temp}) stehen.`,
    fridgeFirst: (name: string, duration: string, temp: string) => `Decken Sie ${name} ab und stellen Sie ihn für ${duration} bei ${temp} in den Kühlschrank.`,
    fridgeNext: (name: string, duration: string, temp: string) => `Stellen Sie ${name} nach der vorherigen Phase abgedeckt für ${duration} bei ${temp} zurück in den Kühlschrank.`,
    roomLabel: 'Raumphase', fridgeLabel: 'Kühlschrankphase',
    addPoolish: (mixing: CombinedInstructionsMixing) => ({
      hand: 'Geben Sie den vollständig vorbereiteten Poolish zur Biga in dieselbe Knetschüssel, bevor Sie mit dem Hauptteig fortfahren.',
      mixer: 'Geben Sie den vollständig vorbereiteten Poolish zur Biga in dieselbe Schüssel der Haushaltsmaschine, bevor Sie mit dem Hauptteig fortfahren.',
      spiral: 'Geben Sie den vollständig vorbereiteten Poolish zur Biga in dieselbe Schüssel des Spiralkneters, bevor Sie mit dem Hauptteig fortfahren.',
    })[mixing],
    balls: (count: number, weight: string) => `Teilen Sie den Teig in ${count} Teiglinge zu je ${weight}.`,
  },
  sl: {
    titles: ['Priprava bige', 'Priprava poolisha'],
    info: (name: string, share: number, hydration: number) => `${name} vsebuje ${share}% celotne moke pri ${hydration}% hidraciji. Pripravite jo neodvisno od druge veje; združite ju šele pri končnem gnetenju.`,
    wash: 'Temeljito si umijte in osušite roke.',
    measure: (name: string, ingredients: string) => `Odtehtajte ${ingredients} za ${name}.`,
    bigaMix: { hand: 'Sestavine na kratko povežite z roko v grobo, drobtinasto zmes; bige ne zgnetite do gladkega.', mixer: 'Bigo na kratko mešajte z domačim mešalnikom pri nizki hitrosti; ustavite, ko je še drobtinasta.', spiral: 'Bigo na kratko mešajte s spiralnim mešalnikom pri nizki hitrosti; ustavite, ko je še drobtinasta.' },
    poolishMix: 'Dodajte odmerjeno moko in vodo za poolish ter ju z metlico ali vilicami zmešajte v gladko zmes.',
    independent: 'Ta veja fermentira po svojem urniku in z lastnimi časovniki; do končnega gnetenja jo hranite ločeno od druge veje.',
    ballsFermentation: (roomDuration: string, fridgeDuration: string | null, temperature: string) => `Kepice pustite ${roomDuration} pri sobni temperaturi${fridgeDuration ? `, nato pa jih postavite v hladilnik za ${fridgeDuration} pri ${temperature}` : ''}.`,
    roomOnlyFermentation: (duration: string) => `Po kratkih počitkih pustite končno testo ${duration} pri sobni temperaturi, nato oblikujte kepice.`,
    roomOnlyLabel: 'Končna sobna fermentacija',
    roomFirst: (name: string, duration: string, temp: string) => `Pokrijte ${name} in ga pustite ${duration} pri sobni temperaturi (${temp}).`,
    roomNext: (name: string, duration: string, temp: string) => `Po prejšnji fazi ${name} vzemite iz hladilnika in ga pustite ${duration} pri sobni temperaturi (${temp}).`,
    fridgeFirst: (name: string, duration: string, temp: string) => `Pokrijte ${name} in ga postavite v hladilnik za ${duration} pri ${temp}.`,
    fridgeNext: (name: string, duration: string, temp: string) => `Po prejšnji fazi pokriti ${name} prestavite nazaj v hladilnik za ${duration} pri ${temp}.`,
    roomLabel: 'sobna faza', fridgeLabel: 'faza v hladilniku',
    addPoolish: (mixing: CombinedInstructionsMixing) => ({
      hand: 'Ves pripravljeni poolish dodajte v isto posodo za ročno gnetenje z bigo, preden nadaljujete končno gnetenje.',
      mixer: 'Ves pripravljeni poolish dodajte v isto posodo domačega mešalnika z bigo, preden nadaljujete končno gnetenje.',
      spiral: 'Ves pripravljeni poolish dodajte v isto posodo spiralnega mešalnika z bigo, preden nadaljujete končno gnetenje.',
    })[mixing],
    balls: (count: number, weight: string) => `Testo razdelite na ${count} kroglic po ${weight}.`,
  },
} as const;

const P3_COPY = {
  hr: {
    rest: (duration: string) => `Ostavite tijesto da odmori u posudi ${duration}.`,
    foldRoom: (duration: string) => `Preklopite tijesto par puta rukama (stretch & fold), pokrijte i ostavite još ${duration} na sobnoj temperaturi.`,
    glutenFreeFridge: (duration: string, temperature: string) => `Bezglutensko tijesto nemojte preklapati; pokrijte ga i stavite u hladnjak na ${duration} pri ${temperature}.`,
    takeOut: (duration: string) => `Izvadite kuglice iz hladnjaka ${duration} prije oblikovanja i ostavite ih pokrivene na sobnoj temperaturi.`,
    takeOutAtShaping: 'Izvadite kuglice iz hladnjaka kada budete spremni za oblikovanje.',
    roomBeforeShaping: (duration: string) => `Ostavite kuglice pokrivene na sobnoj temperaturi ${duration} prije oblikovanja.`,
    roomOnlyFermentation: (duration: string) => `Nakon kratkih odmora ostavite završno tijesto ${duration} na sobnoj temperaturi prije oblikovanja kugli.`,
    roomOnlyLabel: 'Završna sobna fermentacija',
    roomRestLabel: 'kratki pokriveni odmor prije oblikovanja',
    labels: ['odmor nakon zamjesa', 'sobna faza 1', 'sobna faza 2', 'odmor kuglica na sobnoj temperaturi', 'hladna fermentacija tijesta', 'hladna fermentacija kuglica', 'temperiranje prije oblikovanja'],
  },
  en: {
    rest: (duration: string) => `Let the dough rest in the bowl for ${duration}.`,
    foldRoom: (duration: string) => `Fold the dough a few times by hand (stretch & fold), cover it, and leave it at room temperature for another ${duration}.`,
    glutenFreeFridge: (duration: string, temperature: string) => `Do not fold the gluten-free dough; cover it and refrigerate for ${duration} at ${temperature}.`,
    takeOut: (duration: string) => `Take the dough balls out of the refrigerator ${duration} before shaping and leave them covered at room temperature.`,
    takeOutAtShaping: 'Take the dough balls out of the refrigerator when ready to shape.',
    roomBeforeShaping: (duration: string) => `Keep the dough balls covered at room temperature for ${duration} before shaping.`,
    roomOnlyFermentation: (duration: string) => `After the short rests, leave the final dough at room temperature for ${duration} before shaping the balls.`,
    roomOnlyLabel: 'Final room fermentation',
    roomRestLabel: 'short covered room rest before shaping',
    labels: ['rest after mixing', 'room phase 1', 'room phase 2', 'dough-ball room rest', 'bulk refrigerator phase', 'dough-ball cold fermentation', 'tempering before shaping'],
  },
  de: {
    rest: (duration: string) => `Lassen Sie den Teig ${duration} in der Schüssel ruhen.`,
    foldRoom: (duration: string) => `Falten Sie den Teig einige Male von Hand (Stretch & Fold), decken Sie ihn ab und lassen Sie ihn weitere ${duration} bei Raumtemperatur stehen.`,
    glutenFreeFridge: (duration: string, temperature: string) => `Falten Sie den glutenfreien Teig nicht; decken Sie ihn ab und stellen Sie ihn für ${duration} bei ${temperature} in den Kühlschrank.`,
    takeOut: (duration: string) => `Nehmen Sie die Teigkugeln ${duration} vor dem Formen aus dem Kühlschrank und lassen Sie sie abgedeckt bei Raumtemperatur stehen.`,
    takeOutAtShaping: 'Nehmen Sie die Teigkugeln zum Formen aus dem Kühlschrank.',
    roomBeforeShaping: (duration: string) => `Lassen Sie die Teigkugeln ${duration} vor dem Formen abgedeckt bei Raumtemperatur stehen.`,
    roomOnlyFermentation: (duration: string) => `Lassen Sie den Hauptteig nach den kurzen Ruhezeiten ${duration} bei Raumtemperatur gehen, bevor Sie die Teigkugeln formen.`,
    roomOnlyLabel: 'Abschließende Raumgare',
    roomRestLabel: 'kurze abgedeckte Ruhezeit vor dem Formen',
    labels: ['Ruhe nach dem Kneten', 'Raumphase 1', 'Raumphase 2', 'Teigkugel-Ruhe bei Raumtemperatur', 'kalte Teigphase', 'kalte Teigkugel-Fermentation', 'Temperieren vor dem Formen'],
  },
  sl: {
    rest: (duration: string) => `Testo pustite počivati v posodi ${duration}.`,
    foldRoom: (duration: string) => `Testo nekajkrat prepognite z rokami (stretch & fold), ga pokrijte in pustite še ${duration} pri sobni temperaturi.`,
    glutenFreeFridge: (duration: string, temperature: string) => `Brezglutenskega testa ne prepogibajte; pokrijte ga in postavite v hladilnik za ${duration} pri ${temperature}.`,
    takeOut: (duration: string) => `Kroglice vzemite iz hladilnika ${duration} pred oblikovanjem in jih pustite pokrite pri sobni temperaturi.`,
    takeOutAtShaping: 'Kroglice vzemite iz hladilnika, ko ste pripravljeni na oblikovanje.',
    roomBeforeShaping: (duration: string) => `Kroglice pustite pokrite pri sobni temperaturi ${duration} pred oblikovanjem.`,
    roomOnlyFermentation: (duration: string) => `Po kratkih počitkih pustite končno testo ${duration} pri sobni temperaturi, preden oblikujete kepice.`,
    roomOnlyLabel: 'Končna sobna fermentacija',
    roomRestLabel: 'kratek pokrit počitek pred oblikovanjem',
    labels: ['počitek po gnetenju', 'sobna faza 1', 'sobna faza 2', 'počitek kroglic pri sobni temperaturi', 'hladna faza mase', 'hladna fermentacija kroglic', 'temperiranje pred oblikovanjem'],
  },
} as const;

export function buildCombinedP3Instructions(input: {
  lang: CombinedInstructionsLanguage;
  baseSteps: readonly string[];
  selectedBallingStep: string;
  fridgeHours: number;
  temperingHours: number;
  roomOnlyFermentationHours?: number;
  fridgeTemperature: string;
  isGlutenFree: boolean;
  formatDuration: (seconds: number) => string;
}): { steps: string[]; timers: CombinedP3Timer[] } {
  if (input.baseSteps.length < 4) throw new RangeError('Combined Biga P3 requires its final shaping step.');
  if (!Number.isFinite(input.fridgeHours) || input.fridgeHours < 0) throw new RangeError('Combined Biga fridge duration must be finite and nonnegative.');
  if (!Number.isFinite(input.temperingHours) || input.temperingHours < 0) throw new RangeError('Combined Biga tempering duration must be finite and nonnegative.');
  const roomOnlyFermentationHours = input.roomOnlyFermentationHours ?? 0;
  if (!Number.isFinite(roomOnlyFermentationHours) || roomOnlyFermentationHours < 0) throw new RangeError('Combined Biga room-only fermentation duration must be finite and nonnegative.');
  const copy = P3_COPY[input.lang];
  const initialIntervals = getCombinedP3InitialIntervals(input.isGlutenFree);
  const steps = [...input.baseSteps];
  if (steps.length < 6) {
    const finalShapingStep = steps.pop()!;
    while (steps.length < 5) steps.push('');
    steps.push(finalShapingStep);
  }
  steps[0] = copy.rest(input.formatDuration(initialIntervals[0].seconds));
  steps[2] = input.isGlutenFree
    ? copy.glutenFreeFridge(input.formatDuration(initialIntervals[2].seconds), input.fridgeTemperature)
    : copy.foldRoom(input.formatDuration(initialIntervals[2].seconds));
  steps[3] = input.selectedBallingStep;
  steps[4] = COPY[input.lang].ballsFermentation(
    input.formatDuration(initialIntervals[3].seconds),
    input.fridgeHours > 0 ? input.formatDuration(input.fridgeHours * 3600) : null,
    input.fridgeTemperature,
  );
  if (input.fridgeHours === 0 && roomOnlyFermentationHours > 0) {
    steps.splice(3, 0, copy.roomOnlyFermentation(input.formatDuration(roomOnlyFermentationHours * 3600)));
  }
  const shapingRest = input.fridgeHours > 0
    ? input.temperingHours > 0
      ? copy.takeOut(input.formatDuration(input.temperingHours * 3600))
      : copy.takeOutAtShaping
    : copy.roomBeforeShaping(input.formatDuration(15 * 60));
  steps[steps.length - 1] = `${shapingRest} ${steps[steps.length - 1]}`;

  const finalRestTimer = input.fridgeHours > 0
    ? input.temperingHours > 0
      ? { id: 'combined-pre-bake-tempering', seconds: input.temperingHours * 3600, kind: 'preBake' as const, label: copy.labels[6] }
      : null
    : { id: 'combined-pre-bake-15m', seconds: 15 * 60, kind: 'preBake' as const, label: copy.roomRestLabel };

  const timers: CombinedP3Timer[] = [
    { id: 'combined-rest5m', seconds: initialIntervals[0].seconds, kind: 'rest', label: copy.labels[0] },
    { id: 'combined-room-1-30m', seconds: initialIntervals[1].seconds, kind: 'rt', label: copy.labels[1] },
    input.isGlutenFree
      ? { id: 'combined-gluten-free-fridge-60m', seconds: initialIntervals[2].seconds, kind: 'fridge', label: copy.labels[4] }
      : { id: 'combined-room-2-30m', seconds: initialIntervals[2].seconds, kind: 'rt', label: copy.labels[2] },
    ...(input.fridgeHours === 0 && roomOnlyFermentationHours > 0
      ? [{ id: 'combined-room-only-fermentation', seconds: roomOnlyFermentationHours * 3600, kind: 'rt' as const, label: copy.roomOnlyLabel }]
      : []),
    { id: 'combined-balls-room-15m', seconds: initialIntervals[3].seconds, kind: 'ballsRt', label: copy.labels[3] },
    ...(input.fridgeHours > 0 ? [{ id: 'combined-balls-fridge', seconds: input.fridgeHours * 3600, kind: 'ballsFridge' as const, label: copy.labels[5] }] : []),
    ...(finalRestTimer ? [finalRestTimer] : []),
  ];
  return { steps, timers };
}

export function getCombinedOvenBakingSteps(input: {
  lang: CombinedInstructionsLanguage;
  oven: 'ooni' | 'homeStone' | 'homePan' | 'kamado';
  temperature: string;
  bakeDuration: string;
}): string[] {
  if (input.oven === 'kamado') return [];
  const copy = {
    hr: {
      ooni: [`Zagrijte pizza peć na ${input.temperature}.`, `Pecite ${input.bakeDuration} i okrećite pizzu svakih 20–30 sekundi.`],
      homeStone: [`Potpuno zagrijte kamen ili čelik na ${input.temperature} uz uključen grill.`, `Isključite grill i koristite Pizza program ili gornji i donji grijač bez ventilatora. Pecite ${input.bakeDuration}, a grillom završite pečenje po potrebi.`],
      homePan: [`Zagrijte kućnu pećnicu s ventilacijom i pripremljeni lim na ${input.temperature}.`, `Pecite ${input.bakeDuration}; provjerite boju vrha i dna te po potrebi kratko završite gornjim grillom.`],
    },
    en: {
      ooni: [`Preheat the pizza oven to ${input.temperature}.`, `Bake for ${input.bakeDuration}, rotating the pizza every 20–30 seconds.`],
      homeStone: [`Fully heat the stone or steel to ${input.temperature} with the grill on.`, `Turn off the grill and use the Pizza program or top and bottom heat without a fan. Bake for ${input.bakeDuration}, finishing under the grill if needed.`],
      homePan: [`Preheat the home convection oven and prepared tray to ${input.temperature}.`, `Bake for ${input.bakeDuration}; check the top and bottom color and briefly finish under the upper grill if needed.`],
    },
    de: {
      ooni: [`Heizen Sie den Pizzaofen auf ${input.temperature} vor.`, `Backen Sie ${input.bakeDuration} und drehen Sie die Pizza alle 20–30 Sekunden.`],
      homeStone: [`Heizen Sie den Stein oder Stahl bei eingeschaltetem Grill vollständig auf ${input.temperature} auf.`, `Schalten Sie den Grill aus und verwenden Sie das Pizza-Programm oder Ober-/Unterhitze ohne Umluft. Backen Sie ${input.bakeDuration}; bräunen Sie bei Bedarf zum Schluss mit dem Grill.`],
      homePan: [`Heizen Sie den Umluftofen und das vorbereitete Blech auf ${input.temperature} vor.`, `Backen Sie ${input.bakeDuration}; prüfen Sie die Farbe von Oberseite und Boden und bräunen Sie bei Bedarf kurz unter dem oberen Grill.`],
    },
    sl: {
      ooni: [`Pizza pečico segrejte na ${input.temperature}.`, `Pecite ${input.bakeDuration} in pico obračajte vsakih 20–30 sekund.`],
      homeStone: [`Kamen ali jeklo z vklopljenim žarom popolnoma segrejte na ${input.temperature}.`, `Izklopite žar in uporabite program Pizza ali zgornje in spodnje gretje brez ventilatorja. Pecite ${input.bakeDuration} in po potrebi na koncu zapečite pod žarom.`],
      homePan: [`Domačo pečico z ventilacijo in pripravljen pekač segrejte na ${input.temperature}.`, `Pecite ${input.bakeDuration}; preverite barvo vrha in dna ter po potrebi na kratko zaključite pod zgornjim žarom.`],
    },
  }[input.lang];
  return copy[input.oven];
}

const YEAST_INSTRUCTIONS: Record<CombinedInstructionsLanguage, Record<'biga' | 'poolish', Record<CombinedInstructionsYeast, (amount: string) => string>>> = {
  hr: {
    biga: {
      fresh: (amount) => `Svježi kvasac (${amount}) izmrvite po brašnu za Bigu, zatim dodajte izmjerenu vodu.`,
      activeDry: (amount) => `Aktivni suhi kvasac (${amount}) otopite u dijelu tople izmjerene vode prema uputama na pakiranju; tu vodu uračunajte u vodu za Bigu.`,
      dry: (amount) => `Instant suhi kvasac (${amount}) ravnomjerno umiješajte u brašno za Bigu, zatim dodajte izmjerenu vodu.`,
    },
    poolish: {
      fresh: (amount) => `Svježi kvasac (${amount}) otopite u izmjerenoj vodi za Poolish.`,
      activeDry: (amount) => `Aktivni suhi kvasac (${amount}) otopite u dijelu tople izmjerene vode prema uputama na pakiranju; tu vodu uračunajte u vodu za Poolish.`,
      dry: (amount) => `Instant suhi kvasac (${amount}) ravnomjerno umiješajte u brašno za Poolish.`,
    },
  },
  en: {
    biga: {
      fresh: (amount) => `Crumble ${amount} fresh yeast through the Biga flour, then add the measured water.`,
      activeDry: (amount) => `Dissolve ${amount} active dry yeast in part of the measured warm water according to the package directions; count it toward the Biga water.`,
      dry: (amount) => `Mix ${amount} instant dry yeast evenly into the Biga flour, then add the measured water.`,
    },
    poolish: {
      fresh: (amount) => `Dissolve ${amount} fresh yeast in the measured Poolish water.`,
      activeDry: (amount) => `Dissolve ${amount} active dry yeast in part of the measured warm water according to the package directions; count it toward the Poolish water.`,
      dry: (amount) => `Mix ${amount} instant dry yeast evenly into the Poolish flour.`,
    },
  },
  de: {
    biga: {
      fresh: (amount) => `Bröseln Sie ${amount} Frischhefe über das Biga-Mehl und geben Sie anschließend das abgemessene Wasser dazu.`,
      activeDry: (amount) => `Lösen Sie ${amount} Aktiv-Trockenhefe nach Packungsanleitung in einem Teil des abgemessenen warmen Wassers auf; rechnen Sie dieses Wasser zur Biga-Wassermenge.`,
      dry: (amount) => `Mischen Sie ${amount} Instant-Trockenhefe gleichmäßig unter das Biga-Mehl und geben Sie anschließend das abgemessene Wasser dazu.`,
    },
    poolish: {
      fresh: (amount) => `Lösen Sie ${amount} Frischhefe im abgemessenen Poolish-Wasser auf.`,
      activeDry: (amount) => `Lösen Sie ${amount} Aktiv-Trockenhefe nach Packungsanleitung in einem Teil des abgemessenen warmen Wassers auf; rechnen Sie dieses Wasser zur Poolish-Wassermenge.`,
      dry: (amount) => `Mischen Sie ${amount} Instant-Trockenhefe gleichmäßig unter das Poolish-Mehl.`,
    },
  },
  sl: {
    biga: {
      fresh: (amount) => `Sveži kvas (${amount}) nadrobite po moki za bigo, nato dodajte odmerjeno vodo.`,
      activeDry: (amount) => `Aktivni suhi kvas (${amount}) raztopite v delu odmerjene tople vode po navodilih na embalaži; to vodo vštejte v vodo za bigo.`,
      dry: (amount) => `Instant suhi kvas (${amount}) enakomerno vmešajte v moko za bigo, nato dodajte odmerjeno vodo.`,
    },
    poolish: {
      fresh: (amount) => `Sveži kvas (${amount}) raztopite v odmerjeni vodi za poolish.`,
      activeDry: (amount) => `Aktivni suhi kvas (${amount}) raztopite v delu odmerjene tople vode po navodilih na embalaži; to vodo vštejte v vodo za poolish.`,
      dry: (amount) => `Instant suhi kvas (${amount}) enakomerno vmešajte v moko za poolish.`,
    },
  },
};

function assertAmount(name: string, value: number): void {
  const displayRounded = Math.round(value * 100) / 100;
  if (!Number.isFinite(value) || (value < 0 && !Object.is(displayRounded, -0))) throw new RangeError(`${name} must be a finite, nonnegative calculated amount.`);
}

function isDisplayZero(value: number): boolean {
  return Math.round(value * 100) / 100 === 0;
}

function buildPreparationPhase(side: 'biga' | 'poolish', input: Input): CombinedInstructionPhase {
  const copy = COPY[input.lang];
  const formatFlourWeight = input.formatFlourWeight ?? input.formatWeight;
  const amounts = input[side];
  const phases = side === 'biga' ? input.bigaPhases : input.poolishPhases;
  const name = side === 'biga' ? 'Biga' : 'Poolish';
  if (phases.length === 0) throw new RangeError(`${name} requires its own fermentation phases.`);
  phases.forEach((phase, index) => {
    if (!Number.isFinite(phase.hours) || phase.hours <= 0 || !Number.isFinite(phase.temperature)) throw new RangeError(`${name} phase ${index + 1} must have a positive duration and finite temperature.`);
  });
  const phaseSteps = phases.map((phase, index) => {
    const duration = input.formatDuration(phase.hours);
    const temperature = input.formatTemperature(
      phase.environment === 'fridge' && input.fridgeTemperatureC !== undefined
        ? input.fridgeTemperatureC
        : phase.temperature,
    );
    if (phase.environment === 'room') return index === 0 ? copy.roomFirst(name, duration, temperature) : copy.roomNext(name, duration, temperature);
    return index === 0 ? copy.fridgeFirst(name, duration, temperature) : copy.fridgeNext(name, duration, temperature);
  });
  const timers = phases.map((phase, index) => ({
    id: `combined-${side}-phase-${index + 1}`,
    seconds: phase.hours * 3600,
    kind: phase.environment === 'room' ? 'rt' as const : 'fridge' as const,
    label: `${name} · ${phase.environment === 'room' ? copy.roomLabel : copy.fridgeLabel} ${index + 1}`,
  }));
  const measure = ({
    hr: { biga: 'Bigu', poolish: 'Poolish' },
    en: { biga: 'Biga', poolish: 'Poolish' },
    de: { biga: 'die Biga', poolish: 'den Poolish' },
    sl: { biga: 'bigo', poolish: 'poolish' },
  } as const)[input.lang][side];
  const ingredientLabels = ({
    hr: { flour: 'brašna', water: 'vode', yeast: `kvasca (${input.yeastLabel})`, join: ' i ' },
    en: { flour: 'flour', water: 'water', yeast: `yeast (${input.yeastLabel})`, join: ' and ' },
    de: { flour: 'Mehl', water: 'Wasser', yeast: `Hefe (${input.yeastLabel})`, join: ' und ' },
    sl: { flour: 'moke', water: 'vode', yeast: `kvasa (${input.yeastLabel})`, join: ' in ' },
  } as const)[input.lang];
  const measuredIngredients = [
    ...(!isDisplayZero(amounts.flour) && amounts.flour > 0 ? [`${formatFlourWeight(amounts.flour)} ${ingredientLabels.flour}`] : []),
    ...(!isDisplayZero(amounts.water) && amounts.water > 0 ? [`${input.formatWeight(amounts.water)} ${ingredientLabels.water}`] : []),
    ...(!isDisplayZero(amounts.yeast) && amounts.yeast > 0 ? [`${input.formatYeastWeight(amounts.yeast)} ${ingredientLabels.yeast}`] : []),
  ];
  const measuredText = measuredIngredients.length < 2
    ? measuredIngredients[0] ?? ''
    : `${measuredIngredients.slice(0, -1).join(', ')}${ingredientLabels.join}${measuredIngredients[measuredIngredients.length - 1]}`;
  return {
    title: copy.titles[side === 'biga' ? 0 : 1],
    info: copy.info(name, side === 'biga' ? input.bigaPct : input.poolishPct, side === 'biga' ? input.bigaHydrationPct : input.poolishHydrationPct),
    steps: [
      copy.wash,
      ...(measuredText ? [copy.measure(measure, measuredText)] : []),
      ...(!isDisplayZero(amounts.yeast) && amounts.yeast > 0 ? [YEAST_INSTRUCTIONS[input.lang][side][input.yeastType](input.formatYeastWeight(amounts.yeast))] : []),
      ...(!isDisplayZero(amounts.flour) && amounts.flour > 0 && !isDisplayZero(amounts.water) && amounts.water > 0 ? [side === 'biga' ? copy.bigaMix[input.mixing] : copy.poolishMix] : []),
      copy.independent,
      ...phaseSteps,
    ],
    timers,
  };
}

export function buildCombinedPrefermentInstructions(input: Input) {
  [
    ['Biga flour', input.biga.flour], ['Biga water', input.biga.water], ['Biga yeast', input.biga.yeast],
    ['Poolish flour', input.poolish.flour], ['Poolish water', input.poolish.water], ['Poolish yeast', input.poolish.yeast],
    ['Remaining flour', input.remaining.flour], ['Remaining water', input.remaining.water], ['Remaining yeast', input.remaining.yeast], ['Remaining salt', input.remaining.salt], ['Remaining oil', input.remaining.oil],
  ].forEach(([name, value]) => assertAmount(String(name), Number(value)));
  if (!Number.isInteger(input.ballCount) || input.ballCount <= 0 || !input.ballWeight) throw new RangeError('Combined dough requires the selected ball count and weight.');
  if (input.baseFinalMixSteps.length === 0) throw new RangeError('Combined dough requires the selected final-mix procedure.');
  const copy = COPY[input.lang];
  const postMixSteps = [...input.basePostMixSteps];
  const fixedBallWeightPattern = /\b\d+(?:[.,]\d+)?\s*[–-]\s*\d+(?:[.,]\d+)?\s*g\b/i;
  const ballingStep = copy.balls(input.ballCount, input.ballWeight);
  const finalMixSteps = [...input.baseFinalMixSteps];
  if (finalMixSteps.length > 0) finalMixSteps[0] = `${finalMixSteps[0]} ${copy.addPoolish(input.mixing)}`;
  const yeastPattern = ({ hr: /kvas/i, en: /yeast/i, de: /hefe/i, sl: /kvas/i } as const)[input.lang];
  const zeroAmountPattern = /(?<![\d.,])[−-]?0(?:[,.]0+)?\s*g\b/i;
  const zeroRemainingFlourAction = ({
    hr: /dodajte preostalo brašno\s*\(\s*0(?:[,.]0+)?\s*(?:g|oz|lb)[^)]*\)\s*u posudu\.?/i,
    en: /add the remaining flour\s*\(\s*0(?:[,.]0+)?\s*(?:g|oz|lb)[^)]*\)\s*to the bowl\.?/i,
    de: /geben sie das restliche mehl\s*\(\s*0(?:[,.]0+)?\s*(?:g|oz|lb)[^)]*\)\s*in die schüssel\.?/i,
    sl: /v posodo dodajte preostalo moko\s*\(\s*0(?:[,.]0+)?\s*(?:g|oz|lb)[^)]*\)\.?/i,
  } as const)[input.lang];
  const zeroWaterAnnotations = ({
    hr: /(?:početna tekuća voda|količina preostale tekuće vode za postupno dodavanje):\s*[−-]?0(?:[,.]0+)?\s*g\.?/gi,
    en: /(?:initial liquid water|remaining liquid water to add gradually):\s*[−-]?0(?:[,.]0+)?\s*g\.?/gi,
    de: /(?:anfängliches flüssigwasser|verbleibendes flüssigwasser zur schrittweisen zugabe):\s*[−-]?0(?:[,.]0+)?\s*g\.?/gi,
    sl: /(?:začetna tekoča voda|količina preostale tekoče vode za postopno dodajanje):\s*[−-]?0(?:[,.]0+)?\s*g\.?/gi,
  } as const)[input.lang];
  const waterWords = ({ hr: /vod/i, en: /water/i, de: /wasser/i, sl: /vod/i } as const)[input.lang];
  const waterActionPatterns = ({
    hr: [
      /(?:prstima i šakama pritišćite komade bige u vodi[^.!?]*[.!?]?)/gi,
      /(?:kako tijesto upija,\s*)?,?\s*polako(?: u mlazevima)? dolijevajte ostatak vode(\s+i mijesite)?/gi,
      /,?\s*prelijte(?: je)?(?: s tom| zadnjom)? vodom/gi,
      /kad ostane malo vode,\s*/gi,
      /(?:i\s*)?početnih?\s*[−-]?0(?:[,.]0+)?\s*g(?:\s*\([^)]*\))?(?:\s*tekuće vode)?/gi,
      /(?:i\s*)?preostalih?\s*[−-]?0(?:[,.]0+)?\s*g(?:\s*\([^)]*\))?(?:\s*tekuće vode)?/gi,
      /(?:i\s*)?(?:dodajte|ulijte|dolijte)\s*[−-]?0(?:[,.]0+)?\s*g\s+(?:tekuće )?vode/gi,
    ],
    en: [
      /(?:press the biga pieces in the water[^.!?]*[.!?]?)/gi,
      /(?:as the dough absorbs,\s*)?,?\s*slowly stream in the remaining water(\s+and knead)?/gi,
      /,?\s*pour it in with that last water/gi,
      /,?\s*pour in the last water/gi,
      /when only a little water is left,\s*/gi,
      /(?:and\s*)?initial\s*[−-]?0(?:[,.]0+)?\s*g(?:\s*\([^)]*\))?(?:\s*of final-dough liquid water)?/gi,
      /(?:and\s*)?remaining\s*[−-]?0(?:[,.]0+)?\s*g(?:\s*\([^)]*\))?(?:\s*liquid water)?/gi,
      /(?:and\s*)?(?:add|pour|stream in)\s*[−-]?0(?:[,.]0+)?\s*g\s+(?:of )?water/gi,
    ],
    de: [
      /(?:drücken sie die biga-stücke[^.!?]*im wasser[^.!?]*[.!?]?)/gi,
      /(?:während der teig aufnimmt,\s*)?,?\s*gießen sie langsam(?: in strömen)? das restliche wasser ein(\s+und kneten weiter)?/gi,
      /,?\s*übergießen sie (?:es|sie) mit dem letzten wasser/gi,
      /wenn nur noch wenig wasser übrig ist,\s*/gi,
      /(?:und\s*)?anfänglichen\s*[−-]?0(?:[,.]0+)?\s*g(?:\s*\([^)]*\))?(?:\s+des flüssigen wassers für den hauptteig)?/gi,
      /(?:und\s*)?übrigen\s*[−-]?0(?:[,.]0+)?\s*g(?:\s*\([^)]*\))?(?:\s+flüssiges wasser)?/gi,
      /(?:und\s*)?(?:geben sie|gießen sie)\s*[−-]?0(?:[,.]0+)?\s*g\s+(?:flüssiges )?wasser/gi,
    ],
    sl: [
      /(?:s prsti in pestmi stiskajte kose bige v vodi[^.!?]*[.!?]?)/gi,
      /(?:ko testo vpija,\s*)?,?\s*počasi(?: v curkih)? dolivajte preostalo vodo(\s+in gnetite)?/gi,
      /,?\s*prelijte(?: jo)?(?: s to| z zadnjo)? vodo/gi,
      /ko ostane malo vode,\s*/gi,
      /(?:in\s*)?začetnih\s*[−-]?0(?:[,.]0+)?\s*g(?:\s*\([^)]*\))?(?:\s+tekoče vode za končno testo)?/gi,
      /(?:in\s*)?preostalih\s*[−-]?0(?:[,.]0+)?\s*g(?:\s*\([^)]*\))?(?:\s+tekoče vode)?/gi,
      /(?:in\s*)?(?:dodajte|vlijte|prilijte)\s*[−-]?0(?:[,.]0+)?\s*g\s+(?:tekoče )?vode/gi,
    ],
  } as const)[input.lang];
  const usefulActionWords = ({
    hr: /brašn|mikser|brzin|sol|mijes|zamjes|biga|poolish/i,
    en: /flour|mixer|speed|salt|knead|mix|biga|poolish/i,
    de: /mehl|mixer|stufe|salz|knet|misch|biga|poolish/i,
    sl: /moko|mešal|hitrost|sol|gnet|meš|biga|poolish/i,
  } as const)[input.lang];
  const finalMixStepsWithoutZeroWater = finalMixSteps.flatMap((step) => {
    let cleaned = step.replace(zeroWaterAnnotations, '');
    if (input.remaining.flour === 0) cleaned = cleaned.replace(zeroRemainingFlourAction, '');
    const sentences = cleaned.split(/(?<=[.!?])\s+/).flatMap((sentence) => {
      if (input.remaining.yeast <= 0 && yeastPattern.test(sentence) && zeroAmountPattern.test(sentence)) return [];
      let clause = sentence;
      const displayedZeroWaterPortion = zeroAmountPattern.test(sentence) && waterWords.test(sentence);
      let removedZeroWaterAction = false;
      if (input.remaining.water <= 0 || displayedZeroWaterPortion) {
        const applicablePatterns = input.remaining.water <= 0 ? waterActionPatterns : waterActionPatterns.slice(5);
        for (const pattern of applicablePatterns) {
          const before = clause;
          clause = clause.replace(pattern, (_match, preservedAction: string | undefined) => preservedAction ?? '');
          removedZeroWaterAction ||= clause !== before;
        }
        if (waterWords.test(clause) && /\b(?:0(?:[,.]0+)?\s*g|g\s*0(?:[,.]0+)?)/i.test(clause) && !usefulActionWords.test(clause)) return [];
      }
      if (removedZeroWaterAction) clause = clause.replace(/,\s*(and|und|i|in)\s+/gi, ' $1 ');
      return clause.replace(/[\s,;:.!?]+/g, '').length > 0 ? [clause] : [];
    });
    cleaned = sentences.join(' ')
      .replace(/\s{2,}/g, ' ')
      .replace(/,\s*,/g, ',')
      .replace(/,\s*(and|und|i|in)\s*([.!?])/gi, ' $1$2')
      .replace(/\s+([,.;:])/g, '$1')
      .replace(/(?:,\s*){2,}/g, ', ')
      .replace(/(?:absorbs|upija|aufnimmt|vpija),\s*([.!?])/gi, '$1')
      .replace(/[,;:]\s*[.!?]/g, '.')
      .trim();
    return cleaned ? [cleaned] : [];
  });
  return {
    biga: buildPreparationPhase('biga', input),
    poolish: buildPreparationPhase('poolish', input),
    finalMixSteps: finalMixStepsWithoutZeroWater,
    postMixSteps: postMixSteps.map((step) => fixedBallWeightPattern.test(step) ? ballingStep : step),
    selectedBallingStep: ballingStep,
  };
}