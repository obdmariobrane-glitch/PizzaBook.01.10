import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const require = createRequire(import.meta.url);
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => {
  const source = readFileSync(filename, 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  module._compile(output, filename);
};

const frontendRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const {
  alignProNapolitanaSpongePlannerSteps,
  alignProSpongeBallingBeforeFridge,
  buildProNapolitanaFermentationSchedule,
  buildProNapolitanaInitialPlannerEvents,
  buildProTegliaSpongePlannerEvents,
  ensureProTargetBakeEvent,
  getProNapolitanaInitialIntervals,
  getProNapolitanaPlannerWindow,
  resolveProNapolitanaFinalRestHours,
} = require('../src/proNapolitanaPlanner.ts');
const { addProNapolitanaDirectInitialPlannerSteps } = require('../src/proNapolitanaDirectPlanner.ts');
const { buildCombinedP3Instructions } = require('../src/i18n/combinedPrefermentSteps.ts');
const { formatCountdown } = require('../src/i18n/prefermentSteps.ts');
const { getPlannerRoomAfterFridgeHours, getPoolishFinalMixDurationMinutes, getTegliaFinalProofPlan } = require('../src/calculator.ts');
const { getProKamadoBigaMixDurationMinutes, buildProKamadoPlannerSteps, buildProKamadoPrefermentBranchSteps } = require('../src/proKamadoPlanner.ts');
const { getProKamadoGuidance } = require('../src/i18n/proKamado.ts');
const { applyPlannerPhaseOverrides, assignPlannerPhaseKeys } = require('../src/plannerPhaseOverrides.ts');

for (const style of ['neapolitan', 'romana', 'ny_style']) {
  for (const mixing of ['hand', 'home', 'spiral']) {
    const fridgeStart = new Date('2030-01-01T17:00:00.000Z');
    const steps = alignProSpongeBallingBeforeFridge([
      { phaseId: 'sponge.fridgeRemoval', at: new Date('2030-01-02T17:00:00.000Z') },
      { phaseId: 'sponge.balling', at: new Date('2030-01-02T17:00:00.000Z') },
      { phaseId: 'sponge.fridge', at: fridgeStart },
    ]);
    const balling = steps.find((step) => step.phaseId === 'sponge.balling');
    const fridge = steps.find((step) => step.phaseId === 'sponge.fridge');
    assert.equal(balling.at.getTime(), fridgeStart.getTime(), `${style}/${mixing}: Sponge shaping starts at fridge entry`);
    assert.ok(steps.indexOf(balling) < steps.indexOf(fridge), `${style}/${mixing}: Sponge shaping displays before refrigeration`);
  }
}

const methods = [
  ['Direct', 'direct', false, false],
  ['Biga', 'biga', false, true],
  ['Poolish', 'poolish', false, true],
  ['Sponge', 'sponge', false, true],
  ['Biga + Poolish', 'biga', true, true],
];
const bakeAt = new Date('2030-01-02T19:00:00.000Z');
const fridgeHours = 24;
const preheatMinutes = 60;

for (const [method, methodKey, isCombined, hasPreferment] of methods) {
  const intervals = getProNapolitanaInitialIntervals(methodKey, isCombined, 22);
  const initialSeconds = intervals.reduce((total, interval) => total + interval.seconds, 0);
  const expectedInitialSeconds = method === 'Direct' ? 5 * 60 : method === 'Biga + Poolish' ? 80 * 60 : 95 * 60;
  assert.equal(initialSeconds, expectedInitialSeconds, `${method}: initial phases come from the instruction timers`);
  const eventKinds = buildProNapolitanaInitialPlannerEvents(methodKey, isCombined, new Date(0), intervals)
    .map(({ kind, index }) => `${kind}${index === undefined ? '' : index}`);
  const expectedEventKinds = method === 'Direct'
    ? ['mix-rest', 'balling']
    : method === 'Biga + Poolish'
      ? ['mix-rest', 'room-rest1', 'fold1', 'room-rest2', 'balling']
      : ['mix-rest', 'room-rest1', 'fold1', 'room-rest2', 'fold2', 'room-rest3', 'balling'];
  assert.deepEqual(eventKinds, expectedEventKinds, `${method}: Planner events match the instruction order`);

  let priorWindow = null;
  for (const roomHours of [2, 4]) {
    const fallbackHours = getPlannerRoomAfterFridgeHours(methodKey, 'neapolitan', 'tonda', roomHours, fridgeHours, 22);
    const selectedFinalRestHours = resolveProNapolitanaFinalRestHours({
      isBeginner: false,
      ovenType: 'ooni',
      method: methodKey,
      style: 'neapolitan',
      combinedBigaPoolish: isCombined,
      fridgeHours,
      selectedHours: roomHours,
      fallbackHours,
    });
    assert.equal(selectedFinalRestHours, roomHours, `${method} ${roomHours} h: Napolitana uses the selected final rest`);
    const sourceSchedule = {
      phases: [
        ...(hasPreferment ? [{ kind: 'preferment', environment: 'room', hours: 8, temperature: 22 }] : []),
        { kind: 'final', environment: 'room', hours: selectedFinalRestHours, temperature: 22 },
        { kind: 'final', environment: 'fridge', hours: fridgeHours, temperature: 4 },
        { kind: 'final-rest', environment: 'room', hours: selectedFinalRestHours, temperature: 22 },
      ],
    };
    const schedule = buildProNapolitanaFermentationSchedule(sourceSchedule, intervals, selectedFinalRestHours, fridgeHours, 22, 4);
    const initialRoomPhases = schedule.phases.filter((phase) => phase.kind === 'final' && phase.environment === 'room');
    const fridgePhases = schedule.phases.filter((phase) => phase.kind === 'final' && phase.environment === 'fridge');
    const finalRestPhases = schedule.phases.filter((phase) => phase.kind === 'final-rest' && phase.environment === 'room');
    assert.equal(initialRoomPhases.length, 1, `${method} ${roomHours} h: initial rests occur once`);
    assert.equal(initialRoomPhases[0].hours * 3600, initialSeconds, `${method} ${roomHours} h: initial rest duration is unchanged`);
    assert.equal(fridgePhases.reduce((total, phase) => total + phase.hours, 0), 24, `${method} ${roomHours} h: fridge remains exactly 24 h`);
    assert.equal(finalRestPhases.reduce((total, phase) => total + phase.hours, 0), roomHours, `${method} ${roomHours} h: final room rest matches selection`);
    assert.equal(schedule.phases.filter((phase) => phase.kind === 'preferment').length, hasPreferment ? 1 : 0, `${method}: preferment phases are preserved`);

    const window = getProNapolitanaPlannerWindow(bakeAt, selectedFinalRestHours, fridgeHours, intervals);
    const mixDurationMinutes = method === 'Poolish' ? getPoolishFinalMixDurationMinutes('hand') : 0;
    const finalMixAt = new Date(window.finalMixAt.getTime() - mixDurationMinutes * 60000);
    const initialSequenceAt = new Date(finalMixAt.getTime() + mixDurationMinutes * 60000);
    const timedEvents = buildProNapolitanaInitialPlannerEvents(methodKey, isCombined, initialSequenceAt, intervals);
    assert.equal(window.initialSeconds, initialSeconds);
    assert.equal(window.fridgeStartAt.getTime(), window.finalMixAt.getTime() + initialSeconds * 1000, `${method} ${roomHours} h: final mix ends initial phases exactly at fridge entry`);
    assert.equal(window.fridgeEndAt.getTime() - window.fridgeStartAt.getTime(), 24 * 3600000, `${method} ${roomHours} h: fridge window is exact`);
    assert.equal(bakeAt.getTime() - window.fridgeEndAt.getTime(), roomHours * 3600000, `${method} ${roomHours} h: no duplicate final room time`);
    assert.ok(bakeAt.getTime() - preheatMinutes * 60000 >= window.fridgeEndAt.getTime(), `${method} ${roomHours} h: preheat fits inside final room rest`);
    assert.equal(timedEvents[0].at.getTime(), finalMixAt.getTime() + mixDurationMinutes * 60000, `${method} ${roomHours} h: initial rest starts after final mix completes`);
    for (let index = 0; index < timedEvents.length; index += 1) {
      const event = timedEvents[index];
      const next = timedEvents[index + 1];
      if (event.kind !== 'balling' && event.seconds !== undefined && next) {
        assert.equal(next.at.getTime() - event.at.getTime(), event.seconds * 1000, `${method} ${roomHours} h: ${event.kind} has its sourced duration`);
      }
    }
    const finalBalling = timedEvents.find((event) => event.kind === 'balling');
    assert.ok(finalBalling, `${method} ${roomHours} h: dough balls are shaped`);
    assert.equal(
      finalBalling.at.getTime() + (finalBalling.seconds ?? 0) * 1000,
      window.fridgeStartAt.getTime(),
      `${method} ${roomHours} h: dough-ball rest, if any, ends at fridge entry`,
    );
    if (method === 'Poolish') {
      const expectedMixStart = roomHours === 4 ? '2030-01-01T13:13:00.000Z' : '2030-01-01T15:13:00.000Z';
      const expectedRestStart = roomHours === 4 ? '2030-01-01T13:25:00.000Z' : '2030-01-01T15:25:00.000Z';
      assert.equal(finalMixAt.toISOString(), expectedMixStart, `${roomHours} h: Poolish final-mix start`);
      assert.equal(timedEvents[0].at.toISOString(), expectedRestStart, `${roomHours} h: Poolish first rest follows selected mix duration`);
      assert.equal(finalBalling.at.toISOString(), roomHours === 4 ? '2030-01-01T15:00:00.000Z' : '2030-01-01T17:00:00.000Z');
      assert.equal(window.fridgeStartAt.toISOString(), finalBalling.at.toISOString(), `${roomHours} h: Poolish balling ends at fridge entry`);
      console.log(`Poolish ${roomHours} h: mix ${finalMixAt.toISOString().slice(11, 16)}, first rest ${timedEvents[0].at.toISOString().slice(11, 16)}, fridge ${window.fridgeStartAt.toISOString().slice(11, 16)}`);
    }
    if (method === 'Sponge') {
      const spongeSteps = alignProNapolitanaSpongePlannerSteps([
        { phaseId: 'sponge.preparation', at: window.fridgeStartAt },
        { phaseId: 'sponge.finalMix', at: window.fridgeStartAt },
        { phaseId: 'sponge.balling', at: window.fridgeEndAt },
        { phaseId: 'sponge.fridge', at: window.fridgeStartAt },
        { phaseId: 'sponge.fridgeRemoval', at: window.fridgeEndAt },
        { phaseId: 'sponge.finalRoom', at: window.fridgeEndAt },
      ], window, 8);
      const spongePhases = new Map(spongeSteps.map((step) => [step.phaseId, step]));
      assert.equal(spongePhases.get('sponge.preparation').at.getTime(), window.finalMixAt.getTime() - 8 * 3600000, `${roomHours} h: Sponge is ready at final mix`);
      assert.equal(spongePhases.get('sponge.finalMix').at.getTime(), window.finalMixAt.getTime(), `${roomHours} h: Sponge final mix precedes initial rests`);
      assert.equal(spongePhases.has('sponge.balling'), false, `${roomHours} h: inherited Sponge balling is removed`);
      const spongeBallings = buildProNapolitanaInitialPlannerEvents(methodKey, isCombined, window.finalMixAt, intervals)
        .filter((event) => event.kind === 'balling');
      assert.equal(spongeBallings.length, 1, `${roomHours} h: exactly one Sponge balling step remains`);
      assert.equal(spongeBallings[0].at.getTime(), window.fridgeStartAt.getTime(), `${roomHours} h: shape Sponge balls before refrigeration`);
      assert.equal(spongePhases.get('sponge.fridge').at.getTime(), window.fridgeStartAt.getTime());
      assert.equal(spongePhases.get('sponge.fridgeRemoval').at.getTime(), window.fridgeEndAt.getTime());
      assert.equal(spongePhases.get('sponge.finalRoom').at.getTime(), window.fridgeEndAt.getTime());
    }
    if (priorWindow) {
      assert.equal(window.initialSeconds, priorWindow.initialSeconds, `${method}: changing 2 h to 4 h does not alter initial durations`);
    }
    priorWindow = window;
  }
  console.log(`${method}: 24 h fridge, 2/4 h final rest, initial phases once`);
}

const newYorkBakeAt = new Date(2026, 10, 18, 19, 0, 0, 0);
const combinedIntervals = getProNapolitanaInitialIntervals('biga', true, 22);
const selectedRestScenario = {
  isBeginner: false,
  ovenType: 'homeStone',
  method: 'biga',
  style: 'ny_style',
  combinedBigaPoolish: true,
  fridgeHours: 24,
  selectedHours: 2,
  fallbackHours: getPlannerRoomAfterFridgeHours('biga', 'ny_style', 'tonda', 2, 24, 22),
};
assert.equal(selectedRestScenario.fallbackHours, 38 / 60, 'the legacy New York fallback is the 38-minute tempering window');
for (const selectedHours of [2, 4]) {
  const finalRestHours = resolveProNapolitanaFinalRestHours({ ...selectedRestScenario, selectedHours });
  const schedule = buildProNapolitanaFermentationSchedule({
    phases: [
      { kind: 'preferment', environment: 'room', hours: 24, temperature: 22 },
      { kind: 'final', environment: 'room', hours: 2, temperature: 22 },
      { kind: 'final', environment: 'fridge', hours: 24, temperature: 4 },
      { kind: 'final-rest', environment: 'room', hours: selectedRestScenario.fallbackHours, temperature: 22 },
    ],
  }, combinedIntervals, finalRestHours, 24, 22, 4);
  const window = getProNapolitanaPlannerWindow(newYorkBakeAt, finalRestHours, 24, combinedIntervals);
  const finalMixDurationMinutes = getProKamadoBigaMixDurationMinutes('hand');
  const baseFinalMixAt = window.finalMixAt;
  const finalMixTargetAt = new Date(window.finalMixAt.getTime() - finalMixDurationMinutes * 60000);
  const finalMixAlignmentMs = finalMixTargetAt.getTime() - baseFinalMixAt.getTime();
  const finalMixAt = new Date(baseFinalMixAt.getTime() + finalMixAlignmentMs);
  const initialSequenceAt = new Date(finalMixAt.getTime() + finalMixDurationMinutes * 60000);
  const initialEvents = buildProNapolitanaInitialPlannerEvents(
    'biga',
    true,
    initialSequenceAt,
    combinedIntervals,
  );
  const initialSteps = initialEvents.flatMap((event) => {
    const shapingStep = {
      phaseId: event.kind === 'room-rest'
        ? `pro.initial.room-rest-${event.index}`
        : event.kind === 'fold'
          ? `pro.initial.fold-${event.index}`
          : `pro.initial.${event.kind}`,
      at: event.at,
      title: event.kind === 'balling' ? 'Oblikovanje kuglica' : event.kind,
      desc: event.kind === 'balling' ? 'Oblikujte kuglice prije hladnjaka.' : '',
    };
    return event.kind === 'balling' && (event.seconds ?? 0) > 0
      ? [shapingStep, {
        phaseId: 'pro.initial.ball-rest',
        at: event.at,
        title: 'Odmor kuglica – 15 min',
        desc: 'Nakon oblikovanja ostavite kuglice da odmore 15 min prije hladnjaka.',
      }]
      : [shapingStep];
  }).sort((left, right) => left.at.getTime() - right.at.getTime()
    || (left.phaseId === 'pro.initial.balling' ? -2 : left.phaseId === 'pro.initial.ball-rest' ? -1 : 0)
      - (right.phaseId === 'pro.initial.balling' ? -2 : right.phaseId === 'pro.initial.ball-rest' ? -1 : 0));
  const generatedSteps = assignPlannerPhaseKeys([
    { phaseId: 'biga.finalMix', at: finalMixAt, title: 'Final mix', desc: '' },
    { phaseId: 'biga.fridge', at: window.fridgeStartAt, title: 'Cold fermentation', desc: '' },
    { phaseId: 'biga.finalRest', at: window.fridgeEndAt, title: 'Final rest', desc: '' },
    ...initialSteps,
    { phaseId: 'proKamado.bake', at: newYorkBakeAt, title: 'Bake', desc: '' },
  ], 'pro', true);
  const plannerSteps = applyPlannerPhaseOverrides(generatedSteps, {});
  const stepById = new Map(plannerSteps.map((step) => [step.phaseId, step]));
  const fridgeStep = stepById.get('biga.fridge');
  const removalStep = stepById.get('biga.finalRest');
  const finalMixStep = stepById.get('biga.finalMix');
  const bakeStep = stepById.get('proKamado.bake');
  const ballingEvent = initialEvents.find((event) => event.kind === 'balling');
  const ballingStep = stepById.get('pro.initial.balling');
  const ballRestStep = stepById.get('pro.initial.ball-rest');
  const localDateTime = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

  assert.equal(schedule.phases.find((phase) => phase.kind === 'final-rest').hours, selectedHours);
  assert.equal(localDateTime(fridgeStep.at), `2026-11-17 ${String(19 - selectedHours).padStart(2, '0')}:00`);
  assert.equal(localDateTime(removalStep.at), `2026-11-18 ${String(19 - selectedHours).padStart(2, '0')}:00`);
  assert.equal(localDateTime(bakeStep.at), '2026-11-18 19:00');
  assert.equal(removalStep.at.getTime() - fridgeStep.at.getTime(), 24 * 3600000, `${selectedHours} h: fridge duration remains exactly 24 h`);
  assert.equal(newYorkBakeAt.getTime() - removalStep.at.getTime(), selectedHours * 3600000, `${selectedHours} h: selected final rest occurs exactly once`);
  assert.equal(window.fridgeStartAt.getTime(), ballingEvent.at.getTime() + (ballingEvent.seconds ?? 0) * 1000);
  assert.equal(window.fridgeStartAt.getTime() - ballingStep.at.getTime(), 15 * 60000, `${selectedHours} h: ball-rest begins 15 minutes before refrigeration`);
  assert.equal(localDateTime(finalMixStep.at), `2026-11-17 ${String(17 - selectedHours).padStart(2, '0')}:26`);
  assert.equal(localDateTime(initialSequenceAt), `2026-11-17 ${String(17 - selectedHours).padStart(2, '0')}:40`);
  assert.equal(localDateTime(ballingStep.at), `2026-11-17 ${String(18 - selectedHours).padStart(2, '0')}:45`);
  assert.equal(ballRestStep.at.getTime(), ballingStep.at.getTime());
  assert.equal(ballRestStep.title, 'Odmor kuglica – 15 min');
  assert.ok(plannerSteps.indexOf(ballingStep) < plannerSteps.indexOf(ballRestStep), 'shaping displays before ball rest at the same time');
  assert.ok(!ballingStep.desc.includes('15 min'), 'the separate step owns the displayed 15-minute duration');
  assert.equal(initialSequenceAt.getTime(), window.finalMixAt.getTime(), `${selectedHours} h: the 14-minute manual mix duration is applied once`);
  assert.equal(window.fridgeStartAt.getTime() - finalMixStep.at.getTime(), (combinedIntervals.reduce((sum, interval) => sum + interval.seconds, 0) / 60 + finalMixDurationMinutes) * 60000,
    `${selectedHours} h: initial mixing/rest durations are retained before refrigeration`);
  assert.equal(plannerSteps.filter((step) => step.phaseId === 'biga.finalRest').length, 1);
}

const plannerIntegrationSource = readFileSync(resolve(frontendRoot, 'app/(tabs)/planner.tsx'), 'utf8');
assert.match(plannerIntegrationSource, /!isBeginner[\s\S]*?!isProKamadoPlan[\s\S]*?method === 'direct'[\s\S]*?effectiveStyle === 'neapolitan'[\s\S]*?addProNapolitanaDirectInitialPlannerSteps\(plannerScheduleSteps, lang, plannerUsesGlutenFreeFlour\)/);
assert.match(plannerIntegrationSource, /resolveProNapolitanaFinalRestHours\(\{[\s\S]*?selectedHours: activeCalculatorPlanSettings\.roomHours[\s\S]*?fallbackHours: getPlannerRoomAfterFridgeHours/);
assert.match(plannerIntegrationSource, /getProNapolitanaPlannerWindow\([\s\S]*?proFinalRoomHours/);
assert.match(plannerIntegrationSource, /buildProNapolitanaFermentationSchedule\([\s\S]*?proFinalRoomHours/);
assert.match(plannerIntegrationSource, /applyPlannerPhaseOverrides\(generatedSteps, activePhaseOverrides\)/);
assert.match(plannerIntegrationSource, /shiftedSteps\[finalMixStepIndex\] \?\? finalMixStep/);
assert.match(plannerIntegrationSource, /const isProRomanaTondaCombinedColdPlan = isProNapolitanaColdPlan[\s\S]*?romanFormat === 'tonda'[\s\S]*?proNapolitanaCombined/);
assert.match(plannerIntegrationSource, /\(isProNyCombinedColdPlan \|\| isProRomanaTondaCombinedColdPlan\)\s*&& event\.kind === 'balling'[\s\S]*?phaseId: 'pro\.initial\.ball-rest'/);
assert.match(plannerIntegrationSource, /step\.phaseId === 'pro\.initial\.balling'[\s\S]*?step\.phaseId === 'pro\.initial\.ball-rest'/);
assert.match(plannerIntegrationSource, /ensureProTargetBakeEvent\(\s*allSteps,\s*isProRomanaTondaCombinedColdPlan \|\| isProNeapolitanCombinedColdPlan/);
assert.match(plannerIntegrationSource, /title: plannerStepCopy\.bakeTitle \?\? plannerStepCopy\.ovenTitle,[\s\S]*?desc: plannerStepCopy\.bakeDesc \?\? plannerStepCopy\.ovenDesc/);

const plannerLocalDateTime = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
const neapolitanBakeAt = new Date(2026, 10, 18, 19, 0, 0, 0);
const neapolitanPreheat = {
  phaseId: 'neapolitan.preheat',
  at: new Date(neapolitanBakeAt.getTime() - 60 * 60000),
  title: 'Upali pećnicu / kamen',
  desc: '',
};
const neapolitanBakeEvent = {
  phaseId: 'neapolitan.bake',
  title: 'Ispeci pizzu',
  desc: 'Lansiraj pizzu u pećnicu točno u planirano vrijeme pečenja.',
};
const neapolitanSteps = ensureProTargetBakeEvent(
  [neapolitanPreheat],
  true,
  neapolitanBakeAt,
  neapolitanBakeEvent,
);
const neapolitanBakeSteps = neapolitanSteps.filter((step) => step.phaseId === neapolitanBakeEvent.phaseId);
assert.equal(neapolitanBakeSteps.length, 1, 'combined Napolitana emits exactly one final bake step');
assert.equal(plannerLocalDateTime(neapolitanSteps.find((step) => step.phaseId === 'neapolitan.preheat').at), '2026-11-18 18:00');
assert.equal(plannerLocalDateTime(neapolitanBakeSteps[0].at), '2026-11-18 19:00');
assert.ok(neapolitanSteps.indexOf(neapolitanPreheat) < neapolitanSteps.indexOf(neapolitanBakeSteps[0]), 'preheating is listed before baking');
assert.equal(ensureProTargetBakeEvent(neapolitanSteps, true, neapolitanBakeAt, neapolitanBakeEvent)
  .filter((step) => step.phaseId === neapolitanBakeEvent.phaseId).length, 1, 'restoring an existing Napolitana bake event is idempotent');

const directBakeAt = new Date(2026, 10, 18, 19, 0, 0, 0);
const directLanguages = {
  hr: ['Završetak zamjesa', 'Početni odmor tijesta', 'Podjela i oblikovanje kuglica'],
  en: ['Mixing complete', 'Initial dough rest', 'Divide and shape dough balls'],
  de: ['Ende des Knetens', 'Erste Teigruhe', 'Teig teilen und Teiglinge formen'],
  sl: ['Konec mešanja testa', 'Začetni počitek testa', 'Delitev in oblikovanje kroglic'],
};
const glutenFreeRestTitles = {
  hr: 'Hidratacija psylliuma',
  en: 'Psyllium hydration',
  de: 'Psyllium-Hydratation',
  sl: 'Hidracija psylliuma',
};
for (const selectedHours of [2, 4]) {
  const fridgeAt = new Date(directBakeAt.getTime() - (24 + selectedHours) * 3600000);
  const fridgeRemovalAt = new Date(fridgeAt.getTime() + 24 * 3600000);
  const baseSteps = [
    { phaseId: 'direct.mix', at: fridgeAt, title: 'Mix dough', desc: '' },
    { phaseId: 'direct.fridge', at: fridgeAt, title: 'Refrigerate', desc: '' },
    { phaseId: 'direct.fridgeRemoval', at: fridgeRemovalAt, title: 'Remove from fridge', desc: '' },
    { phaseId: 'direct.preheat', at: new Date(directBakeAt.getTime() - 60 * 60000), title: 'Preheat', desc: '' },
    { phaseId: 'direct.bake', at: directBakeAt, title: 'Bake', desc: '' },
  ];
  const alignedSteps = addProNapolitanaDirectInitialPlannerSteps(baseSteps, 'hr');
  const glutenFreeSteps = addProNapolitanaDirectInitialPlannerSteps(baseSteps, 'hr', true);
  const glutenFreeRest = glutenFreeSteps.find((step) => step.phaseId === 'direct.initial.mix-rest');
  assert.equal(glutenFreeRest.title, glutenFreeRestTitles.hr);
  assert.equal(glutenFreeRest.desc, 'Pokrijte smjesu i ostavite je 5 minuta da psyllium upije vodu.');
  assert.equal(fridgeAt.getTime() - glutenFreeRest.at.getTime(), 5 * 60000, 'GF Planner hydration uses the existing five-minute interval');
  assert.equal(glutenFreeSteps.filter((step) => step.phaseId === 'direct.initial.mix-rest').length, 1);
  const keyedSteps = assignPlannerPhaseKeys(alignedSteps, 'pro', true);
  const preheatStep = keyedSteps.find((step) => step.phaseId === 'direct.preheat');
  const finalSteps = applyPlannerPhaseOverrides(keyedSteps, {
    [preheatStep.phaseKey]: directBakeAt.getTime() - 60 * 60000,
  });
  const stepById = new Map(finalSteps.map((step) => [step.phaseId, step]));
  const mixStep = stepById.get('direct.mix');
  const restStep = stepById.get('direct.initial.mix-rest');
  const ballingStep = stepById.get('direct.initial.balling');
  const fridgeStep = stepById.get('direct.fridge');
  const removalStep = stepById.get('direct.fridgeRemoval');
  const preheat = stepById.get('direct.preheat');
  const bake = stepById.get('direct.bake');

  assert.equal(plannerLocalDateTime(fridgeStep.at), `2026-11-17 ${String(19 - selectedHours).padStart(2, '0')}:00`);
  assert.equal(plannerLocalDateTime(removalStep.at), `2026-11-18 ${String(19 - selectedHours).padStart(2, '0')}:00`);
  assert.equal(removalStep.at.getTime() - fridgeStep.at.getTime(), 24 * 3600000);
  assert.equal(mixStep.at.getTime(), fridgeAt.getTime() - 5 * 60000, `${selectedHours} h: mixing event marks completion 5 minutes before fridge entry`);
  assert.equal(restStep.at.getTime(), mixStep.at.getTime(), `${selectedHours} h: the 5-minute rest begins at mixing completion`);
  assert.equal(restStep.desc, 'Pokrijte tijesto i ostavite ga da odmori 5 minuta.');
  assert.equal(ballingStep.at.getTime(), fridgeStep.at.getTime(), `${selectedHours} h: shaping is placed immediately before fridge entry without an invented duration`);
  assert.ok(finalSteps.indexOf(ballingStep) < finalSteps.indexOf(fridgeStep), `${selectedHours} h: shaping sorts before refrigeration at equal time`);
  assert.equal(plannerLocalDateTime(preheat.at), '2026-11-18 18:00');
  assert.equal(plannerLocalDateTime(bake.at), '2026-11-18 19:00');
  assert.equal(finalSteps.filter((step) => step.phaseId === 'direct.initial.mix-rest').length, 1);
  assert.equal(finalSteps.some((step) => step.phaseId === 'direct.bulk'), false, 'no additional bulk fermentation is introduced');

  for (const [lang, labels] of Object.entries(directLanguages)) {
    const localizedSteps = addProNapolitanaDirectInitialPlannerSteps(baseSteps, lang);
    const localizedGlutenFreeSteps = addProNapolitanaDirectInitialPlannerSteps(baseSteps, lang, true);
    assert.ok(localizedSteps.some((step) => step.phaseId === 'direct.mix' && step.title === labels[0]), `${lang}: mixing completion is localized`);
    assert.ok(localizedSteps.some((step) => step.phaseId === 'direct.initial.mix-rest' && step.title === labels[1]), `${lang}: initial rest is localized`);
    assert.ok(localizedSteps.some((step) => step.phaseId === 'direct.initial.balling' && step.title === labels[2]), `${lang}: shaping is localized`);
    const localizedGlutenFreeRest = localizedGlutenFreeSteps.find((step) => step.phaseId === 'direct.initial.mix-rest');
    assert.equal(localizedGlutenFreeRest.title, glutenFreeRestTitles[lang], `${lang}: GF Planner rest label is localized`);
    assert.match(localizedGlutenFreeRest.desc, /5/);
  }
  assert.match(mixStep.desc, /ne procjenjuje njegovo trajanje/);
  console.log(`Direct ${selectedHours} h: mix complete ${plannerLocalDateTime(mixStep.at)}, fridge ${plannerLocalDateTime(fridgeStep.at)}, removal ${plannerLocalDateTime(removalStep.at)}`);
}

const romanaBakeAt = new Date(2026, 10, 18, 19, 0, 0, 0);
for (const selectedHours of [2, 4]) {
  const fallbackHours = getPlannerRoomAfterFridgeHours('biga', 'romana', 'tonda', selectedHours, 24, 22);
  const finalRestHours = resolveProNapolitanaFinalRestHours({
    isBeginner: false,
    ovenType: 'homeStone',
    method: 'biga',
    style: 'romana',
    combinedBigaPoolish: true,
    selectedHours,
    fallbackHours,
  });
  assert.equal(finalRestHours, selectedHours, `Romana Tonda ${selectedHours} h: the selected post-fridge rest is retained`);
  const schedule = buildProNapolitanaFermentationSchedule({
    phases: [
      { kind: 'preferment', environment: 'room', hours: 24, temperature: 22 },
      { kind: 'final', environment: 'room', hours: 2, temperature: 22 },
      { kind: 'final', environment: 'fridge', hours: 24, temperature: 4 },
      { kind: 'final-rest', environment: 'room', hours: fallbackHours, temperature: 22 },
    ],
  }, combinedIntervals, finalRestHours, 24, 22, 4);
  const window = getProNapolitanaPlannerWindow(romanaBakeAt, finalRestHours, 24, combinedIntervals);
  const finalMixDurationMinutes = getProKamadoBigaMixDurationMinutes('hand');
  const finalMixAt = new Date(window.finalMixAt.getTime() - finalMixDurationMinutes * 60000);
  const initialSequenceAt = new Date(finalMixAt.getTime() + finalMixDurationMinutes * 60000);
  const initialEvents = buildProNapolitanaInitialPlannerEvents('biga', true, initialSequenceAt, combinedIntervals);
  const initialSteps = initialEvents.flatMap((event) => {
    const phaseId = event.kind === 'room-rest'
      ? `pro.initial.room-rest-${event.index}`
      : event.kind === 'fold'
        ? `pro.initial.fold-${event.index}`
        : `pro.initial.${event.kind}`;
    const shapingStep = {
      phaseId,
      at: event.at,
      title: event.kind === 'balling' ? 'Oblikovanje kuglica' : event.kind,
      desc: '',
    };
    return event.kind === 'balling'
      ? [shapingStep, {
        phaseId: 'pro.initial.ball-rest',
        at: event.at,
        title: 'Odmor kuglica – 15 min',
        desc: 'Ostavite kuglice da odmore 15 min prije hladnjaka.',
      }]
      : [shapingStep];
  });
  const alignedAndFilteredSteps = [
    { phaseId: 'biga.finalMix', at: finalMixAt, title: 'Završni zamjes', desc: '' },
    { phaseId: 'biga.fridge', at: window.fridgeStartAt, title: 'Hladnjak', desc: '' },
    { phaseId: 'biga.finalRest', at: window.fridgeEndAt, title: 'Vađenje iz hladnjaka', desc: '' },
    ...initialSteps,
    { phaseId: 'romana.preheat', at: new Date(romanaBakeAt.getTime() - 60 * 60000), title: 'Upali pećnicu / kamen', desc: '' },
  ];
  const completedSteps = ensureProTargetBakeEvent(
    alignedAndFilteredSteps,
    true,
    romanaBakeAt,
    {
      phaseId: 'romanaTonda.bake',
      title: 'Ispeci pizzu',
      desc: 'Lansiraj pizzu u pećnicu točno u planirano vrijeme pečenja.',
    },
  );
  const plannerSteps = applyPlannerPhaseOverrides(assignPlannerPhaseKeys(completedSteps, 'pro', true), {});
  const stepById = new Map(plannerSteps.map((step) => [step.phaseId, step]));
  const fridgeStep = stepById.get('biga.fridge');
  const removalStep = stepById.get('biga.finalRest');
  const ballingStep = stepById.get('pro.initial.balling');
  const ballRestStep = stepById.get('pro.initial.ball-rest');
  const finalMixStep = stepById.get('biga.finalMix');
  const firstRoomRest = initialEvents.find((event) => event.kind === 'room-rest' && event.index === 1);
  const secondRoomRest = initialEvents.find((event) => event.kind === 'room-rest' && event.index === 2);
  const fold = initialEvents.find((event) => event.kind === 'fold' && event.index === 1);

  assert.equal(schedule.phases.find((phase) => phase.kind === 'final-rest').hours, selectedHours);
  assert.equal(schedule.phases.filter((phase) => phase.kind === 'final' && phase.environment === 'fridge').reduce((total, phase) => total + phase.hours, 0), 24);
  assert.equal(plannerLocalDateTime(fridgeStep.at), `2026-11-17 ${String(19 - selectedHours).padStart(2, '0')}:00`);
  assert.equal(plannerLocalDateTime(removalStep.at), `2026-11-18 ${String(19 - selectedHours).padStart(2, '0')}:00`);
  const bakeSteps = plannerSteps.filter((step) => step.phaseId === 'romanaTonda.bake');
  assert.equal(bakeSteps.length, 1, 'Romana Tonda emits exactly one final bake step');
  assert.equal(bakeSteps[0].title, 'Ispeci pizzu');
  assert.equal(plannerLocalDateTime(bakeSteps[0].at), '2026-11-18 19:00');
  const preheatStep = stepById.get('romana.preheat');
  assert.equal(plannerSteps.indexOf(preheatStep) < plannerSteps.indexOf(bakeSteps[0]), true, 'preheating is listed before baking');
  assert.equal(ensureProTargetBakeEvent(completedSteps, true, romanaBakeAt, {
    phaseId: 'romanaTonda.bake',
    title: 'Ispeci pizzu',
    desc: 'Lansiraj pizzu u pećnicu točno u planirano vrijeme pečenja.',
  }).filter((step) => step.phaseId === 'romanaTonda.bake').length, 1, 'restoring an existing bake event is idempotent');
  assert.equal(ensureProTargetBakeEvent(alignedAndFilteredSteps, false, romanaBakeAt, {
    phaseId: 'romanaTonda.bake',
    title: 'Ispeci pizzu',
    desc: 'Lansiraj pizzu u pećnicu točno u planirano vrijeme pečenja.',
  }).some((step) => step.phaseId === 'romanaTonda.bake'), false, 'non-target plans do not receive a Romana bake event');
  assert.equal(plannerLocalDateTime(finalMixStep.at), `2026-11-17 ${String(17 - selectedHours).padStart(2, '0')}:26`);
  assert.equal(initialSequenceAt.getTime() - finalMixStep.at.getTime(), 14 * 60000, 'manual final-mix duration is applied once');
  assert.equal(firstRoomRest.at.getTime() - initialSequenceAt.getTime(), 5 * 60000, 'initial 5-minute mix rest is preserved');
  assert.equal(fold.at.getTime() - firstRoomRest.at.getTime(), 30 * 60000, 'first 30-minute room rest is preserved before Stretch & Fold');
  assert.equal(secondRoomRest.at.getTime(), fold.at.getTime(), 'second room rest begins at the fold event');
  assert.equal(ballingStep.at.getTime() - secondRoomRest.at.getTime(), 30 * 60000, 'second 30-minute room rest is preserved');
  assert.equal(window.fridgeStartAt.getTime() - ballingStep.at.getTime(), 15 * 60000);
  assert.equal(ballRestStep.at.getTime(), ballingStep.at.getTime());
  assert.equal(ballRestStep.title, 'Odmor kuglica – 15 min');
  assert.ok(plannerSteps.indexOf(ballingStep) < plannerSteps.indexOf(ballRestStep));
  assert.equal(removalStep.at.getTime() - fridgeStep.at.getTime(), 24 * 3600000);
  console.log(`Romana Tonda ${selectedHours} h: balling ${plannerLocalDateTime(ballingStep.at)}, fridge ${plannerLocalDateTime(fridgeStep.at)}, removal ${plannerLocalDateTime(removalStep.at)}`);
}

const methodTransitions = [
  ['biga', true, 80 * 60],
  ['direct', false, 5 * 60],
  ['poolish', false, 95 * 60],
  ['sponge', false, 95 * 60],
  ['biga', true, 80 * 60],
];
for (const [method, isCombined, expectedSeconds] of methodTransitions) {
  assert.equal(
    getProNapolitanaInitialIntervals(method, isCombined, 22).reduce((total, interval) => total + interval.seconds, 0),
    expectedSeconds,
    `method transition to ${method}${isCombined ? ' + Poolish' : ''} uses only its own intervals`,
  );
}
assert.equal(getProNapolitanaInitialIntervals('poolish', true, 22).length, 4, 'single Poolish never takes the combined four-interval schedule');
assert.equal(getProNapolitanaInitialIntervals('poolish', true, 22).reduce((total, interval) => total + interval.seconds, 0), 95 * 60);
assert.equal(getPoolishFinalMixDurationMinutes('hand'), 12);
assert.equal(getPoolishFinalMixDurationMinutes('home'), 9);
assert.equal(getPoolishFinalMixDurationMinutes('spiral'), 9);

for (const temperingHours of [2, 4]) {
  const instructions = buildCombinedP3Instructions({
    lang: 'en',
    baseSteps: ['Mix dough', 'Rest dough', 'Fold dough', 'Shape dough balls'],
    selectedBallingStep: 'Divide and shape dough balls.',
    fridgeHours: 24,
    temperingHours,
    fridgeTemperature: '4°C',
    isGlutenFree: false,
    formatDuration: (seconds) => `${seconds / 3600} hours`,
  });
  const finalRestTimer = instructions.timers.find((timer) => timer.id === 'combined-pre-bake-tempering');
  assert.equal(finalRestTimer.seconds, temperingHours * 3600, `combined method ${temperingHours} h: final timer matches selection`);
  assert.ok(instructions.steps.some((step) => step.includes(`${temperingHours} hours`)), `combined method ${temperingHours} h: final text matches selection`);
}

assert.equal(formatCountdown(2 * 3600000), '02:00:00');
assert.equal(formatCountdown(4 * 3600000), '04:00:00');
assert.equal(formatCountdown(2 * 3600000 - 1000), '01:59:59');
const appSource = readFileSync(resolve(frontendRoot, 'app/(tabs)/index.tsx'), 'utf8');
const plannerSource = readFileSync(resolve(frontendRoot, 'app/(tabs)/planner.tsx'), 'utf8');
assert.match(appSource, /steps:\s*isKamado\s*\?\s*\[copy\.temper,[\s\S]*?kamadoLaunch, kamadoBake\]/);
assert.doesNotMatch(appSource, /direct \? getKamadoBakeBlockedText\(lang\)/);
assert.match(plannerSource, /method === 'poolish'[\s\S]*?getPoolishFinalMixDurationMinutes\(activeMixing\)/);
assert.match(plannerSource, /buildProNapolitanaInitialPlannerEvents\([\s\S]*?initialSequenceAt/);
assert.match(plannerSource, /alignProSpongeBallingBeforeFridge\(plannerScheduleSteps\)/);
assert.match(plannerSource, /isBeginner \|\| isProKamadoPlan \|\| method !== 'sponge'/);
assert.match(plannerSource, /phaseCopy = \(\{[\s\S]*?Bereit für den Hauptteig\.[\s\S]*?Pripravljeno za končno mešanje testa\./);
assert.match(plannerSource, /const proNapolitanaCombined = method === 'biga'[\s\S]*?poolishEnabled/);
const startTimerSource = appSource.slice(appSource.indexOf('const startTimer ='), appSource.indexOf('const pauseTimer ='));
const resumeTimerSource = appSource.slice(appSource.indexOf('const resumeTimer ='), appSource.indexOf('const resetTimer ='));
assert.match(startTimerSource, /const startedAt = Date\.now\(\);[\s\S]*await scheduleLocal[\s\S]*const endsAt = startedAt \+ t\.seconds \* 1000/);
assert.match(resumeTimerSource, /const resumedAt = Date\.now\(\);[\s\S]*await scheduleLocal[\s\S]*const endsAt = resumedAt \+ remainingMs/);
assert.match(startTimerSource, /setNow\(Date\.now\(\)\)/);
assert.match(resumeTimerSource, /setNow\(Date\.now\(\)\)/);
assert.match(appSource, /remainingMs: t\.seconds \* 1000/);
assert.match(appSource, /if \(activeTimers\[key\]\) return/);
console.log('Timer conversion, action-time anchoring, refreshed display time, and active-timer preservation: verified');

const kamadoBakeAt = new Date('2030-01-02T19:00:00.000Z');
const kamadoMethods = ['direct', 'biga', 'poolish', 'sponge'];
const kamadoStyles = ['neapolitan', 'romana', 'ny_style'];
const kamadoLanguages = ['hr', 'en', 'de', 'sl'];
for (const method of kamadoMethods) {
  const phases = [
    ...(method === 'direct' ? [] : [{ kind: 'preferment', environment: 'room', hours: 8, temperature: 22 }]),
    { kind: 'final', environment: 'room', hours: 3, temperature: 22 },
    { kind: 'final', environment: 'fridge', hours: 2, temperature: 4 },
    { kind: 'final-rest', environment: 'room', hours: 1, temperature: 22 },
  ];
  const initialIntervals = getProNapolitanaInitialIntervals(method, false, 22);
  for (const style of kamadoStyles) {
    const steps = buildProKamadoPlannerSteps(
      kamadoBakeAt,
      method,
      style,
      { phases, prefermentHours: method === 'direct' ? 0 : 8, prefermentRoomHours: method === 'direct' ? 0 : 8, prefermentFridgeHours: 0 },
      'en',
      60,
      method === 'sponge' ? { title: 'Sponge preparation', steps: ['Prepare sponge'] } : null,
      initialIntervals,
      false,
      method === 'poolish' ? getPoolishFinalMixDurationMinutes('hand') : 0,
    );
    const bakeStep = steps.find((step) => step.phaseId === 'proKamado.bake');
    assert.equal(bakeStep.at.getTime(), kamadoBakeAt.getTime(), `${method}/${style}: selected bake target is retained`);
    assert.doesNotMatch(bakeStep.desc, /\d+\s*(?:-|to)\s*\d+/i, `${method}/${style}: bake guidance has no fixed time range`);
    assert.equal(steps.find((step) => step.phaseId === 'proKamado.preheat').at.getTime(), kamadoBakeAt.getTime() - 60 * 60000);
    assert.ok(steps.some((step) => step.phaseId === (method === 'direct' ? 'direct.mix' : `${method}.finalMix`)), `${method}: mixing phase is present`);
    if (method === 'biga') assert.equal(steps.filter((step) => step.phaseId?.startsWith('biga.phase.')).length, 0, 'Biga preferment phases are owned only by the branch builder');
    if (method === 'sponge') assert.ok(steps.some((step) => step.phaseId === 'sponge.preparation'));
  }
}

const poolishIntervals = getProNapolitanaInitialIntervals('poolish', false, 22);
const poolishSteps = buildProKamadoPlannerSteps(
  new Date('2026-11-14T19:00:00.000Z'),
  'poolish',
  'romana',
  {
    phases: [
      { kind: 'preferment', environment: 'room', hours: 16, temperature: 22 },
      { kind: 'final', environment: 'fridge', hours: 24, temperature: 4 },
      { kind: 'final-rest', environment: 'room', hours: 4, temperature: 22 },
    ],
    prefermentHours: 16,
    prefermentRoomHours: 16,
    prefermentFridgeHours: 0,
  },
  'hr',
  60,
  null,
  poolishIntervals,
  false,
  getPoolishFinalMixDurationMinutes('hand'),
);
const poolishStepById = new Map(poolishSteps.map((step) => [step.phaseId, step]));
assert.equal(poolishStepById.get('poolish.finalMix').at.toISOString(), '2026-11-13T13:13:00.000Z', 'Poolish manual mixing moves preparation earlier by its actual 12-minute duration');
assert.equal(poolishStepById.get('pro.initial.mix-rest').at.toISOString(), '2026-11-13T13:25:00.000Z');
assert.ok(poolishStepById.get('pro.initial.mix-rest').desc.includes('5 min'), 'the existing 5-minute rest is displayed in minutes');
assert.equal(poolishStepById.get('pro.initial.balling').at.toISOString(), '2026-11-13T15:00:00.000Z', 'all initial rests end before shaping at fridge entry');
assert.equal(poolishStepById.get('poolish.fridge').at.toISOString(), '2026-11-13T15:00:00.000Z', 'fridge start remains exactly 24 hours before the selected 4-hour final rest');
assert.equal(poolishStepById.get('poolish.finalRest').at.toISOString(), '2026-11-14T15:00:00.000Z');
assert.equal(poolishSteps.filter((step) => step.phaseId === 'poolish.finalRest').length, 1, 'selected final room rest is counted once');

for (const [method, combined] of [['direct', false], ['biga', false], ['poolish', false], ['sponge', false], ['biga', true]]) {
  const intervals = getProNapolitanaInitialIntervals(method, combined, 22);
  const makeSteps = (finalRestHours) => buildProKamadoPlannerSteps(
    kamadoBakeAt,
    method,
    'neapolitan',
    {
      phases: [
        ...(method === 'direct' ? [] : [{ kind: 'preferment', environment: 'room', hours: 8, temperature: 22 }]),
        { kind: 'final', environment: 'fridge', hours: 24, temperature: 4 },
        { kind: 'final-rest', environment: 'room', hours: finalRestHours, temperature: 22 },
      ],
      prefermentHours: method === 'direct' ? 0 : 8,
      prefermentRoomHours: method === 'direct' ? 0 : 8,
      prefermentFridgeHours: 0,
    },
    'en',
    60,
    null,
    intervals,
    combined,
    method === 'poolish' ? getPoolishFinalMixDurationMinutes('hand') : 0,
  );
  const twoHourSteps = makeSteps(2).filter((step) => step.phaseId?.startsWith('pro.initial.'));
  const fourHourSteps = makeSteps(4).filter((step) => step.phaseId?.startsWith('pro.initial.'));
  assert.deepEqual(fourHourSteps.map((step) => step.phaseId), twoHourSteps.map((step) => step.phaseId), `${method}${combined ? ' + Poolish' : ''}: initial event sequence is unchanged`);
  assert.ok(twoHourSteps.every((step, index) => fourHourSteps[index].at.getTime() - step.at.getTime() === -2 * 3600000), `${method}${combined ? ' + Poolish' : ''}: only event placement shifts by the final-rest difference`);
  for (let index = 1; index < twoHourSteps.length; index += 1) {
    assert.equal(
      twoHourSteps[index].at.getTime() - twoHourSteps[index - 1].at.getTime(),
      fourHourSteps[index].at.getTime() - fourHourSteps[index - 1].at.getTime(),
      `${method}${combined ? ' + Poolish' : ''}: initial rest and fold spacing is unchanged`,
    );
  }
}

const branchFinalMixAt = new Date('2030-01-02T19:00:00.000Z');
const bigaBranches = buildProKamadoPrefermentBranchSteps(branchFinalMixAt, [
  {
    name: 'Biga',
    phaseId: 'biga',
    startAtHours: 0,
    phases: [
      { kind: 'preferment', environment: 'room', hours: 1.5833333333333333, temperature: 22 },
      { kind: 'preferment', environment: 'fridge', hours: 0.08333333333333333, temperature: 4 },
    ],
  },
], 'hr');
assert.deepEqual(bigaBranches.map((step) => step.phaseId), ['biga.phase.1', 'biga.phase.2'], 'each Biga phase is generated once');
assert.equal(bigaBranches[0].desc.includes('1 h 35 min'), true, 'fractional hours are displayed as hours and minutes');
assert.equal(bigaBranches[1].desc.includes('5 min'), true, 'fractional hours are displayed as minutes');
assert.equal(bigaBranches[1].at.getTime() - bigaBranches[0].at.getTime(), 1.5833333333333333 * 3600000, 'display formatting does not round scheduled phase duration');
assert.equal(bigaBranches[1].at.toISOString(), '2030-01-02T18:55:00.000Z', 'the second Biga phase begins when the first ends');
const combinedBranches = buildProKamadoPrefermentBranchSteps(branchFinalMixAt, [
  { name: 'Biga', phaseId: 'biga', startAtHours: 0, phases: [{ kind: 'preferment', environment: 'room', hours: 8, temperature: 22 }] },
  { name: 'Poolish', phaseId: 'poolish', startAtHours: 2, phases: [{ kind: 'preferment', environment: 'room', hours: 6, temperature: 22 }] },
], 'en');
assert.deepEqual(combinedBranches.map((step) => step.phaseId), ['biga.phase.1', 'poolish.phase.1'], 'combined Biga + Poolish phases are each generated once');
assert.equal(combinedBranches[0].at.getTime() + 8 * 3600000, branchFinalMixAt.getTime(), 'Biga branch ends before the final mix');
assert.equal(combinedBranches[1].at.getTime() + 6 * 3600000, branchFinalMixAt.getTime(), 'Poolish branch ends before the final mix');
for (const lang of kamadoLanguages) {
  const localizedBranches = buildProKamadoPrefermentBranchSteps(branchFinalMixAt, [{
    name: 'Preferment', phaseId: 'biga', startAtHours: 0,
    phases: [{ kind: 'preferment', environment: 'room', hours: 1.5833333333333333, temperature: 22 }],
  }], lang);
  const expectedPrefix = ({ hr: 'Faza ', en: 'Phase ', de: 'Phase ', sl: 'Faza ' })[lang];
  assert.ok(localizedBranches[0].desc.startsWith(expectedPrefix), `${lang}: Biga branch duration text is localized`);
}

for (const [mixing, expectedDuration] of [['hand', 14], ['home', 8], ['spiral', 8]]) {
  assert.equal(getProKamadoBigaMixDurationMinutes(mixing), expectedDuration, `${mixing}: use the existing Biga final-mix duration`);
  for (const combined of [false, true]) {
    const intervals = getProNapolitanaInitialIntervals('biga', combined, 22);
    for (const finalRestHours of [2, 4]) {
      const bigaSteps = buildProKamadoPlannerSteps(
        branchFinalMixAt,
        'biga',
        'neapolitan',
        {
          phases: [
            { kind: 'preferment', environment: 'room', hours: 16, temperature: 22 },
            { kind: 'final', environment: 'fridge', hours: 24, temperature: 4 },
            { kind: 'final-rest', environment: 'room', hours: finalRestHours, temperature: 22 },
          ],
          prefermentHours: 16,
          prefermentRoomHours: 16,
          prefermentFridgeHours: 0,
        },
        'en',
        60,
        null,
        intervals,
        combined,
        expectedDuration,
      );
      const stepById = new Map(bigaSteps.map((step) => [step.phaseId, step]));
      assert.equal(
        stepById.get('pro.initial.mix-rest').at.getTime() - stepById.get('biga.finalMix').at.getTime(),
        expectedDuration * 60000,
        `${mixing}/${combined ? 'combined' : 'Biga'}/${finalRestHours} h: first rest starts after the selected final mix completes`,
      );
      assert.equal(stepById.get('biga.fridge').at.getTime(), branchFinalMixAt.getTime() - (finalRestHours + 24) * 3600000);
      const branches = buildProKamadoPrefermentBranchSteps(stepById.get('biga.finalMix').at, [
        { name: 'Biga', phaseId: 'biga', startAtHours: 0, phases: [{ kind: 'preferment', environment: 'room', hours: 16, temperature: 22 }] },
        ...(combined ? [{ name: 'Poolish', phaseId: 'poolish', startAtHours: 2, phases: [{ kind: 'preferment', environment: 'room', hours: 14, temperature: 22 }] }] : []),
      ], 'en');
      for (const branch of branches) {
        const phaseHours = branch.phaseId === 'biga.phase.1' ? 16 : 14;
        assert.ok(branch.at.getTime() + phaseHours * 3600000 <= stepById.get('biga.finalMix').at.getTime(), `${mixing}/${combined ? 'combined' : 'Biga'}: preferment is ready before the final mix`);
      }
    }
  }
}

const kamadoMatrix = [
  ['direct', false],
  ['biga', false],
  ['poolish', false],
  ['sponge', false],
  ['biga', true],
];
const mixingModes = ['hand', 'home', 'spiral'];
for (const [method, combined] of kamadoMatrix) {
  for (const mixing of mixingModes) {
    const mixDuration = method === 'direct'
      ? 0
      : method === 'biga'
        ? getProKamadoBigaMixDurationMinutes(mixing)
        : getPoolishFinalMixDurationMinutes(mixing);
    const intervals = getProNapolitanaInitialIntervals(method, combined, 22);
    for (const finalRestHours of [2, 4]) {
      const bakeTarget = new Date('2030-01-02T19:00:00.000Z');
      const phases = [
        ...(method === 'direct' ? [] : [{ kind: 'preferment', environment: 'room', hours: 8, temperature: 22 }]),
        { kind: 'final', environment: 'fridge', hours: 24, temperature: 4 },
        { kind: 'final-rest', environment: 'room', hours: finalRestHours, temperature: 22 },
      ];
      const schedule = {
        phases,
        prefermentHours: method === 'direct' ? 0 : 8,
        prefermentRoomHours: method === 'direct' ? 0 : 8,
        prefermentFridgeHours: 0,
      };
      const steps = buildProKamadoPlannerSteps(
        bakeTarget,
        method,
        'neapolitan',
        schedule,
        'en',
        60,
        method === 'sponge' ? { title: 'Sponge preparation', steps: ['Prepare sponge'] } : null,
        intervals,
        combined,
        mixDuration,
      );
      const mixStepId = method === 'direct' ? 'direct.mix' : `${method}.finalMix`;
      const finalRestStepId = method === 'sponge' ? 'sponge.fridgeRemoval' : `${method}.finalRest`;
      const stepById = new Map(steps.map((step) => [step.phaseId, step]));
      const finalMix = stepById.get(mixStepId);
      const firstRest = stepById.get('pro.initial.mix-rest');
      const fridgeAt = bakeTarget.getTime() - (24 + finalRestHours) * 3600000;
      const branchSteps = method === 'biga'
        ? buildProKamadoPrefermentBranchSteps(finalMix.at, [
          { name: 'Biga', phaseId: 'biga', startAtHours: 0, phases: [{ kind: 'preferment', environment: 'room', hours: 8, temperature: 22 }] },
          ...(combined ? [{ name: 'Poolish', phaseId: 'poolish', startAtHours: 2, phases: [{ kind: 'preferment', environment: 'room', hours: 6, temperature: 22 }] }] : []),
        ], 'en')
        : [];
      const completeTimeline = [...steps, ...branchSteps];
      assert.equal(firstRest.at.getTime() - finalMix.at.getTime(), mixDuration * 60000, `${method}${combined ? ' + Poolish' : ''}/${mixing}/${finalRestHours} h: mix and first rest ordering`);
      assert.equal(stepById.get(`${method}.fridge`).at.getTime(), fridgeAt, `${method}${combined ? ' + Poolish' : ''}/${mixing}/${finalRestHours} h: 24-hour fridge starts at selected offset`);
      assert.equal(stepById.get(finalRestStepId).at.getTime(), fridgeAt + 24 * 3600000, `${method}${combined ? ' + Poolish' : ''}/${mixing}/${finalRestHours} h: final room rest begins after the fridge`);
      assert.equal(stepById.get('proKamado.bake').at.getTime(), bakeTarget.getTime(), `${method}${combined ? ' + Poolish' : ''}/${mixing}/${finalRestHours} h: bake target is retained`);
      assert.equal(steps.filter((step) => step.phaseId === finalRestStepId).length, 1, `${method}${combined ? ' + Poolish' : ''}/${mixing}/${finalRestHours} h: final rest occurs once`);
      assert.equal(new Set(completeTimeline.map((step) => step.phaseId).filter(Boolean)).size, completeTimeline.filter((step) => step.phaseId).length, `${method}${combined ? ' + Poolish' : ''}/${mixing}/${finalRestHours} h: no duplicate Planner phase IDs`);
      for (const branchStep of branchSteps) {
        const branchDurationHours = branchStep.phaseId === 'biga.phase.1' ? 8 : 6;
        assert.ok(branchStep.at.getTime() + branchDurationHours * 3600000 <= finalMix.at.getTime(), `${mixing}/${finalRestHours} h: ${branchStep.phaseId} finishes before final mix`);
      }
      if (method === 'direct') {
        assert.equal(finalMix.title, 'Final mix complete', `${mixing}: Direct event is explicitly a completion event`);
        assert.ok(finalMix.desc.includes('complete'), `${mixing}: Direct description states mixing is complete`);
        assert.ok(steps.indexOf(finalMix) < steps.indexOf(firstRest), `${mixing}: Direct completion appears before the 5-minute rest`);
      }
      if (method === 'sponge') {
        const preferment = stepById.get('sponge.phase.1');
        assert.ok(preferment.at.getTime() + 8 * 3600000 <= finalMix.at.getTime(), `${mixing}/${finalRestHours} h: Sponge preferment ends before final mix`);
      }
      if (combined) {
        const balling = stepById.get('pro.initial.balling');
        const ballRest = stepById.get('pro.initial.ball-rest');
        assert.equal(balling.at.getTime(), fridgeAt - 15 * 60000, `${mixing}/${finalRestHours} h: shaping begins 15 minutes before fridge entry`);
        assert.equal(ballRest.at.getTime(), balling.at.getTime(), `${mixing}/${finalRestHours} h: existing ball-rest starts after shaping`);
        assert.ok(steps.indexOf(balling) < steps.indexOf(ballRest), `${mixing}/${finalRestHours} h: shaping displays before the ball rest`);
        assert.ok(ballRest.desc.includes('15 min'), `${mixing}/${finalRestHours} h: the existing 15-minute ball-rest is visible`);
        assert.equal(ballRest.at.getTime() + 15 * 60000, fridgeAt, `${mixing}/${finalRestHours} h: displayed ball-rest ends exactly at fridge entry`);
      }
    }
  }
}

const directLocalizedCopy = {
  hr: ['Završetak zamjesa', 'Završni zamjes je završen; odmor počinje sada.'],
  en: ['Final mix complete', 'The final mix is complete; the rest begins now.'],
  de: ['Ende des Endknetens', 'Der Endteig ist fertig geknetet; die Ruhezeit beginnt jetzt.'],
  sl: ['Končno mešanje je končano', 'Končno mešanje je končano; počitek se začne zdaj.'],
};
for (const lang of kamadoLanguages) {
  const steps = buildProKamadoPlannerSteps(
    branchFinalMixAt,
    'direct',
    'neapolitan',
    { phases: [{ kind: 'final', environment: 'fridge', hours: 24, temperature: 4 }, { kind: 'final-rest', environment: 'room', hours: 2, temperature: 22 }], prefermentHours: 0, prefermentRoomHours: 0, prefermentFridgeHours: 0 },
    lang,
    60,
    null,
    getProNapolitanaInitialIntervals('direct', false, 22),
  );
  const directMix = steps.find((step) => step.phaseId === 'direct.mix');
  const directRest = steps.find((step) => step.phaseId === 'pro.initial.mix-rest');
  assert.equal(directMix.title, directLocalizedCopy[lang][0], `${lang}: Direct event is named as mix completion`);
  assert.equal(directMix.desc, directLocalizedCopy[lang][1], `${lang}: Direct completion description is localized`);
  assert.ok(steps.indexOf(directMix) < steps.indexOf(directRest), `${lang}: mix completion is ordered before the rest`);
}

const localizedCombinedTitles = {
  hr: 'Završni zamjes s Bigom i Poolishom',
  en: 'Final mix with Biga and Poolish',
  de: 'Endteig mit Biga und Poolish',
  sl: 'Končno mešanje z Bigo in Poolishem',
};
for (const lang of kamadoLanguages) {
  const steps = buildProKamadoPlannerSteps(
    branchFinalMixAt,
    'biga',
    'neapolitan',
    { phases: [{ kind: 'preferment', environment: 'room', hours: 8, temperature: 22 }, { kind: 'final', environment: 'fridge', hours: 24, temperature: 4 }, { kind: 'final-rest', environment: 'room', hours: 2, temperature: 22 }], prefermentHours: 8, prefermentRoomHours: 8, prefermentFridgeHours: 0 },
    lang,
    60,
    null,
    getProNapolitanaInitialIntervals('biga', true, 22),
    true,
    getProKamadoBigaMixDurationMinutes('hand'),
  );
  assert.equal(steps.find((step) => step.phaseId === 'biga.finalMix').title, localizedCombinedTitles[lang], `${lang}: combined final-mix title names both preferments`);
  assert.ok(steps.find((step) => step.phaseId === 'biga.finalMix').desc.includes(lang === 'hr' ? 'Bigom i Poolishom' : lang === 'en' ? 'Biga and Poolish' : lang === 'de' ? 'Biga und Poolish' : 'Bigo in Poolishem'), `${lang}: combined final-mix description names both preferments`);
}

const spongeSource = readFileSync(resolve(frontendRoot, 'src/i18n/spongeSteps.ts'), 'utf8');
assert.doesNotMatch(spongeSource, /final.mix.{0,120}\d+\s*(?:min|minute)/i, 'Sponge preparation defines no final-mix duration');
for (const mixing of ['hand', 'home', 'spiral']) {
  for (const finalRestHours of [2, 4]) {
    const spongeSteps = buildProKamadoPlannerSteps(
      branchFinalMixAt,
      'sponge',
      'neapolitan',
      {
        phases: [
          { kind: 'preferment', environment: 'room', hours: 8, temperature: 22 },
          { kind: 'final', environment: 'fridge', hours: 24, temperature: 4 },
          { kind: 'final-rest', environment: 'room', hours: finalRestHours, temperature: 22 },
        ],
        prefermentHours: 8,
        prefermentRoomHours: 8,
        prefermentFridgeHours: 0,
      },
      'en',
      60,
      null,
      getProNapolitanaInitialIntervals('sponge', false, 22),
    );
    const spongeStepById = new Map(spongeSteps.map((step) => [step.phaseId, step]));
    assert.equal(
      spongeStepById.get('sponge.finalMix').at.getTime(),
      spongeStepById.get('pro.initial.mix-rest').at.getTime(),
      `${mixing}/${finalRestHours} h: no undocumented Sponge mix duration is invented`,
    );
    assert.equal(spongeStepById.get('sponge.fridge').at.getTime(), branchFinalMixAt.getTime() - (finalRestHours + 24) * 3600000);
  }
}
for (const style of kamadoStyles) {
  for (const lang of kamadoLanguages) {
    const guidance = getProKamadoGuidance(lang, style);
    assert.ok(guidance.preheat.length > 0 && guidance.bake.length > 0, `${lang}/${style}: localized guidance exists`);
    assert.doesNotMatch(guidance.bake, /\d+\s*(?:-|to)\s*\d+/i, `${lang}/${style}: no fixed bake-time range`);
  }
}

const standardStyles = ['neapolitan', 'romanaTonda', 'romanaTeglia', 'ny_style'];
for (const style of standardStyles) {
  for (const mixing of ['hand', 'home', 'spiral']) {
    for (const [method, isCombined] of kamadoMatrix) {
      const mixDuration = method === 'direct'
        ? 0
        : method === 'biga'
          ? getProKamadoBigaMixDurationMinutes(mixing)
          : getPoolishFinalMixDurationMinutes(mixing);
      const intervals = getProNapolitanaInitialIntervals(method, isCombined, 22);
      const initialSeconds = intervals.reduce((total, interval) => total + interval.seconds, 0);
      for (const finalRestHours of [2, 4]) {
        const bakeTarget = new Date('2030-01-02T19:00:00.000Z');
        const window = getProNapolitanaPlannerWindow(bakeTarget, finalRestHours, 24, intervals);
        const finalMixStart = new Date(window.finalMixAt.getTime() - mixDuration * 60000);
        const initialSequenceAt = new Date(finalMixStart.getTime() + mixDuration * 60000);
        const events = buildProNapolitanaInitialPlannerEvents(method, isCombined, initialSequenceAt, intervals);
        const balling = events.find((event) => event.kind === 'balling');
        assert.ok(balling, `${style}/${mixing}/${method}: initial schedule includes its terminal shaping event`);
        assert.equal(balling.at.getTime() + (balling.seconds ?? 0) * 1000, window.fridgeStartAt.getTime(), `${style}/${mixing}/${method}/${finalRestHours} h: shaping and any ball rest end at refrigeration`);
        assert.equal(events[0].at.getTime() - finalMixStart.getTime(), mixDuration * 60000, `${style}/${mixing}/${method}: sourced mixing duration precedes the first rest`);
        assert.equal(window.fridgeEndAt.getTime() - window.fridgeStartAt.getTime(), 24 * 3600000, `${style}/${mixing}/${method}: fridge remains 24 h`);
        assert.equal(bakeTarget.getTime() - window.fridgeEndAt.getTime(), finalRestHours * 3600000, `${style}/${mixing}/${method}: final room rest is exact`);
        assert.equal(initialSeconds, getProNapolitanaInitialIntervals(method, isCombined, 22).reduce((total, interval) => total + interval.seconds, 0), `${style}/${mixing}/${method}: initial durations do not depend on final-rest setting`);
        if (method === 'sponge') {
          const spongeSteps = alignProNapolitanaSpongePlannerSteps([
            { phaseId: 'sponge.preparation', at: window.fridgeStartAt },
            { phaseId: 'sponge.finalMix', at: window.fridgeStartAt },
            { phaseId: 'sponge.balling', at: window.fridgeEndAt },
          ], window, 8, mixDuration);
          const preparation = spongeSteps.find((step) => step.phaseId === 'sponge.preparation');
          const finalMix = spongeSteps.find((step) => step.phaseId === 'sponge.finalMix');
          assert.equal(preparation.at.getTime() + 8 * 3600000, finalMix.at.getTime(), `${style}/${mixing}/${finalRestHours} h: Sponge preferment ends before final mix`);
          assert.equal(finalMix.at.getTime() + mixDuration * 60000, events[0].at.getTime(), `${style}/${mixing}: Sponge mix duration ends before initial rest`);
          assert.ok(finalMix.at.getTime() < window.fridgeStartAt.getTime(), `${style}/${mixing}: Sponge final mix starts before refrigeration`);
        }
      }
    }
  }
}

for (const finalRestHours of [2, 4]) {
  const bakeTarget = new Date('2030-01-02T19:00:00.000Z');
  const fridgeRemovalAt = new Date(bakeTarget.getTime() - finalRestHours * 3600000);
  const events = buildProTegliaSpongePlannerEvents(fridgeRemovalAt, bakeTarget, finalRestHours, 'en');
  const byId = new Map(events.map((event) => [event.phaseId, event]));
  const plan = getTegliaFinalProofPlan(finalRestHours * 60);
  assert.deepEqual(events.map((event) => event.phaseId), [
    'teglia.sponge.prepare',
    'teglia.sponge.press-rest',
    'teglia.sponge.final-proof',
  ], `${finalRestHours} h: Teglia Sponge uses mass/tray phases, never dough balls`);
  assert.equal(byId.get('teglia.sponge.press-rest').at.getTime() - byId.get('teglia.sponge.prepare').at.getTime(), (plan.pressRelaxationMinutes - 5) * 60000, `${finalRestHours} h: tray preparation fits the existing relaxation window`);
  assert.equal(byId.get('teglia.sponge.final-proof').at.getTime() - byId.get('teglia.sponge.press-rest').at.getTime(), 5 * 60000, `${finalRestHours} h: pressing relaxation is exactly five minutes`);
  assert.equal(byId.get('teglia.sponge.final-proof').at.getTime() + plan.proofMinutes * 60000, bakeTarget.getTime(), `${finalRestHours} h: existing proof duration ends at bake time`);
  assert.ok(events.every((event) => !/dough balls|balling/i.test(`${event.title} ${event.desc}`)), `${finalRestHours} h: no ball-shaped dough instruction is emitted`);
}

assert.match(plannerSource, /plannerOvenType !== 'kamado'[\s\S]*?fridgeHours > 0/, 'standard chronology covers every style and leaves Kamado separate');
assert.match(plannerSource, /getProNapolitanaPlannerWindow\([\s\S]*?proFinalRoomHours/, 'style-specific final-room duration anchors the schedule window');
assert.match(plannerSource, /initialSequenceAt = new Date\(mixAt\.getTime\(\) \+ finalMixDurationMinutes \* 60000\)/, 'all existing final-mix durations precede initial rest events');
assert.match(plannerSource, /buildProTegliaSpongePlannerEvents/, 'standard Teglia Sponge uses mass-based Planner events');
const kamadoPlannerSource = readFileSync(resolve(frontendRoot, 'src/proKamadoPlanner.ts'), 'utf8');
assert.doesNotMatch(kamadoPlannerSource, /formatBakingTimeRange/);
assert.match(plannerSource, /isProKamadoPlan\s*\?\s*buildProKamadoPlannerSteps[\s\S]*?:\s*reversePlan/);
assert.match(plannerSource, /buildProKamadoPrefermentBranchSteps\([\s\S]*?phaseId as 'biga' \| 'poolish'/);
assert.match(plannerSource, /method === 'sponge' && proNapolitanaWindow && !isProKamadoPlan/);
assert.match(plannerSource, /if \(isProKamadoPlan\) return shiftedSteps/);
assert.match(plannerSource, /activeMixing,[\s\S]*?plannerOvenType,[\s\S]*?bakeAt\.getTime\(\)/);
console.log('PRO Kamado Planner routes, target bake times, localized style guidance, and no-duration copy: verified');