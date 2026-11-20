import { formatDuration, type BaseTimer } from './prefermentSteps';
import type { Lang } from './translations';

export type ProGlutenFreeDirectStyle = 'neapolitan' | 'romanaTonda' | 'romanaTeglia' | 'newYork';

type PhaseB = {
  title: string;
  steps: string[];
  timers?: BaseTimer[];
  fermentationInfo?: string;
};

export function adaptProGlutenFreeMixingPhaseA<T extends PhaseB>(
  phase: T,
  mixing: 'hand' | 'mixer' | 'spiral',
  lang: Lang,
): T {
  const postMixRestTimerIds = ['post-mix-rest', 'post-mix-rest15m'];
  const timers = phase.timers;
  if (!timers?.some((timer) => postMixRestTimerIds.includes(timer.id))) {
    throw new Error('PRO gluten-free mixing phase is missing its post-mix rest timer.');
  }
  const timerLabel = ({
    hr: 'Hidratacija psylliuma',
    en: 'Psyllium hydration',
    de: 'Psyllium-Hydratation',
    sl: 'Hidracija psylliuma',
  } satisfies Record<Lang, string>)[lang];
  return {
    ...phase,
    timers: timers.map((timer) => postMixRestTimerIds.includes(timer.id)
      ? { ...timer, label: timerLabel }
      : timer),
  };
}

const copy = {
  hr: {
    title: 'Faza B: Početna fermentacija na sobnoj temperaturi',
    hydrationTitle: 'Faza B: Dodatni hidratacijski odmor',
    noRoomTitle: 'Faza B: Bez dodatne početne faze',
    hydrationRest: (duration: string, limited: boolean) => `Dodatni hidratacijski odmor (${duration}): pokrijte posudu i ostavite smjesu na sobnoj temperaturi kako bi psyllium upio vlagu. Taj odmor ulazi u odabrano početno trajanje.${limited ? ' Odabrano početno vrijeme kraće je od preporučenih 15 minuta za dodatni odmor; raspored se neće produljiti.' : ''}`,
    roomFermentation: (duration: string, temperature: string) => `Nakon hidratacijskog odmora fermentirajte smjesu preostalo ${duration} na sobnoj temperaturi (${temperature}).`,
    noRoomFermentation: 'U ovom rasporedu nema dodatne početne sobne faze. Faza A već sadrži uputu i timer za 5-minutnu hidrataciju psylliuma nakon zamjesa; dodatni 15-minutni odmor nije zakazan i raspored se neće produljiti.',
    noRemainingRoomFermentation: 'Odabrano početno vrijeme na sobnoj temperaturi u cijelosti je iskorišteno za hidrataciju psylliuma; ne preostaje vrijeme za fermentaciju.',
    afterFermentation: (hasRoomTime: boolean, hasRoomFermentation: boolean, hasColdFermentation: boolean, isTeglia: boolean) => {
      const timing = hasRoomFermentation ? 'Po završetku početne fermentacije' : hasRoomTime ? 'Po završetku hidratacijskog odmora' : 'Zatim';
      if (hasColdFermentation) {
        return isTeglia
          ? `${timing} nastavite s fazom C; na početku faze D premjestite cijelu masu u hladnjak.`
          : `${timing} podijelite i oblikujte tijesto u fazi C, a zatim na početku faze D premjestite kugle u hladnjak.`;
      }
      return isTeglia
        ? `${timing} nastavite s fazom C za pripremu mase za tepsiju; hladna fermentacija nije odabrana.`
        : `${timing} nastavite s fazom C za podjelu i oblikovanje; hladna fermentacija nije odabrana.`;
    },
    fermentationInfo: (hasRoomTime: boolean) => hasRoomTime
      ? 'Dodatni hidratacijski odmor uračunat je u odabrano početno vrijeme na sobnoj temperaturi; fermentacija koristi samo preostalo vrijeme.'
      : 'Petominutna hidratacija psylliuma nakon zamjesa navedena je u fazi A; dodatna početna sobna faza nije zakazana.',
  },
  en: {
    title: 'Phase B: Initial room-temperature fermentation',
    hydrationTitle: 'Phase B: Additional hydration rest',
    noRoomTitle: 'Phase B: No additional initial phase',
    hydrationRest: (duration: string, limited: boolean) => `Additional hydration rest (${duration}): cover the container and let the mixture rest at room temperature so the psyllium can hydrate. This rest is included in the selected initial room period.${limited ? ' The selected period is shorter than the 15-minute additional-rest target; the schedule will not be extended.' : ''}`,
    roomFermentation: (duration: string, temperature: string) => `After the hydration rest, ferment the mixture for the remaining ${duration} at room temperature (${temperature}).`,
    noRoomFermentation: 'No additional initial room phase is selected. Phase A already includes instructions and a timer for 5 minutes of psyllium hydration after mixing; no separate 15-minute rest is scheduled, and the schedule is not extended.',
    noRemainingRoomFermentation: 'The selected initial room period is fully used for psyllium hydration; no room-fermentation time remains.',
    afterFermentation: (hasRoomTime: boolean, hasRoomFermentation: boolean, hasColdFermentation: boolean, isTeglia: boolean) => {
      const timing = hasRoomFermentation ? 'When the initial fermentation is complete' : hasRoomTime ? 'After the hydration rest' : 'Then';
      if (hasColdFermentation) {
        return isTeglia
          ? `${timing}, continue to Phase C; at the start of Phase D, transfer the whole mass to the refrigerator.`
          : `${timing}, divide and shape the dough in Phase C, then transfer the balls to the refrigerator at the start of Phase D.`;
      }
      return isTeglia
        ? `${timing}, continue to Phase C to prepare the tray mass; cold fermentation is not selected.`
        : `${timing}, continue to Phase C for dividing and shaping; cold fermentation is not selected.`;
    },
    fermentationInfo: (hasRoomTime: boolean) => hasRoomTime
      ? 'The additional hydration rest is included in the selected initial room period; fermentation uses only the remaining time.'
      : 'The 5-minute psyllium hydration after mixing is listed in Phase A; no additional initial room phase is scheduled.',
  },
  de: {
    title: 'Phase B: Erste Raumtemperatur-Fermentation',
    hydrationTitle: 'Phase B: Zusätzliche Hydratationsruhe',
    noRoomTitle: 'Phase B: Keine zusätzliche Anfangsphase',
    hydrationRest: (duration: string, limited: boolean) => `Zusätzliche Hydratationsruhe (${duration}): Decken Sie den Behälter ab und lassen Sie die Masse bei Raumtemperatur ruhen, damit das Psyllium quellen kann. Diese Ruhezeit ist in der ausgewählten anfänglichen Raumzeit enthalten.${limited ? ' Die ausgewählte anfängliche Raumzeit ist kürzer als die vorgesehenen 15 Minuten für die zusätzliche Ruhe; der Zeitplan wird nicht verlängert.' : ''}`,
    roomFermentation: (duration: string, temperature: string) => `Fermentieren Sie die Masse nach der Hydratationsruhe die verbleibenden ${duration} bei Raumtemperatur (${temperature}).`,
    noRoomFermentation: 'Es ist keine zusätzliche anfängliche Raumphase ausgewählt. Phase A enthält bereits die Anweisung und den Timer für 5 Minuten Psyllium-Hydratation nach dem Mischen; keine separate 15-minütige Ruhephase ist eingeplant und der Zeitplan wird nicht verlängert.',
    noRemainingRoomFermentation: 'Die ausgewählte anfängliche Raumzeit wird vollständig für die Psyllium-Hydratation genutzt; es bleibt keine Raumzeit für die Fermentation.',
    afterFermentation: (hasRoomTime: boolean, hasRoomFermentation: boolean, hasColdFermentation: boolean, isTeglia: boolean) => {
      const timing = hasRoomFermentation ? 'Nach Abschluss der anfänglichen Fermentation' : hasRoomTime ? 'Nach der Hydratationsruhe' : 'Anschließend';
      if (hasColdFermentation) {
        return isTeglia
          ? `${timing} mit Phase C fortfahren; zu Beginn von Phase D die gesamte Teigmasse in den Kühlschrank stellen.`
          : `${timing} den Teig in Phase C teilen und formen und anschließend zu Beginn von Phase D die Teigkugeln in den Kühlschrank stellen.`;
      }
      return isTeglia
        ? `${timing} mit Phase C zur Vorbereitung der Teigmasse für das Blech fortfahren; eine kalte Fermentation ist nicht ausgewählt.`
        : `${timing} mit Phase C zum Teilen und Formen fortfahren; eine kalte Fermentation ist nicht ausgewählt.`;
    },
    fermentationInfo: (hasRoomTime: boolean) => hasRoomTime
      ? 'Die zusätzliche Hydratationsruhe ist in der ausgewählten anfänglichen Raumzeit enthalten; fermentiert wird nur die verbleibende Zeit.'
      : 'Die 5-minütige Psyllium-Hydratation nach dem Mischen ist in Phase A aufgeführt; keine zusätzliche anfängliche Raumphase ist eingeplant.',
  },
  sl: {
    title: 'Faza B: Začetna fermentacija pri sobni temperaturi',
    hydrationTitle: 'Faza B: Dodaten hidratacijski počitek',
    noRoomTitle: 'Faza B: Brez dodatne začetne faze',
    hydrationRest: (duration: string, limited: boolean) => `Dodaten hidratacijski počitek (${duration}): posodo pokrijte in maso pustite pri sobni temperaturi, da psyllium vpije vlago. Ta počitek je vključen v izbrano začetno obdobje pri sobni temperaturi.${limited ? ' Izbrano začetno obdobje je krajše od predvidenih 15 minut za dodatni počitek; urnik se ne bo podaljšal.' : ''}`,
    roomFermentation: (duration: string, temperature: string) => `Po hidratacijskem počitku maso fermentirajte še preostalih ${duration} pri sobni temperaturi (${temperature}).`,
    noRoomFermentation: 'V izbranem načrtu ni dodatne začetne sobne faze. Faza A že vsebuje navodilo in časovnik za 5-minutno hidracijo psylliuma po mešanju; ločen 15-minutni počitek ni načrtovan in urnik se ne podaljša.',
    noRemainingRoomFermentation: 'Celotno izbrano začetno obdobje pri sobni temperaturi je namenjeno hidraciji psylliuma; za fermentacijo ne ostane časa.',
    afterFermentation: (hasRoomTime: boolean, hasRoomFermentation: boolean, hasColdFermentation: boolean, isTeglia: boolean) => {
      const timing = hasRoomFermentation ? 'Po končani začetni fermentaciji' : hasRoomTime ? 'Po hidratacijskem počitku' : 'Nato';
      if (hasColdFermentation) {
        return isTeglia
          ? `${timing} nadaljujte s fazo C; na začetku faze D celotno maso prestavite v hladilnik.`
          : `${timing} testo razdelite in oblikujte v fazi C, nato pa na začetku faze D kroglice prestavite v hladilnik.`;
      }
      return isTeglia
        ? `${timing} nadaljujte s fazo C za pripravo mase za pekač; hladna fermentacija ni izbrana.`
        : `${timing} nadaljujte s fazo C za delitev in oblikovanje; hladna fermentacija ni izbrana.`;
    },
    fermentationInfo: (hasRoomTime: boolean) => hasRoomTime
      ? 'Dodaten hidratacijski počitek je vključen v izbrano začetno obdobje pri sobni temperaturi; fermentacija traja le preostali čas.'
      : '5-minutna hidracija psylliuma po mešanju je navedena v fazi A; dodatna začetna sobna faza ni načrtovana.',
  },
} satisfies Record<Lang, {
  title: string;
  hydrationTitle: string;
  noRoomTitle: string;
  hydrationRest: (duration: string, limited: boolean) => string;
  roomFermentation: (duration: string, temperature: string) => string;
  noRoomFermentation: string;
  noRemainingRoomFermentation: string;
  afterFermentation: (hasRoomTime: boolean, hasRoomFermentation: boolean, hasColdFermentation: boolean, isTeglia: boolean) => string;
  fermentationInfo: (hasRoomTime: boolean) => string;
}>;

export function adaptProGlutenFreeRoomPhaseB<T extends PhaseB>(
  phase: T,
  lang: Lang,
  style: ProGlutenFreeDirectStyle,
  roomFermentationSeconds: number,
  roomTemperature: string,
  hasColdFermentation: boolean,
): T {
  const localized = copy[lang];
  const initialRoomSeconds = Math.max(0, Math.round(roomFermentationSeconds));
  const hydrationRestSeconds = Math.min(15 * 60, initialRoomSeconds);
  const remainingRoomFermentationSeconds = initialRoomSeconds - hydrationRestSeconds;
  const hasRoomTime = initialRoomSeconds > 0;
  const hasRoomFermentation = remainingRoomFermentationSeconds > 0;
  const steps = [
    ...phase.steps.slice(0, 1),
    ...(hydrationRestSeconds > 0
      ? [localized.hydrationRest(formatDuration(hydrationRestSeconds, lang), hydrationRestSeconds < 15 * 60)]
      : []),
    ...(hasRoomFermentation
      ? [localized.roomFermentation(formatDuration(remainingRoomFermentationSeconds, lang), roomTemperature)]
      : [hasRoomTime ? localized.noRemainingRoomFermentation : localized.noRoomFermentation]),
    localized.afterFermentation(hasRoomTime, hasRoomFermentation, hasColdFermentation, style === 'romanaTeglia'),
    ...phase.steps.slice(2),
  ];
  const timers: BaseTimer[] = [
    ...(hydrationRestSeconds > 0
      ? [{ id: 'gluten-free-short-rest', seconds: hydrationRestSeconds, kind: 'rest' as const }]
      : []),
    ...(hasRoomFermentation
      ? [{ id: 'gluten-free-initial-room-fermentation', seconds: remainingRoomFermentationSeconds, kind: 'rt' as const }]
      : []),
  ];

  return {
    ...phase,
    title: hasRoomFermentation ? localized.title : hasRoomTime ? localized.hydrationTitle : localized.noRoomTitle,
    steps,
    timers,
    fermentationInfo: localized.fermentationInfo(hasRoomTime),
  };
}
