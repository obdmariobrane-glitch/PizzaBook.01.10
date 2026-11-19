import { formatDuration, type BaseTimer } from './prefermentSteps';
import type { Lang } from './translations';

type Phase = {
  title: string;
  steps: string[];
  timers?: BaseTimer[];
};

export const PRO_NAPOLITANA_MIX_REST_SECONDS = 5 * 60;

export function getProNapolitanaBulkRestSeconds(roomTemp: number): number {
  return Math.max(15, Math.round(30 * (22 / Math.max(10, roomTemp)))) * 60;
}

const copy = {
  hr: {
    transfer: 'Lagano nauljite fermentacijsku posudu i prebacite tijesto u nju.',
    rest: (duration: string) => `Pokrijte posudu i ostavite tijesto ${duration} na sobnoj temperaturi.`,
    fold: (number: number) => `Napravite ${number === 1 ? 'prvi' : 'drugi'} Stretch & Fold.`,
    noRoom: 'Odabrani raspored ne uključuje početnu fermentaciju na sobnoj temperaturi; nemojte dodavati vrijeme.',
    check: 'Provjerite prve znakove fermentacije prije nastavka.',
  },
  en: {
    transfer: 'Lightly oil the fermentation container and transfer the dough into it.',
    rest: (duration: string) => `Cover the container and let the dough rest for ${duration} at room temperature.`,
    fold: (number: number) => `Perform the ${number === 1 ? 'first' : 'second'} Stretch & Fold.`,
    noRoom: 'The selected schedule has no initial room-temperature fermentation; do not add extra time.',
    check: 'Check for the first signs of fermentation before continuing.',
  },
  de: {
    transfer: 'Ölen Sie den Gärbehälter leicht ein und geben Sie den Teig hinein.',
    rest: (duration: string) => `Decken Sie den Behälter ab und lassen Sie den Teig ${duration} bei Raumtemperatur ruhen.`,
    fold: (number: number) => `Führen Sie das ${number === 1 ? 'erste' : 'zweite'} Stretch & Fold durch.`,
    noRoom: 'Der ausgewählte Zeitplan enthält keine anfängliche Fermentation bei Raumtemperatur; fügen Sie keine Zeit hinzu.',
    check: 'Prüfen Sie vor dem Fortfahren auf erste Fermentationszeichen.',
  },
  sl: {
    transfer: 'Fermentacijsko posodo rahlo naoljite in vanjo prenesite testo.',
    rest: (duration: string) => `Posodo pokrijte in testo pustite ${duration} počivati pri sobni temperaturi.`,
    fold: (number: number) => `Izvedite ${number === 1 ? 'prvi' : 'drugi'} prepogib Stretch & Fold.`,
    noRoom: 'Izbrani načrt ne vključuje začetne fermentacije pri sobni temperaturi; ne dodajajte časa.',
    check: 'Pred nadaljevanjem preverite prve znake fermentacije.',
  },
} satisfies Record<Lang, {
  transfer: string;
  rest: (duration: string) => string;
  fold: (number: number) => string;
  noRoom: string;
  check: string;
}>;

export function adaptProDirectBulkPhase<T extends Phase>(
  phase: T,
  lang: Lang,
  totalSeconds: number,
  nominalRestSeconds: number,
): T {
  let remainingSeconds = Math.max(0, Math.round(totalSeconds));
  const nominalSeconds = Math.max(1, Math.round(nominalRestSeconds));
  const intervals: number[] = [];

  while (remainingSeconds > 0 && intervals.length < 2) {
    const intervalSeconds = Math.min(nominalSeconds, remainingSeconds);
    intervals.push(intervalSeconds);
    remainingSeconds -= intervalSeconds;
  }
  if (remainingSeconds > 0) intervals.push(remainingSeconds);

  const localized = copy[lang];
  const steps = [localized.transfer];
  const timers: BaseTimer[] = [];

  if (intervals.length === 0) {
    steps.push(localized.noRoom);
  } else {
    intervals.forEach((seconds, index) => {
      steps.push(localized.rest(formatDuration(seconds, lang)));
      timers.push({ id: `bulk-rest-${index + 1}`, seconds, kind: 'rt' });
      if (index < intervals.length - 1) steps.push(localized.fold(index + 1));
    });
    steps.push(localized.check);
  }

  return { ...phase, steps, timers };
}

export function adaptProRomanDirectBulkPhase<T extends Phase>(phase: T, lang: Lang): T {
  const localized = {
    hr: {
      transfer: 'Lagano nauljite fermentacijsku posudu i prebacite tijesto u nju.',
      pause: 'Između preklapanja ostavite tijesto kratko pokriveno; ne dodajte zasebno vrijeme fermentacije.',
      fold: (number: number) => `Napravite ${number === 1 ? 'prvi' : 'drugi'} Stretch & Fold.`,
      check: 'Provjerite prve znakove fermentacije prije nastavka.',
    },
    en: {
      transfer: 'Lightly oil the fermentation container and transfer the dough into it.',
      pause: 'Keep the dough covered briefly between folds; do not add a separate fermentation interval.',
      fold: (number: number) => `Perform the ${number === 1 ? 'first' : 'second'} Stretch & Fold.`,
      check: 'Check for the first signs of fermentation before continuing.',
    },
    de: {
      transfer: 'Ölen Sie den Gärbehälter leicht ein und geben Sie den Teig hinein.',
      pause: 'Lassen Sie den Teig zwischen den Faltungen kurz abgedeckt ruhen; planen Sie keine zusätzliche Gärzeit ein.',
      fold: (number: number) => `Führen Sie das ${number === 1 ? 'erste' : 'zweite'} Stretch & Fold durch.`,
      check: 'Prüfen Sie vor dem Fortfahren auf erste Fermentationszeichen.',
    },
    sl: {
      transfer: 'Fermentacijsko posodo rahlo naoljite in vanjo prenesite testo.',
      pause: 'Med prepogibi naj testo kratek čas počiva pokrito; ne dodajajte ločenega časa fermentacije.',
      fold: (number: number) => `Izvedite ${number === 1 ? 'prvi' : 'drugi'} prepogib Stretch & Fold.`,
      check: 'Pred nadaljevanjem preverite prve znake fermentacije.',
    },
  }[lang];
  const foldCount = phase.steps.filter((step) => /stretch\s*&\s*fold/i.test(step)).length;
  const steps = [localized.transfer];
  for (let index = 0; index < foldCount; index += 1) {
    steps.push(localized.pause, localized.fold(index + 1));
  }
  steps.push(localized.check);
  return { ...phase, steps, timers: [] };
}