import { getCombinedP3InitialIntervals } from './i18n/combinedPrefermentSteps';
import { getProNapolitanaBulkRestSeconds, PRO_NAPOLITANA_MIX_REST_SECONDS } from './i18n/proDirectBulk';
import { getTegliaFinalProofPlan } from './calculator';
import type { Method, OvenType, PizzaStyle } from './calculator';
import { formatDuration } from './i18n/prefermentSteps';
import type { Lang } from './i18n/translations';

export type ProNapolitanaInitialInterval = {
  seconds: number;
};

export type ProNapolitanaMethod = 'direct' | 'biga' | 'poolish' | 'sponge';

export type ProNapolitanaInitialPlannerEvent = {
  kind: 'mix-rest' | 'room-rest' | 'fold' | 'balling';
  at: Date;
  index?: number;
  seconds?: number;
};

export function getProNapolitanaInitialIntervals(
  method: ProNapolitanaMethod,
  isCombinedBigaPoolish: boolean,
  roomTemp: number,
): ProNapolitanaInitialInterval[] {
  if (method === 'biga' && isCombinedBigaPoolish) return getCombinedP3InitialIntervals(false);
  const intervals = [{ seconds: PRO_NAPOLITANA_MIX_REST_SECONDS }];
  if (method !== 'direct') {
    intervals.push(...Array.from({ length: 3 }, () => ({ seconds: getProNapolitanaBulkRestSeconds(roomTemp) })));
  }
  return intervals;
}

export function buildProNapolitanaInitialPlannerEvents(
  method: ProNapolitanaMethod,
  isCombinedBigaPoolish: boolean,
  mixAt: Date,
  intervals: readonly ProNapolitanaInitialInterval[],
): ProNapolitanaInitialPlannerEvent[] {
  const events: ProNapolitanaInitialPlannerEvent[] = [];
  let elapsedSeconds = 0;
  const append = (kind: ProNapolitanaInitialPlannerEvent['kind'], index?: number, seconds?: number) => {
    events.push({ kind, at: new Date(mixAt.getTime() + elapsedSeconds * 1000), ...(index !== undefined ? { index } : {}), ...(seconds !== undefined ? { seconds } : {}) });
  };
  const mixRest = intervals[0];
  if (mixRest) {
    append('mix-rest', undefined, mixRest.seconds);
    elapsedSeconds += mixRest.seconds;
  }
  if (method === 'biga' && isCombinedBigaPoolish) {
    const firstRest = intervals[1];
    const secondRest = intervals[2];
    const ballRest = intervals[3];
    if (firstRest && secondRest && ballRest) {
      append('room-rest', 1, firstRest.seconds);
      elapsedSeconds += firstRest.seconds;
      append('fold', 1);
      append('room-rest', 2, secondRest.seconds);
      elapsedSeconds += secondRest.seconds;
      append('balling', undefined, ballRest.seconds);
    }
  } else {
    const roomRests = intervals.slice(1);
    roomRests.forEach((interval, index) => {
      append('room-rest', index + 1, interval.seconds);
      elapsedSeconds += interval.seconds;
      if (index < roomRests.length - 1) append('fold', index + 1);
    });
    append('balling');
  }
  return events;
}

export type ProNapolitanaFermentationPhase = {
  kind: 'preferment' | 'final' | 'final-rest';
  environment: 'room' | 'fridge';
  hours: number;
  temperature: number;
};

export type ProNapolitanaFermentationSchedule = {
  phases: ProNapolitanaFermentationPhase[];
  [key: string]: unknown;
};

export type ProNapolitanaPlannerWindow = {
  initialSeconds: number;
  finalMixAt: Date;
  fridgeStartAt: Date;
  fridgeEndAt: Date;
};

export function resolveProNapolitanaFinalRestHours(input: {
  isBeginner: boolean;
  ovenType: OvenType;
  method: Method;
  style: PizzaStyle;
  combinedBigaPoolish: boolean;
  fridgeHours: number;
  selectedHours: number;
  fallbackHours: number;
}): number {
  const useSelectedRest = !input.isBeginner
    && input.ovenType !== 'kamado'
    && input.fridgeHours > 0
    && (input.style === 'neapolitan'
      || (input.method === 'biga' && input.style === 'ny_style' && input.combinedBigaPoolish));
  return useSelectedRest ? input.selectedHours : input.fallbackHours;
}

export type ProNapolitanaPlannerEvent = {
  at: Date;
  title: string;
  desc: string;
  phaseId?: string;
};

export function ensureProTargetBakeEvent(
  steps: readonly ProNapolitanaPlannerEvent[],
  isTargetPlan: boolean,
  bakeAt: Date,
  bakeEvent: { title: string; desc: string; phaseId: string },
): ProNapolitanaPlannerEvent[] {
  if (!isTargetPlan) return [...steps];
  const withoutBake = steps.filter((step) => step.phaseId !== bakeEvent.phaseId && step.title !== bakeEvent.title);
  return [...withoutBake, { ...bakeEvent, at: new Date(bakeAt) }]
    .sort((left, right) => left.at.getTime() - right.at.getTime());
}

export function alignProNapolitanaSpongePlannerSteps<T extends { at: Date; phaseId?: string }>(
  steps: readonly T[],
  window: ProNapolitanaPlannerWindow,
  prefermentHours: number,
  finalMixDurationMinutes = 0,
): T[] {
  const finalMixAt = new Date(window.finalMixAt.getTime() - finalMixDurationMinutes * 60000);
  return steps.filter((step) => step.phaseId !== 'sponge.balling').map((step) => {
    if (step.phaseId === 'sponge.preparation') {
      return { ...step, at: new Date(finalMixAt.getTime() - prefermentHours * 3600000) };
    }
    if (step.phaseId === 'sponge.finalMix') {
      return { ...step, at: finalMixAt };
    }
    if (step.phaseId === 'sponge.balling') {
      return { ...step, at: new Date(window.fridgeStartAt) };
    }
    return step;
  });
}

export function alignProSpongeBallingBeforeFridge<T extends { at: Date; phaseId?: string }>(steps: readonly T[]): T[] {
  const fridgeStart = steps.find((step) => step.phaseId === 'sponge.fridge');
  if (!fridgeStart) return [...steps];
  return steps.map((step) => step.phaseId === 'sponge.balling'
    ? { ...step, at: new Date(fridgeStart.at) }
    : step);
}

export function buildProTegliaSpongePlannerEvents(
  fridgeRemovalAt: Date,
  bakeAt: Date,
  roomHours: number,
  lang: Lang,
): { at: Date; title: string; desc: string; phaseId: string }[] {
  const proofPlan = getTegliaFinalProofPlan(Math.max(0, roomHours * 60));
  if (proofPlan.totalMinutes <= 0) return [];
  const pressRestSeconds = 5 * 60;
  const trayPreparationMinutes = Math.max(0, proofPlan.pressRelaxationMinutes - 5);
  const trayPreparationAt = new Date(bakeAt.getTime() - proofPlan.totalMinutes * 60000);
  const pressRestAt = new Date(trayPreparationAt.getTime() + trayPreparationMinutes * 60000);
  const proofAt = new Date(pressRestAt.getTime() + pressRestSeconds * 1000);
  const copy = {
    hr: {
      prepare: 'Pripremite tepsije i podijelite cijelu masu Sponge tijesta u porcije za tepsije.',
      pressRest: 'Nakon početnog utiskivanja ostavite tijesto da se opusti 5 minuta.',
      proof: (duration: string) => `Nastavite utiskivati tijesto u tepsije, zatim ga pokrijte i ostavite na završno dizanje ${duration}.`,
    },
    en: {
      prepare: 'Prepare the trays and divide the complete Sponge dough mass into tray portions.',
      pressRest: 'After the initial pressing, let the dough relax for 5 minutes.',
      proof: (duration: string) => `Finish pressing the dough into the trays, then cover it and leave it for a final rise of ${duration}.`,
    },
    de: {
      prepare: 'Bereiten Sie die Bleche vor und teilen Sie die gesamte Sponge-Teigmasse in Blechportionen.',
      pressRest: 'Lassen Sie den Teig nach dem ersten Andrücken 5 Minuten entspannen.',
      proof: (duration: string) => `Drücken Sie den Teig weiter in die Bleche, decken Sie ihn ab und lassen Sie ihn ${duration} gehen.`,
    },
    sl: {
      prepare: 'Pripravi pekače in celotno maso Sponge testa razdeli na porcije za pekače.',
      pressRest: 'Po začetnem vtiskovanju naj testo počiva 5 minut.',
      proof: (duration: string) => `Nadaljuj z vtiskovanjem testa v pekače, nato ga pokrij in pusti vzhajati ${duration}.`,
    },
  }[lang];
  return [
    { at: trayPreparationAt, title: ({ hr: 'Priprava tepsija i podjela mase', en: 'Prepare trays and divide the dough mass', de: 'Bleche vorbereiten und Teigmasse teilen', sl: 'Priprava pekačev in delitev mase' } as const)[lang], desc: copy.prepare, phaseId: 'teglia.sponge.prepare' },
    { at: pressRestAt, title: ({ hr: 'Odmor nakon utiskivanja', en: 'Rest after pressing', de: 'Ruhezeit nach dem Andrücken', sl: 'Počitek po vtiskovanju' } as const)[lang], desc: copy.pressRest, phaseId: 'teglia.sponge.press-rest' },
    { at: proofAt, title: ({ hr: 'Završno dizanje u tepsijama', en: 'Final rise in trays', de: 'Endgare in den Blechen', sl: 'Končno vzhajanje v pekačih' } as const)[lang], desc: copy.proof(formatDuration(proofPlan.proofMinutes * 60, lang)), phaseId: 'teglia.sponge.final-proof' },
  ].filter((step) => step.at.getTime() < bakeAt.getTime() && step.at.getTime() >= fridgeRemovalAt.getTime());
}

export function buildProNapolitanaFermentationSchedule<T extends ProNapolitanaFermentationSchedule>(
  schedule: T,
  initialIntervals: readonly ProNapolitanaInitialInterval[],
  roomHours: number,
  fridgeHours: number,
  roomTemp: number,
  fridgeTemp: number,
): T {
  const phases = schedule.phases.filter((phase) => phase.kind === 'preferment');
  const initialRoomHours = initialIntervals.reduce((total, interval) => total + interval.seconds, 0) / 3600;
  if (initialRoomHours > 0) {
    phases.push({ kind: 'final', environment: 'room', hours: initialRoomHours, temperature: roomTemp });
  }
  if (fridgeHours > 0) {
    phases.push({ kind: 'final', environment: 'fridge', hours: fridgeHours, temperature: fridgeTemp });
  }
  if (roomHours > 0) {
    phases.push({ kind: 'final-rest', environment: 'room', hours: roomHours, temperature: roomTemp });
  }
  return { ...schedule, phases };
}

export function getProNapolitanaPlannerWindow(
  bakeAt: Date,
  roomHours: number,
  fridgeHours: number,
  initialIntervals: readonly ProNapolitanaInitialInterval[],
): ProNapolitanaPlannerWindow {
  const initialSeconds = initialIntervals.reduce((total, interval) => total + interval.seconds, 0);
  const fridgeEndAt = new Date(bakeAt.getTime() - roomHours * 3600000);
  const fridgeStartAt = new Date(fridgeEndAt.getTime() - fridgeHours * 3600000);
  return {
    initialSeconds,
    finalMixAt: new Date(fridgeStartAt.getTime() - initialSeconds * 1000),
    fridgeStartAt,
    fridgeEndAt,
  };
}