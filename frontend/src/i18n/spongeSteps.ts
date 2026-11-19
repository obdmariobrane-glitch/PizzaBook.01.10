import type { CommercialYeastType } from '../calculator';
import type { Lang } from './translations';

export type SpongePreparationPhase = {
  title: string;
  steps: string[];
  timer: { id: string; seconds: number; kind: 'preferment' };
};

export type SpongePreparationInput = {
  flour: string;
  water: string;
  yeast: string;
  yeastPct: string;
  yeastType: CommercialYeastType;
  fermentationTemp: string;
  fermentationHours: number;
};

export const SPONGE_COPY: Record<Lang, {
  flourShare: string;
  hydration: string;
  fermentationTemp: string;
  fermentationDuration: string;
  yeastType: string;
  yeastMode: string;
  automatic: string;
  manual: string;
  manualYeast: string;
  spongeYeastLabel: string;
  finalDoughYeastLabel: string;
  fresh: string;
  activeDry: string;
  instantDry: string;
  empty: string;
  invalid: string;
  zero: string;
  negative: string;
  unreasonable: string;
  allocationInvalid: string;
  ready: string;
}> = {
  hr: {
    flourShare: 'Brašno za Sponge (% ukupnog brašna)',
    hydration: 'Hidratacija Spongea (%)',
    fermentationTemp: 'Temperatura fermentacije Spongea',
    fermentationDuration: 'Trajanje fermentacije Spongea (h)',
    yeastType: 'Kvasac za Sponge',
    yeastMode: 'Izračun kvasca za Sponge',
    automatic: 'Automatski',
    manual: 'Ručno',
    manualYeast: 'Kvasac za Sponge (g)',
    spongeYeastLabel: 'Kvasac za Sponge',
    finalDoughYeastLabel: 'Kvasac za završno tijesto',
    fresh: 'Svježi',
    activeDry: 'Aktivni suhi',
    instantDry: 'Instant suhi',
    empty: 'Unesite količinu kvasca za Sponge.',
    invalid: 'Unesite valjanu količinu kvasca u gramima.',
    zero: 'Količina kvasca mora biti veća od nule.',
    negative: 'Količina kvasca ne može biti negativna.',
    unreasonable: 'Količina kvasca mora biti najviše 10% brašna za Sponge.',
    allocationInvalid: 'Ukupna hidratacija mora biti dovoljna za vodu u Spongeu.',
    ready: 'Sponge dodajte završnom tijestu dok je narastao i pun mjehurića, prije nego što počne splašnjavati.',
  },
  en: {
    flourShare: 'Sponge flour (% of total flour)',
    hydration: 'Sponge hydration (%)',
    fermentationTemp: 'Sponge fermentation temperature',
    fermentationDuration: 'Sponge fermentation duration (h)',
    yeastType: 'Sponge yeast type',
    yeastMode: 'Sponge yeast calculation',
    automatic: 'Automatic',
    manual: 'Manual',
    manualYeast: 'Sponge yeast (g)',
    spongeYeastLabel: 'Sponge yeast',
    finalDoughYeastLabel: 'Final-dough yeast',
    fresh: 'Fresh',
    activeDry: 'Active dry',
    instantDry: 'Instant dry',
    empty: 'Enter the Sponge yeast quantity.',
    invalid: 'Enter a valid yeast quantity in grams.',
    zero: 'Yeast quantity must be greater than zero.',
    negative: 'Yeast quantity cannot be negative.',
    unreasonable: 'Yeast quantity must be no more than 10% of Sponge flour.',
    allocationInvalid: 'Total hydration must cover the water allocated to the Sponge.',
    ready: 'Add the Sponge to the final dough while risen and aerated, before it starts to collapse.',
  },
  de: {
    flourShare: 'Sponge-Mehl (% des Gesamtmehls)',
    hydration: 'Sponge-Hydration (%)',
    fermentationTemp: 'Sponge-Gärtemperatur',
    fermentationDuration: 'Sponge-Gärdauer (h)',
    yeastType: 'Hefe für den Sponge',
    yeastMode: 'Berechnung der Sponge-Hefe',
    automatic: 'Automatisch',
    manual: 'Manuell',
    manualYeast: 'Sponge-Hefe (g)',
    spongeYeastLabel: 'Sponge-Hefe',
    finalDoughYeastLabel: 'Hefe für den Hauptteig',
    fresh: 'Frischhefe',
    activeDry: 'Aktiv-Trockenhefe',
    instantDry: 'Instant-Trockenhefe',
    empty: 'Geben Sie die Sponge-Hefemenge ein.',
    invalid: 'Geben Sie eine gültige Hefemenge in Gramm ein.',
    zero: 'Die Hefemenge muss größer als null sein.',
    negative: 'Die Hefemenge darf nicht negativ sein.',
    unreasonable: 'Die Hefemenge darf höchstens 10 % des Sponge-Mehls betragen.',
    allocationInvalid: 'Die Gesamthydration muss für die Wassermenge im Sponge ausreichen.',
    ready: 'Den Sponge zum Hauptteig geben, solange er aufgegangen und luftig ist, bevor er zusammenfällt.',
  },
  sl: {
    flourShare: 'Moka za Sponge (% skupne moke)',
    hydration: 'Hidracija Spongea (%)',
    fermentationTemp: 'Temperatura fermentacije Spongea',
    fermentationDuration: 'Trajanje fermentacije Spongea (h)',
    yeastType: 'Kvas za Sponge',
    yeastMode: 'Izračun kvasa za Sponge',
    automatic: 'Samodejno',
    manual: 'Ročno',
    manualYeast: 'Kvas za Sponge (g)',
    spongeYeastLabel: 'Kvas za Sponge',
    finalDoughYeastLabel: 'Kvas za končno testo',
    fresh: 'Sveži',
    activeDry: 'Aktivni suhi',
    instantDry: 'Instant suhi',
    empty: 'Vnesite količino kvasa za Sponge.',
    invalid: 'Vnesite veljavno količino kvasa v gramih.',
    zero: 'Količina kvasa mora biti večja od nič.',
    negative: 'Količina kvasa ne sme biti negativna.',
    unreasonable: 'Količina kvasa je lahko največ 10 % moke za Sponge.',
    allocationInvalid: 'Skupna hidracija mora zadoščati za količino vode v Spongeu.',
    ready: 'Sponge dodajte končnemu testu, ko je vzhajan in poln mehurčkov, preden se začne sesedati.',
  },
};

const YEAST_INSTRUCTIONS: Record<Lang, Record<CommercialYeastType, string>> = {
  hr: {
    fresh: 'Svježi kvasac otopite u dijelu izmjerene vode za Sponge.',
    activeDry: 'Aktivni suhi kvas otopite prema uputama na pakiranju u dijelu izmjerene vode za Sponge.',
    dry: 'Instant suhi kvas ravnomjerno umiješajte u brašno za Sponge.',
  },
  en: {
    fresh: 'Dissolve the fresh yeast in part of the measured Sponge water.',
    activeDry: 'Dissolve the active dry yeast according to the package directions in part of the measured Sponge water.',
    dry: 'Mix the instant dry yeast evenly into the Sponge flour.',
  },
  de: {
    fresh: 'Die Frischhefe in einem Teil des abgemessenen Sponge-Wassers auflösen.',
    activeDry: 'Die Aktiv-Trockenhefe nach Packungsanleitung in einem Teil des abgemessenen Sponge-Wassers auflösen.',
    dry: 'Die Instant-Trockenhefe gleichmäßig unter das Sponge-Mehl mischen.',
  },
  sl: {
    fresh: 'Sveži kvas raztopite v delu odmerjene vode za Sponge.',
    activeDry: 'Aktivni suhi kvas po navodilih na embalaži raztopite v delu odmerjene vode za Sponge.',
    dry: 'Instant suhi kvas enakomerno vmešajte v moko za Sponge.',
  },
};

export function getSpongePreparationPhase(
  lang: Lang,
  input: SpongePreparationInput,
): SpongePreparationPhase {
  const copy = SPONGE_COPY[lang];
  const yeastName = copy[input.yeastType === 'fresh' ? 'fresh' : input.yeastType === 'activeDry' ? 'activeDry' : 'instantDry'];
  const unit = lang === 'de' ? 'Stunden' : lang === 'hr' ? 'sati' : lang === 'sl' ? 'ur' : 'hours';
  const measure = {
    hr: `Odmjerite ${input.flour} brašna, ${input.water} vode i ${input.yeast} ${yeastName.toLowerCase()} za Sponge (${input.yeastPct}% prema brašnu za Sponge). Kvasac za završni zamjes ostaje zaseban.`,
    en: `Measure ${input.flour} flour, ${input.water} water, and ${input.yeast} ${yeastName.toLowerCase()} for the Sponge (${input.yeastPct}% relative to Sponge flour). Keep final-dough yeast separate.`,
    de: `Wiegen Sie ${input.flour} Mehl, ${input.water} Wasser und ${input.yeast} ${yeastName} für den Sponge ab (${input.yeastPct} % bezogen auf das Sponge-Mehl). Die Hefe für den Hauptteig bleibt getrennt.`,
    sl: `Odmerite ${input.flour} moke, ${input.water} vode in ${input.yeast} kvasa (${yeastName.toLowerCase()}) za Sponge (${input.yeastPct}% glede na moko za Sponge). Kvas za končno testo ostane ločen.`,
  }[lang];
  const mix = {
    hr: `Pomiješajte brašno i vodu za Sponge s pripremljenim kvascem dok ne nastane ujednačena, mekana smjesa. Ne dodajte sastojke za završni zamjes.`,
    en: 'Combine the Sponge flour and water with the prepared yeast until evenly mixed into a soft, cohesive dough. Do not add final-mix ingredients.',
    de: 'Sponge-Mehl und -Wasser mit der vorbereiteten Hefe zu einer gleichmäßigen, weichen Masse vermischen. Keine Zutaten für den Hauptteig zugeben.',
    sl: 'Moko in vodo za Sponge zmešajte s pripravljenim kvasom v enotno, mehko zmes. Sestavin za končno testo še ne dodajajte.',
  }[lang];
  const ferment = {
    hr: `Pokrijte Sponge i fermentirajte ga ${input.fermentationHours} ${unit} pri ${input.fermentationTemp}. Upotrebljavajte ga kada naraste i postane prozračan, prije nego što se počne spuštati.`,
    en: `Cover the Sponge and ferment it for ${input.fermentationHours} ${unit} at ${input.fermentationTemp}. Use it when risen and aerated, before it starts to collapse.`,
    de: `Den Sponge abdecken und ${input.fermentationHours} ${unit} bei ${input.fermentationTemp} gären lassen. Verwenden, wenn er aufgegangen und luftig ist, bevor er zusammenfällt.`,
    sl: `Sponge pokrijte in ga fermentirajte ${input.fermentationHours} ${unit} pri ${input.fermentationTemp}. Uporabite ga, ko naraste in postane zračen, preden se začne sesedati.`,
  }[lang];
  return {
    title: {
      hr: 'Faza A: Priprema Spongea',
      en: 'Phase A: Prepare the Sponge',
      de: 'Phase A: Sponge zubereiten',
      sl: 'Faza A: Priprava Spongea',
    }[lang],
    steps: [measure, YEAST_INSTRUCTIONS[lang][input.yeastType], mix, ferment, copy.ready],
    timer: { id: 'sponge-fermentation', seconds: input.fermentationHours * 3600, kind: 'preferment' },
  };
}
