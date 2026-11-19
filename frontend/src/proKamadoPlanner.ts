import type { FermentationPhase, FermentationSchedule, Method, Mixing, PizzaStyle } from './calculator';
import type { Lang } from './i18n/translations';
import { formatDuration } from './i18n/prefermentSteps';
import { buildProNapolitanaInitialPlannerEvents, type ProNapolitanaInitialInterval } from './proNapolitanaPlanner';

export type ProKamadoPlannerStep = {
  at: Date;
  title: string;
  desc: string;
  phaseId?: string;
};

export type ProKamadoPrefermentBranch = {
  name: string;
  phaseId: 'biga' | 'poolish';
  phases: readonly FermentationPhase[];
  startAtHours: number;
};

export function getProKamadoBigaMixDurationMinutes(mixing: Mixing): number {
  return mixing === 'hand' ? 14 : 8;
}

export function buildProKamadoPlannerSteps(
  bakeAt: Date,
  method: Method,
  style: PizzaStyle,
  schedule: FermentationSchedule,
  lang: Lang,
  preheatMinutes: number,
  spongePreparation?: { title: string; steps: string[] } | null,
  initialIntervals: readonly ProNapolitanaInitialInterval[] = [],
  combinedBigaPoolish = false,
  finalMixDurationMinutes = 0,
): ProKamadoPlannerStep[] {
  const copy = ({
    hr: {
      direct: 'Završetak zamjesa', biga: 'Završni zamjes s Bigom', combinedBiga: 'Završni zamjes s Bigom i Poolishom', poolish: 'Završni zamjes s Poolishom', sponge: 'Završni zamjes sa Spongeom',
      preferment: 'Fermentacija prefermenta', finalRoom: 'Završna fermentacija na sobnoj temperaturi', finalFridge: 'Završna fermentacija u hladnjaku',
      finalRest: 'Završni odmor', preheat: 'Priprema i stabilizacija Kamada', bake: 'Pečenje pizze u Kamadu',
      start: 'Započnite', directComplete: 'Završni zamjes je završen; odmor počinje sada.', combinedStart: 'Započnite završni zamjes s Bigom i Poolishom.', ballRest: 'Odmor oblikovanih kuglica', ballRestDesc: (duration: string) => `Ostavite oblikovane kuglice da odmore ${duration} prije hladnjaka.`, atRoom: 'na sobnoj temperaturi', inFridge: 'u hladnjaku',
      phase: (index: number, total: number, duration: string, temperature: number, environment: string) => `Faza ${index}/${total}: ${duration} ${environment} pri ${temperature} °C.`,
      bakeDesc: style === 'romana' ? 'Pecite dok podloga i rub ne dobiju željenu boju i teksturu.' : style === 'ny_style' ? 'Pecite dok se podloga ne zapeče, a rub i sir ne dobiju željenu boju.' : 'Pecite dok rub ne dobije željenu boju i napuhnutost, a podloga bude pečena.',
    },
    en: {
      direct: 'Final mix complete', biga: 'Final mix with Biga', combinedBiga: 'Final mix with Biga and Poolish', poolish: 'Final mix with Poolish', sponge: 'Final mix with Sponge',
      preferment: 'Preferment fermentation', finalRoom: 'Final fermentation at room temperature', finalFridge: 'Final fermentation in the fridge',
      finalRest: 'Final rest', preheat: 'Prepare and stabilize the Kamado', bake: 'Bake pizza in the Kamado',
      start: 'Start', directComplete: 'The final mix is complete; the rest begins now.', combinedStart: 'Begin the final mix with both Biga and Poolish.', ballRest: 'Dough-ball rest', ballRestDesc: (duration: string) => `Rest the shaped dough balls for ${duration} before refrigeration.`, atRoom: 'at room temperature', inFridge: 'in the fridge',
      phase: (index: number, total: number, duration: string, temperature: number, environment: string) => `Phase ${index}/${total}: ${duration} ${environment} at ${temperature}°C.`,
      bakeDesc: style === 'romana' ? 'Bake until the base and rim reach the desired color and texture.' : style === 'ny_style' ? 'Bake until the base is set and the rim and cheese reach the desired color.' : 'Bake until the rim has the desired color and lift and the base is baked through.',
    },
    de: {
      direct: 'Ende des Endknetens', biga: 'Endteig mit Biga', combinedBiga: 'Endteig mit Biga und Poolish', poolish: 'Endteig mit Poolish', sponge: 'Endteig mit Sponge',
      preferment: 'Fermentation des Vorteigs', finalRoom: 'Endgare bei Raumtemperatur', finalFridge: 'Endgare im Kühlschrank',
      finalRest: 'Abschließende Ruhezeit', preheat: 'Kamado vorbereiten und stabilisieren', bake: 'Pizza im Kamado backen',
      start: 'Beginn', directComplete: 'Der Endteig ist fertig geknetet; die Ruhezeit beginnt jetzt.', combinedStart: 'Beginnen Sie den Endteig mit Biga und Poolish.', ballRest: 'Ruhezeit der Teigkugeln', ballRestDesc: (duration: string) => `Lassen Sie die geformten Teigkugeln vor dem Kühlen ${duration} ruhen.`, atRoom: 'bei Raumtemperatur', inFridge: 'im Kühlschrank',
      phase: (index: number, total: number, duration: string, temperature: number, environment: string) => `Phase ${index}/${total}: ${duration} ${environment} bei ${temperature}°C.`,
      bakeDesc: style === 'romana' ? 'Backen, bis Boden und Rand die gewünschte Farbe und Textur haben.' : style === 'ny_style' ? 'Backen, bis der Boden durchgebacken ist und Rand und Käse die gewünschte Farbe haben.' : 'Backen, bis der Rand die gewünschte Farbe und Höhe erreicht hat und der Boden durchgebacken ist.',
    },
    sl: {
      direct: 'Končno mešanje je končano', biga: 'Končno mešanje z Bigo', combinedBiga: 'Končno mešanje z Bigo in Poolishem', poolish: 'Končno mešanje s Poolishem', sponge: 'Končno mešanje s Spongeom',
      preferment: 'Fermentacija prefermenta', finalRoom: 'Končna fermentacija pri sobni temperaturi', finalFridge: 'Končna fermentacija v hladilniku',
      finalRest: 'Končni počitek', preheat: 'Priprava in stabilizacija Kamada', bake: 'Peka pice v Kamadu',
      start: 'Začetek', directComplete: 'Končno mešanje je končano; počitek se začne zdaj.', combinedStart: 'Začnite končno mešanje z Bigo in Poolishem.', ballRest: 'Počitek oblikovanih kroglic', ballRestDesc: (duration: string) => `Oblikovane kroglice naj pred hlajenjem počivajo ${duration}.`, atRoom: 'pri sobni temperaturi', inFridge: 'v hladilniku',
      phase: (index: number, total: number, duration: string, temperature: number, environment: string) => `Faza ${index}/${total}: ${duration} ${environment} pri ${temperature} °C.`,
      bakeDesc: style === 'romana' ? 'Pecite, dokler dno in rob ne dosežeta želene barve in teksture.' : style === 'ny_style' ? 'Pecite, dokler se dno ne zapeče, rob in sir pa ne dosežeta želene barve.' : 'Pecite, dokler rob ne dobi želene barve in napihnjenosti, dno pa ni pečeno.',
    },
  })[lang];
  const initialCopy = ({
    hr: {
      mixRest: 'Odmor nakon završnog zamjesa', roomRest: (index: number) => `Sobni odmor ${index}`, fold: (index: number) => `Stretch & Fold ${index}`, balling: 'Podjela i oblikovanje kuglica',
      mixRestDesc: (duration: string) => `Ostavite tijesto pokriveno ${duration} nakon završnog zamjesa.`, roomRestDesc: (duration: string) => `Nakon preklapanja ostavite tijesto pokriveno ${duration} na sobnoj temperaturi.`, foldDesc: 'Napravite Stretch & Fold prije sljedećeg sobnog odmora.', ballingDesc: 'Oblikujte kuglice prije ulaska tijesta u hladnjak.',
      ballRest: 'Odmor oblikovanih kuglica', ballRestDesc: (duration: string) => `Ostavite oblikovane kuglice da odmore ${duration} prije hladnjaka.`,
    },
    en: {
      mixRest: 'Rest after final mix', roomRest: (index: number) => `Room rest ${index}`, fold: (index: number) => `Stretch & Fold ${index}`, balling: 'Divide and shape dough balls',
      mixRestDesc: (duration: string) => `Keep the dough covered for ${duration} after the final mix.`, roomRestDesc: (duration: string) => `After folding, keep the dough covered at room temperature for ${duration}.`, foldDesc: 'Perform Stretch & Fold before the next room rest.', ballingDesc: 'Shape the dough balls before placing them in the fridge.',
      ballRest: 'Dough-ball rest', ballRestDesc: (duration: string) => `Rest the shaped dough balls for ${duration} before refrigeration.`,
    },
    de: {
      mixRest: 'Ruhe nach dem Endkneten', roomRest: (index: number) => `Raumruhe ${index}`, fold: (index: number) => `Stretch & Fold ${index}`, balling: 'Teiglinge teilen und formen',
      mixRestDesc: (duration: string) => `Lassen Sie den Teig nach dem Endkneten ${duration} abgedeckt ruhen.`, roomRestDesc: (duration: string) => `Lassen Sie den Teig nach dem Falten ${duration} abgedeckt bei Raumtemperatur ruhen.`, foldDesc: 'Falten Sie den Teig vor der nächsten Ruhephase.', ballingDesc: 'Formen Sie die Teigkugeln, bevor Sie sie in den Kühlschrank stellen.',
      ballRest: 'Ruhezeit der Teigkugeln', ballRestDesc: (duration: string) => `Lassen Sie die geformten Teigkugeln vor dem Kühlen ${duration} ruhen.`,
    },
    sl: {
      mixRest: 'Počitek po končnem mešanju', roomRest: (index: number) => `Počitek pri sobni temperaturi ${index}`, fold: (index: number) => `Stretch & Fold ${index}`, balling: 'Razdeli in oblikuj kroglice',
      mixRestDesc: (duration: string) => `Testo po končnem mešanju pustite pokrito ${duration}.`, roomRestDesc: (duration: string) => `Po prepogibu pustite testo pokrito ${duration} pri sobni temperaturi.`, foldDesc: 'Testo prepognite pred naslednjim sobnim počitkom.', ballingDesc: 'Kroglice oblikujte pred prestavitvijo testa v hladilnik.',
      ballRest: 'Počitek oblikovanih kroglic', ballRestDesc: (duration: string) => `Oblikovane kroglice naj pred hlajenjem počivajo ${duration}.`,
    },
  })[lang];
  const duration = (hours: number) => formatDuration(hours * 3600, lang);
  const prefermentPhases = schedule.phases.filter((phase) => phase.kind === 'preferment');
  const fridgePhases = schedule.phases.filter((phase) => phase.kind === 'final' && phase.environment === 'fridge');
  const finalRestPhases = schedule.phases.filter((phase) => phase.kind === 'final-rest');
  const totalPrefermentHours = prefermentPhases.reduce((total, phase) => total + phase.hours, 0);
  const totalFridgeHours = fridgePhases.reduce((total, phase) => total + phase.hours, 0);
  const totalFinalRestHours = finalRestPhases.reduce((total, phase) => total + phase.hours, 0);
  const fridgeStartAt = new Date(bakeAt.getTime() - (totalFinalRestHours + totalFridgeHours) * 3600000);
  const initialSeconds = initialIntervals.reduce((total, interval) => total + interval.seconds, 0);
  const mixDurationMinutes = method === 'poolish' || method === 'sponge' || method === 'biga' ? finalMixDurationMinutes : 0;
  const mixAt = new Date(fridgeStartAt.getTime() - initialSeconds * 1000 - mixDurationMinutes * 60000);
  const prefermentStartAt = new Date(mixAt.getTime() - totalPrefermentHours * 3600000);
  const steps: ProKamadoPlannerStep[] = [];

  if (method === 'sponge' && spongePreparation) {
    steps.push({ at: prefermentStartAt, title: spongePreparation.title, desc: spongePreparation.steps.join('\n'), phaseId: 'sponge.preparation' });
  }
  if (method !== 'biga') {
    let elapsedPrefermentHours = 0;
    prefermentPhases.forEach((phase, index) => {
      steps.push({
        at: new Date(prefermentStartAt.getTime() + elapsedPrefermentHours * 3600000),
        title: `${copy.preferment} ${index + 1}`,
        desc: copy.phase(index + 1, prefermentPhases.length, duration(phase.hours), phase.temperature, phase.environment === 'room' ? copy.atRoom : copy.inFridge),
        phaseId: `${method}.phase.${index + 1}`,
      });
      elapsedPrefermentHours += phase.hours;
    });
  }

  if (method === 'direct') {
    steps.push({ at: mixAt, title: copy.direct, desc: copy.directComplete, phaseId: 'direct.mix' });
  } else {
    const finalMixTitle = method === 'biga'
      ? combinedBigaPoolish ? copy.combinedBiga : copy.biga
      : method === 'poolish' ? copy.poolish : copy.sponge;
    const finalMixDesc = method === 'biga' && combinedBigaPoolish ? copy.combinedStart : copy.start;
    steps.push({ at: mixAt, title: finalMixTitle, desc: finalMixDesc, phaseId: method === 'sponge' ? 'sponge.finalMix' : `${method}.finalMix` });
  }

  const initialSequenceAt = new Date(mixAt.getTime() + mixDurationMinutes * 60000);
  buildProNapolitanaInitialPlannerEvents(method, method === 'biga' && combinedBigaPoolish, initialSequenceAt, initialIntervals)
    .forEach((event) => {
      const title = event.kind === 'mix-rest'
        ? initialCopy.mixRest
        : event.kind === 'room-rest'
          ? initialCopy.roomRest(event.index ?? 1)
          : event.kind === 'fold'
            ? initialCopy.fold(event.index ?? 1)
            : initialCopy.balling;
      const desc = event.kind === 'mix-rest'
        ? initialCopy.mixRestDesc(formatDuration(event.seconds ?? 0, lang))
        : event.kind === 'room-rest'
          ? initialCopy.roomRestDesc(formatDuration(event.seconds ?? 0, lang))
          : event.kind === 'fold'
            ? initialCopy.foldDesc
            : initialCopy.ballingDesc;
      const phaseId = event.kind === 'mix-rest'
        ? 'pro.initial.mix-rest'
        : event.kind === 'room-rest'
          ? `pro.initial.room-rest-${event.index}`
          : event.kind === 'fold'
            ? `pro.initial.fold-${event.index}`
            : 'pro.initial.balling';
      steps.push({ at: event.at, title, desc, phaseId });
      if (combinedBigaPoolish && event.kind === 'balling' && (event.seconds ?? 0) > 0) {
        steps.push({
          at: event.at,
          title: initialCopy.ballRest,
          desc: initialCopy.ballRestDesc(formatDuration(event.seconds!, lang)),
          phaseId: 'pro.initial.ball-rest',
        });
      }
    });

  let fridgeElapsedHours = 0;
  fridgePhases.forEach((phase, index) => {
    steps.push({
      at: new Date(fridgeStartAt.getTime() + fridgeElapsedHours * 3600000),
      title: copy.finalFridge,
      desc: copy.phase(index + 1, fridgePhases.length, duration(phase.hours), phase.temperature, copy.inFridge),
      phaseId: `${method}.fridge`,
    });
    fridgeElapsedHours += phase.hours;
  });

  let finalRestElapsedHours = 0;
  finalRestPhases.forEach((phase, index) => {
    const at = new Date(fridgeStartAt.getTime() + (totalFridgeHours + finalRestElapsedHours) * 3600000);
    steps.push({
      at,
      title: method === 'sponge' ? copy.finalRest : copy.finalRoom,
      desc: copy.phase(index + 1, finalRestPhases.length, duration(phase.hours), phase.temperature, copy.atRoom),
      phaseId: method === 'sponge' ? 'sponge.fridgeRemoval' : `${method}.finalRest`,
    });
    finalRestElapsedHours += phase.hours;
  });

  steps.push({ at: new Date(bakeAt.getTime() - preheatMinutes * 60000), title: copy.preheat, desc: `${copy.preheat}.`, phaseId: 'proKamado.preheat' });
  steps.push({ at: bakeAt, title: copy.bake, desc: copy.bakeDesc, phaseId: 'proKamado.bake' });
  const tiePriority = (step: ProKamadoPlannerStep) => step.phaseId === 'direct.mix'
    ? -3
    : step.phaseId === 'pro.initial.mix-rest'
      ? -2
      : step.phaseId === 'pro.initial.balling'
        ? -1
        : 0;
  return steps.sort((left, right) => left.at.getTime() - right.at.getTime() || tiePriority(left) - tiePriority(right));
}

export function buildProKamadoPrefermentBranchSteps(
  finalMixAt: Date,
  branches: readonly ProKamadoPrefermentBranch[],
  lang: Lang,
): ProKamadoPlannerStep[] {
  const branchEnds = branches.map((branch) => branch.startAtHours + branch.phases.reduce((total, phase) => total + phase.hours, 0));
  const finalMixStartHours = Math.max(0, ...branchEnds);
  return branches.flatMap((branch) => {
    let elapsedHours = branch.startAtHours;
    return branch.phases.map((phase, index) => {
      const stepAt = new Date(finalMixAt.getTime() + (elapsedHours - finalMixStartHours) * 3600000);
      elapsedHours += phase.hours;
      const duration = formatDuration(phase.hours * 3600, lang);
      const environment = phase.environment === 'room' ? 'RT' : 'CT';
      const description = ({
        hr: `Faza ${index + 1}/${branch.phases.length}: ${duration} ${phase.environment === 'room' ? 'na sobnoj temperaturi' : 'u hladnjaku'} pri ${phase.temperature} °C.${index === branch.phases.length - 1 ? ' Preferment je spreman za završno miješanje.' : ''}`,
        en: `Phase ${index + 1}/${branch.phases.length}: ${duration} ${phase.environment === 'room' ? 'at room temperature' : 'in the fridge'} at ${phase.temperature}°C.${index === branch.phases.length - 1 ? ' The preferment is ready for the final mix.' : ''}`,
        de: `Phase ${index + 1}/${branch.phases.length}: ${duration} ${phase.environment === 'room' ? 'bei Raumtemperatur' : 'im Kühlschrank'} bei ${phase.temperature}°C.${index === branch.phases.length - 1 ? ' Der Vorteig ist bereit für den Endteig.' : ''}`,
        sl: `Faza ${index + 1}/${branch.phases.length}: ${duration} ${phase.environment === 'room' ? 'pri sobni temperaturi' : 'v hladilniku'} pri ${phase.temperature} °C.${index === branch.phases.length - 1 ? ' Preferment je pripravljen za končno mešanje.' : ''}`,
      })[lang];
      return {
        at: stepAt,
        title: `${branch.name} · ${environment} ${index + 1}`,
        desc: description,
        phaseId: `${branch.phaseId}.phase.${index + 1}`,
      };
    });
  });
}
