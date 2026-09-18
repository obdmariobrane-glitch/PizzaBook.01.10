// Pizza calculator logic
export type Method = 'direct' | 'biga' | 'poolish';
export type YeastType = 'fresh' | 'dry' | 'sourdough';
export type Mixing = 'hand' | 'home' | 'spiral';
export type Fermentation = 'sameDay' | 'coldLong';
export type OvenType = 'ooni' | 'homeStone' | 'homePan';
export type PizzaStyle = 'neapolitan' | 'romana' | 'ny_style';

export type FlourType = 'caputo00' | 'manitoba' | 'spelt' | 'wholeWheat' | 'glutenFree' | 'custom';

export type PizzaStyleProfile = {
  defaultDiameter: number;
  ballWeight: number;
  hydration: number;
  saltPct: number;
  oilPct: number;
  flourTypes: FlourType[];
  fermentation: 'sameDay' | 'coldLong';
  bakeTemp: string;
  bakeTime: string;
  shaping: string;
};

export const PIZZA_STYLE_PROFILES: Record<PizzaStyle, PizzaStyleProfile> = {
  neapolitan: {
    defaultDiameter: 30, ballWeight: 250, hydration: 62, saltPct: 2.9, oilPct: 2,
    flourTypes: ['caputo00'], fermentation: 'coldLong', bakeTemp: '450°C+', bakeTime: '60–90 s',
    shaping: 'Ručno širenje zraka prema rubu',
  },
  romana: {
    defaultDiameter: 33, ballWeight: 210, hydration: 59, saltPct: 2.8, oilPct: 4,
    flourTypes: ['caputo00', 'spelt'], fermentation: 'coldLong', bakeTemp: '250–300°C', bakeTime: '5–7 min',
    shaping: 'Razvlačenje valjkom za tanku, hrskavu koru',
  },
  ny_style: {
    defaultDiameter: 35, ballWeight: 375, hydration: 64, saltPct: 2.3, oilPct: 3,
    flourTypes: ['manitoba', 'caputo00'], fermentation: 'coldLong', bakeTemp: '280–350°C', bakeTime: '5–7 min',
    shaping: 'Ručno širenje uz izražen, savitljiv rub',
  },
};

export const FLOUR_PROFILES: Record<FlourType, { label: string; ideal: number; min: number; max: number }> = {
  caputo00: { label: 'Tipo 0 / 00', ideal: 65, min: 60, max: 70 },
  manitoba: { label: 'Manitoba / Visoki W', ideal: 72, min: 70, max: 80 },
  spelt: { label: 'Pirovo brašno', ideal: 62, min: 60, max: 65 },
  wholeWheat: { label: 'Integralno brašno', ideal: 70, min: 68, max: 75 },
  glutenFree: { label: 'Bezglutensko brašno', ideal: 80, min: 75, max: 85 },
  custom: { label: 'Mješavina brašna', ideal: 68, min: 55, max: 90 },
};

// Base flours available for blending (excludes 'custom' itself)
export const BASE_FLOURS: Exclude<FlourType, 'custom'>[] = [
  'caputo00', 'manitoba', 'spelt', 'wholeWheat', 'glutenFree',
];

export function blendIdealHydration(a: Exclude<FlourType, 'custom'>, b: Exclude<FlourType, 'custom'>, pctA: number) {
  const pctB = 100 - pctA;
  return Math.round((FLOUR_PROFILES[a].ideal * pctA + FLOUR_PROFILES[b].ideal * pctB) / 100);
}

// Exact normative table per pizza diameter (from spec)
const DIMENSION_TABLE: Record<number, { ball: number; sauce: number; cheese: number }> = {
  26: { ball: 220, sauce: 70, cheese: 75 },
  28: { ball: 240, sauce: 80, cheese: 85 },
  30: { ball: 260, sauce: 85, cheese: 90 },
  33: { ball: 280, sauce: 95, cheese: 100 },
  35: { ball: 310, sauce: 105, cheese: 110 },
  40: { ball: 380, sauce: 130, cheese: 140 },
};

export function dimensionsCalc(diameter: number, pizzas: number) {
  // Use exact table when known; otherwise scale from nearest entry
  const exact = DIMENSION_TABLE[diameter];
  if (exact) {
    return {
      doughBall: exact.ball,
      sauce: exact.sauce,
      cheese: exact.cheese,
      totalDough: exact.ball * pizzas,
    };
  }
  // Scale from 30cm as baseline
  const base = DIMENSION_TABLE[30];
  const area = Math.PI * (diameter / 2) ** 2;
  const baseArea = Math.PI * 15 * 15;
  const factor = area / baseArea;
  return {
    doughBall: Math.round(base.ball * factor),
    sauce: Math.round(base.sauce * factor),
    cheese: Math.round(base.cheese * factor),
    totalDough: Math.round(base.ball * factor) * pizzas,
  };
}

export function doughCalc(opts: {
  pizzas: number; ballWeight: number; hydration: number; saltPct: number; oilPct: number;
  method: Method;
  bigaPct?: number;
  poolishPct?: number;
  roomHours: number; roomTemp: number;
  fridgeHours: number; fridgeTemp: number;
  prefermentHours?: number;
  prefermentRoomHours?: number;
  prefermentFridgeHours?: number;
  yeastType?: YeastType;
  mixing?: Mixing;
  flourType?: FlourType;
}) {
  // === Fermentation math (dynamic yeast) ===
  // E_RT = roomHours × (1 + 0.08 × (roomTemp - 20))
  const eRT = Math.max(0, opts.roomHours) * (1 + 0.08 * (opts.roomTemp - 20));
  // E_CT = fridgeHours × (0.12 × (1 + 0.05 × (fridgeTemp - 4)))
  const eCT = Math.max(0, opts.fridgeHours) * (0.12 * (1 + 0.05 * (opts.fridgeTemp - 4)));
  const prefermentRoomHours = Math.max(0, opts.prefermentRoomHours ?? 0);
  const prefermentFridgeHours = Math.max(0, opts.prefermentFridgeHours ?? 0);
  const ePreferment = prefermentRoomHours * (1 + 0.08 * (opts.roomTemp - 20))
    + prefermentFridgeHours * (0.12 * (1 + 0.05 * (opts.fridgeTemp - 4)));
  const eTotal = Math.max(0.5, eRT + eCT + ePreferment); // clamp min to avoid explosion
  // yeastPct = K / E_total (K = factor constant; 0.5 gives ~0.1% fresh yeast for 24h cold ferment @4°C + 2h RT @22°C)
  const K = 0.5;
  let yeastPct = K / eTotal;
  if (opts.yeastType === 'dry') yeastPct /= 3;
  const bigaPrefermentShare = 7 / 12;
  const poolishPrefermentShare = 5 / 12;
  const effectiveYeastPct = yeastPct;

  // === Baker's percentages ===
  const totalDough = opts.pizzas * opts.ballWeight;
  const psylliumPct = opts.flourType === 'glutenFree' ? 2 : 0;
  const totalPercent = 100 + opts.hydration + opts.saltPct + effectiveYeastPct + opts.oilPct + psylliumPct;
  const flour = (totalDough / totalPercent) * 100;
  const water = flour * (opts.hydration / 100);
  const salt = flour * (opts.saltPct / 100);
  const yeast = flour * (yeastPct / 100);
  const oil = flour * (opts.oilPct / 100);
  const psyllium = flour * (psylliumPct / 100);

  // Water temp — rule 55/60 (spiral 55, hand/home 60), clamped by cold ferment
  const rule = opts.mixing === 'spiral' ? 55 : 60;
  let waterTemp = rule - opts.roomTemp;
  if (opts.fridgeHours >= 12) waterTemp = Math.min(waterTemp, 10);
  waterTemp = Math.max(2, Math.min(30, waterTemp));

  // Rounding helpers per spec
  const R0 = (n: number) => Math.round(n);
  const R1 = (n: number) => Math.round(n * 10) / 10;
  const R2 = (n: number) => Math.round(n * 100) / 100;

  const buildBlock = () => ({
    flour: R0(flour), water: R0(water),
    salt: R1(salt), oil: R0(oil), yeast: R2(yeast),
    psyllium: R0(psyllium),
  });

  if (opts.method === 'biga') {
    // Biga: configurable flour percentage and 45% hydration. Yeast quantity follows fermentation conditions.
    const bigaFlour = flour * (Math.max(20, Math.min(100, opts.bigaPct ?? 50)) / 100);
    const bigaWater = bigaFlour * 0.45;
    const bigaYeast = flour * (yeastPct * bigaPrefermentShare / 100);
    const mainYeast = flour * (yeastPct * (1 - bigaPrefermentShare) / 100);
    return {
      method: 'biga' as const,
      preferment: { flour: R0(bigaFlour), water: R0(bigaWater), yeast: R2(bigaYeast) },
      main: {
        flour: R0(flour - bigaFlour), water: R0(water - bigaWater),
        salt: R1(salt), oil: R0(oil), yeast: R2(mainYeast),
        psyllium: R0(psyllium),
      },
      total: { ...buildBlock(), yeast: R2(bigaYeast + mainYeast) },
      totalDough: R0(totalDough),
      waterTemp: R0(waterTemp),
      yeastPct: R2(effectiveYeastPct),
      eTotal: R1(eTotal),
    };
  }

  if (opts.method === 'poolish') {
    // Poolish: configurable flour percentage and 100% hydration. Yeast quantity follows fermentation conditions.
    const pFlour = flour * (Math.max(20, Math.min(100, opts.poolishPct ?? 35)) / 100);
    const pWater = pFlour * 1.0;
    const pYeast = flour * (yeastPct * poolishPrefermentShare / 100);
    const mainYeast = flour * (yeastPct * (1 - poolishPrefermentShare) / 100);
    return {
      method: 'poolish' as const,
      preferment: { flour: R0(pFlour), water: R0(pWater), yeast: R2(pYeast) },
      main: {
        flour: R0(flour - pFlour), water: R0(water - pWater),
        salt: R1(salt), oil: R0(oil), yeast: R2(mainYeast),
        psyllium: R0(psyllium),
      },
      total: { ...buildBlock(), yeast: R2(pYeast + mainYeast) },
      totalDough: R0(totalDough),
      waterTemp: R0(waterTemp),
      yeastPct: R2(effectiveYeastPct),
      eTotal: R1(eTotal),
    };
  }

  // Direct
  return {
    method: 'direct' as const,
    preferment: null,
    main: buildBlock(),
    total: buildBlock(),
    totalDough: R0(totalDough),
    waterTemp: R0(waterTemp),
    yeastPct: R2(yeastPct),
    eTotal: R1(eTotal),
  };
}

export function bakingCalc(oven: OvenType) {
  if (oven === 'ooni') {
    return {
      temp: '430–500°C',
      time: '60–90 s',
      steps: [
        'Zagrij peć min 20 minuta na max.',
        'Stavi pizzu i rotiraj svakih 20-30 sekundi.',
        'Vadi kad je rub zapečen i s tamnim mrljama (leopardiranje).',
      ],
    };
  }
  if (oven === 'homeStone') {
    return {
      temp: '300°C + grill',
      time: '4–6 min',
      steps: [
        'Postavi kamen ili čelik dvije rešetke ispod gornjeg grijača i zagrij ga 45–60 min na max.',
        'Uključi gornji grill 5 min prije stavljanja pizze.',
        'Pizza ide na kamen 4-6 minuta.',
        'Zadnjih 30-60 s pod grillom da se sir zapeče.',
      ],
    };
  }
  return {
    temp: '250–280°C',
    time: '8–10 min',
    steps: [
      'Zagrij pećnicu na max s ventilacijom.',
      'Peci pizzu na SAMOM DNU pećnice (u protvanu) 5-7 min da dno bude hrskavo.',
      'Prebaci na gornju rešetku pod grill 2-3 min da se sir i rub zapeku.',
      'ZLATNO PRAVILO: Ne skreći pogled dok je pizza u pećnici!',
    ],
  };
}

export function iceCalc(totalWater: number, tapTemp: number, targetTemp: number) {
  // simple energy balance: ice at 0°C, water at tap.
  // (mIce * 80 + mIce * (0 - target)) = mWater * (tap - target)
  // Using L=80 cal/g latent heat of ice.
  const q = totalWater * (tapTemp - targetTemp);
  const iceCap = 80 + (targetTemp - 0);
  const ice = Math.max(0, Math.min(totalWater * 0.5, q / iceCap));
  return {
    ice: Math.round(ice),
    water: Math.round(totalWater - ice),
  };
}

export function reversePlan(bakeAt: Date, method: Method, style: PizzaStyle = 'neapolitan') {
  const steps: { at: Date; title: string; desc: string }[] = [];
  const push = (offsetMin: number, title: string, desc: string) => {
    const at = new Date(bakeAt.getTime() - offsetMin * 60000);
    steps.push({ at, title, desc });
  };

  if (style !== 'neapolitan') {
    const isRoman = style === 'romana';
    const styleName = isRoman ? 'Romana' : 'New York Style';
    const warmBeforeBake = isRoman ? 75 : 75;
    const ballsColdHours = 24;
    const bulkMinutes = method === 'direct' ? 60 : method === 'biga' ? 60 : 60;
    const finalMixHours = method === 'direct' ? 0 : method === 'biga' ? 18 : 16;

    push(60, 'Upali pećnicu / kamen', isRoman ? 'Zagrij pećnicu prema Romana uputama 45–60 minuta prije pečenja.' : 'Zagrij pećnicu prema New York Style uputama 35–50 minuta prije pečenja.');
    push(warmBeforeBake, 'Izvadi loptice iz hladnjaka', `Izvadi ${styleName} loptice 1 sat 15 minuta prije pečenja ili kad se približno udvostruče, ali ne dopusti da predugo fermentiraju.`);
    push(warmBeforeBake + ballsColdHours * 60, 'Hladna fermentacija kugli', `Drži kugle ${ballsColdHours} sati u zatvorenoj kutiji na 4°C. Nakon tog vremena izvaditi ih 1 sat 15 minuta prije pečenja ili kad se približno udvostruče, ali ne dopustiti predugodu fermentaciju.`);

    if (method === 'direct') {
      push(warmBeforeBake + ballsColdHours * 60 + bulkMinutes, 'Bulk fermentacija', `Ostavi ${styleName} tijesto ${bulkMinutes === 60 ? '1 sat' : `${bulkMinutes} minuta`} na sobnoj temperaturi, zatim podijeli i oblikuj kugle.`);
      push(warmBeforeBake + ballsColdHours * 60 + bulkMinutes, 'Zamijesi tijesto', isRoman ? 'Direktno: dodaj 90% vode s kvascem, zatim brašno, sol, ostatak vode i 3–5% ulja. Ručno 12–15 minuta ili mikserom 8–10 minuta.' : 'Direktno: dodaj 90% vode s kvascem i šećerom, zatim brašno, sol, ostatak vode i 2–4% ulja. Ručno 12–15 minuta ili mikserom 8–10 minuta.');
    } else {
      const prefermentName = method === 'biga' ? 'Bigu' : 'Poolish';
      push(warmBeforeBake + ballsColdHours * 60 + bulkMinutes, 'Bulk fermentacija nakon završnog zamjesa', `Ostavi završno tijesto ${bulkMinutes === 60 ? '1 sat' : '45 minuta'} na sobnoj temperaturi, zatim oblikuj kugle.`);
      push(warmBeforeBake + ballsColdHours * 60 + bulkMinutes + finalMixHours * 60, `Završni zamjes (${prefermentName})`, `Spoji ${prefermentName} s preostalim sastojcima; ${method === 'biga' ? 'ručno mijesi 12–14 minuta ili radi mikserom oko 8 minuta.' : 'ručno mijesi 10–12 minuta ili radi mikserom 7–9 minuta.'}`);
      push(warmBeforeBake + ballsColdHours * 60 + bulkMinutes + finalMixHours * 60 + (method === 'biga' ? 16 * 60 : 16 * 60), `Izrada ${prefermentName}`, method === 'biga' ? 'Napravite bigu s 44% vode i ostavite 16–18 sati na 16–18°C.' : 'Napravite Poolish s omjerom vode i brašna 1:1 i ostavite 16–24 sata u hladnjaku.');
    }
    return steps.sort((a, b) => a.at.getTime() - b.at.getTime());
  }

  // reverse order
  push(60, 'Upali pećnicu / kamen', 'Zagrij pećnicu na max 45-60 min prije pečenja.');
  const profile = PIZZA_STYLE_PROFILES[style];
  push(60 * 5, 'Formiranje bulica', `Napravi loptice (${profile.ballWeight}g) i ostavi na sobnoj temperaturi da odstoje.`);
  if (method === 'biga') {
    push(60 * 24, 'Završni zamjes (rinfresco)', 'Dodaj preostalo brašno, vodu, sol i ulje u bigu i zamijesi.');
    push(60 * 24 + 60 * 18, 'Zamijesi Bigu', '50% brašna, 45% hidratacija, 1% kvasca. Stoji 16-18h na sobnoj temp.');
  } else if (method === 'poolish') {
    push(60 * 24, 'Završni zamjes', 'Dodaj preostalo brašno, vodu, sol i ulje u poolish i zamijesi.');
    push(60 * 24 + 60 * 14, 'Zamijesi Poolish', '35% brašna, 100% hidratacija, 0.1% kvasca. Stoji 12-14h na sobnoj temp.');
  } else {
    const directHours = style === 'neapolitan' ? 8 : 24;
    push(60 * directHours, 'Zamijesi tijesto', 'Direktna metoda za Napolitanu - zamijesi sve sastojke i stavi na fermentaciju.');
  }
  return steps.sort((a, b) => a.at.getTime() - b.at.getTime());
}
