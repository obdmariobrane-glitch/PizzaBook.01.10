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
): T {
  const postMixRestTimerIds = ['post-mix-rest', 'post-mix-rest15m'];
  const timers = phase.timers;
  if (!timers?.some((timer) => postMixRestTimerIds.includes(timer.id))) {
    throw new Error('PRO gluten-free mixing phase is missing its post-mix rest timer.');
  }

  return {
    ...phase,
    steps: mixing === 'spiral' ? phase.steps : phase.steps.slice(0, -1),
    timers: timers.filter((timer) => !postMixRestTimerIds.includes(timer.id)),
  };
}

const copy = {
  hr: {
    title: 'Faza B: Početna fermentacija na sobnoj temperaturi',
    hydrationTitle: 'Faza B: Hidratacijski odmor',
    hydrationRest: (duration: string, limited: boolean) => `Pokrijte posudu i ostavite smjesu ${duration} na sobnoj temperaturi kako bi psyllium upio vlagu. Taj odmor ulazi u odabrano početno trajanje.${limited ? ' Odabrano početno vrijeme kraće je od preporučenih 15 minuta za hidrataciju; raspored se neće produljiti.' : ''}`,
    roomFermentation: (duration: string, temperature: string) => `Nakon hidratacijskog odmora fermentirajte smjesu preostalo ${duration} na sobnoj temperaturi (${temperature}).`,
    noRoomFermentation: 'U odabranom rasporedu nema početnog vremena na sobnoj temperaturi; dodatni hidratacijski odmor u ovoj fazi nije zakazan kako se raspored ne bi produljio. Zato nije moguće odraditi 15-minutnu hidrataciju psylliuma.',
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
    fermentationInfo: 'Hidratacijski odmor uračunat je u odabrano početno vrijeme na sobnoj temperaturi; fermentacija koristi samo preostalo vrijeme.',
  },
  en: {
    title: 'Phase B: Initial room-temperature fermentation',
    hydrationTitle: 'Phase B: Hydration rest',
    hydrationRest: (duration: string, limited: boolean) => `Cover the container and let the mixture rest for ${duration} at room temperature so the psyllium can hydrate. This rest is included in the selected initial room period.${limited ? ' The selected period is shorter than the 15-minute hydration target; the schedule will not be extended.' : ''}`,
    roomFermentation: (duration: string, temperature: string) => `After the hydration rest, ferment the mixture for the remaining ${duration} at room temperature (${temperature}).`,
    noRoomFermentation: 'No initial room period is selected; no extra hydration rest is scheduled in this phase, so the schedule is not extended. The 15-minute psyllium hydration cannot be accommodated.',
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
    fermentationInfo: 'The hydration rest is included in the selected initial room period; fermentation uses only the remaining time.',
  },
  de: {
    title: 'Phase B: Erste Raumtemperatur-Fermentation',
    hydrationTitle: 'Phase B: Hydratationsruhe',
    hydrationRest: (duration: string, limited: boolean) => `Decken Sie den Behälter ab und lassen Sie die Masse ${duration} bei Raumtemperatur ruhen, damit das Psyllium quellen kann. Diese Ruhezeit ist in der ausgewählten anfänglichen Raumzeit enthalten.${limited ? ' Die ausgewählte anfängliche Raumzeit ist kürzer als die vorgesehenen 15 Minuten für die Hydratation; der Zeitplan wird nicht verlängert.' : ''}`,
    roomFermentation: (duration: string, temperature: string) => `Fermentieren Sie die Masse nach der Hydratationsruhe die verbleibenden ${duration} bei Raumtemperatur (${temperature}).`,
    noRoomFermentation: 'Im ausgewählten Zeitplan ist keine anfängliche Raumzeit vorgesehen; in dieser Phase wird keine zusätzliche Hydratationsruhe eingeplant, damit der Zeitplan nicht verlängert wird. Die 15-minütige Psyllium-Hydratation ist daher nicht möglich.',
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
    fermentationInfo: 'Die Hydratationsruhe ist in der ausgewählten anfänglichen Raumzeit enthalten; fermentiert wird nur die verbleibende Zeit.',
  },
  sl: {
    title: 'Faza B: Začetna fermentacija pri sobni temperaturi',
    hydrationTitle: 'Faza B: Hidratacijski počitek',
    hydrationRest: (duration: string, limited: boolean) => `Posodo pokrijte in maso ${duration} pustite pri sobni temperaturi, da psyllium vpije vlago. Ta počitek je vključen v izbrano začetno obdobje pri sobni temperaturi.${limited ? ' Izbrano začetno obdobje je krajše od predvidenih 15 minut za hidracijo; urnik se ne bo podaljšal.' : ''}`,
    roomFermentation: (duration: string, temperature: string) => `Po hidratacijskem počitku maso fermentirajte še preostalih ${duration} pri sobni temperaturi (${temperature}).`,
    noRoomFermentation: 'V izbranem načrtu ni začetnega obdobja pri sobni temperaturi; v tej fazi ni načrtovan dodaten hidratacijski počitek, da se urnik ne podaljša. Zato 15-minutne hidracije psylliuma ni mogoče izvesti.',
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
    fermentationInfo: 'Hidratacijski počitek je vključen v izbrano začetno obdobje pri sobni temperaturi; fermentacija traja le preostali čas.',
  },
} satisfies Record<Lang, {
  title: string;
  hydrationTitle: string;
  hydrationRest: (duration: string, limited: boolean) => string;
  roomFermentation: (duration: string, temperature: string) => string;
  noRoomFermentation: string;
  noRemainingRoomFermentation: string;
  afterFermentation: (hasRoomTime: boolean, hasRoomFermentation: boolean, hasColdFermentation: boolean, isTeglia: boolean) => string;
  fermentationInfo: string;
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
    title: hasRoomFermentation ? localized.title : localized.hydrationTitle,
    steps,
    timers,
    fermentationInfo: localized.fermentationInfo,
  };
}
