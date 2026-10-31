import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  getFermentationSchedule,
  getPlannerRoomAfterFridgeHours,
  getTegliaFinalProofPlan,
  getTegliaFinalProofWindowMinutes,
  reversePlan,
} from '../src/calculator.ts';

function makeSchedule(method, { roomHours, fridgeHours, roomAfterFridgeHours }) {
  return getFermentationSchedule({
    method,
    prefermentHours: method === 'biga' ? 18 : method === 'poolish' ? 16 : 0,
    roomHours,
    roomTemp: 22,
    fridgeHours,
    fridgeTemp: 4,
    roomAfterFridgeHours,
  });
}

const plannerCopy = {
  yeastHandling: { fresh: '', dry: '' },
  ovenTitle: 'Preheat',
  ovenDesc: 'Preheat',
  ovenRomanDesc: 'Preheat',
  ovenNyDesc: 'Preheat',
  warmTitle: 'Temper dough',
  warmDesc: 'Temper for {TEMPERING}',
  coldTitle: 'Cold fermentation',
  coldDesc: 'Cold ferment for {HOURS}',
  bulkTitle: 'Bulk fermentation',
  bulkDesc: 'Bulk ferment for {HOURS}',
  directMixTitle: 'Mix dough',
  directRomanDesc: 'Mix the dough',
  directNyDesc: 'Mix the dough',
  directNyBakeDesc: 'Bake',
  finalBulkTitle: 'Final bulk',
  finalBulkDesc: 'Final bulk',
  finalMixTitle: 'Final mix {PREFERMENT}',
  bigaName: 'Biga',
  poolishName: 'Poolish',
  finalBigaDesc: 'Final mix',
  finalPoolishDesc: 'Final mix',
  bigaTitle: 'Biga',
  bigaDesc: 'Biga',
  poolishTitle: 'Poolish',
  poolishDesc: 'Poolish',
  ballsTitle: 'Shape',
  ballsDesc: 'Shape',
  refreshTitle: 'Refresh',
  refreshDesc: 'Refresh',
  bigaMixTitle: 'Mix biga',
  bigaMixDesc: 'Mix biga',
  poolishMixTitle: 'Mix poolish',
  poolishMixDesc: 'Mix poolish',
  directTitle: 'Mix dough',
  directDesc: 'Mix the dough',
  directHomeTegliaCopy: {
    start: 'Mix',
    ballingFridge: 'Refrigerate',
    roomOnlyBalling: 'Prepare dough',
    bulkAsMass: 'Bulk for {HOURS}',
    temperingAsMass: 'One {TEMPERING} total window from fridge removal to baking; tray preparation and final proof happen within it.',
    finalRoom: 'Temper for {TEMPERING}',
    preheat: 'Preheat at {OVEN_TEMP}',
    shapingTitle: 'Shape into trays',
    shaping: 'Shape',
    trayPrepareTitle: 'Prepare trays',
    trayPrepare: 'Prepare {TRAY_COUNT} trays, {TRAY_DIMENSIONS}',
    finalProofTitle: 'Final proof',
    finalProof: 'Proof for {PROOF_MINUTES}',
    proofUnavailable: 'Insufficient time for tray preparation and final proof.',
    bake: 'Bake',
  },
};

const bakeAt = new Date('2026-10-15T19:00:00.000Z');
const plannerRoomHours = getPlannerRoomAfterFridgeHours('direct', 'romana', 'teglia', 2, 24, 22);
assert.equal(plannerRoomHours, 2, 'Direct Romana Teglia must preserve the selected two-hour final room phase');
assert.equal(
  getPlannerRoomAfterFridgeHours('direct', 'romana', 'tonda', 2, 24, 22),
  38 / 60,
  'Romana Tonda must retain the existing generic tempering window',
);
assert.equal(
  getPlannerRoomAfterFridgeHours('biga', 'romana', 'teglia', 2, 24, 22),
  38 / 60,
  'Biga must retain the existing generic tempering window',
);

const plannerSchedule = makeSchedule('direct', {
  roomHours: 2,
  fridgeHours: 24,
  roomAfterFridgeHours: plannerRoomHours,
});
const plannerSteps = reversePlan(
  bakeAt,
  'direct',
  'romana',
  plannerCopy,
  null,
  null,
  null,
  'en',
  undefined,
  22,
  plannerSchedule,
  { romanFormat: 'teglia', trayCount: 4, doughPerTray: 480, trayWidth: 30, trayLength: 40 },
  'homePan',
  250,
  20,
);
const plannerStep = (title) => plannerSteps.find((step) => step.title === title);
assert.equal(plannerStep('Cold fermentation')?.at.toISOString(), '2026-10-14T17:00:00.000Z');
assert.equal(plannerStep('Temper dough')?.at.toISOString(), '2026-10-15T17:00:00.000Z');
assert.match(plannerStep('Temper dough')?.desc ?? '', /2 hours total window.*tray preparation and final proof happen within it/);
assert.equal(plannerStep('Prepare trays')?.at.toISOString(), '2026-10-15T17:00:00.000Z');
assert.equal(plannerStep('Final proof')?.at.toISOString(), '2026-10-15T17:15:00.000Z');
assert.match(plannerStep('Final proof')?.desc ?? '', /1 hour 45 minutes/);
assert.equal(plannerStep('Preheat')?.at.toISOString(), '2026-10-15T18:40:00.000Z');

const shortWindowSteps = reversePlan(
  bakeAt,
  'direct',
  'romana',
  plannerCopy,
  null,
  null,
  null,
  'en',
  undefined,
  22,
  makeSchedule('direct', {
    roomHours: 2,
    fridgeHours: 24,
    roomAfterFridgeHours: 38 / 60,
  }),
  { romanFormat: 'teglia', trayCount: 4, doughPerTray: 480, trayWidth: 30, trayLength: 40 },
  'homePan',
  250,
  20,
);
const shortWindowWarning = shortWindowSteps.find((step) => step.phaseId === 'teglia.finalProof');
assert.equal(shortWindowWarning?.at.toISOString(), '2026-10-15T18:22:00.000Z');
assert.match(shortWindowWarning?.desc ?? '', /Insufficient time/);
assert.ok(shortWindowWarning.at < shortWindowSteps.find((step) => step.title === 'Preheat').at);

for (const method of ['direct', 'biga', 'poolish']) {
  const roomOnly = makeSchedule(method, {
    roomHours: 2,
    fridgeHours: 0,
    roomAfterFridgeHours: 0,
  });
  const roomOnlyWindow = getTegliaFinalProofWindowMinutes(roomOnly);
  assert.equal(roomOnlyWindow, 120, `${method}: proof window must use the selected room-only schedule`);
  assert.deepEqual(getTegliaFinalProofPlan(roomOnlyWindow), {
    totalMinutes: 120,
    pressRelaxationMinutes: 15,
    proofMinutes: 105,
  });

  const cold = makeSchedule(method, {
    roomHours: 2,
    fridgeHours: 24,
    roomAfterFridgeHours: 2,
  });
  const coldWindow = getTegliaFinalProofWindowMinutes(cold);
  assert.equal(coldWindow, 120, `${method}: use the post-fridge room window without adding initial room time`);
  assert.equal(getTegliaFinalProofPlan(coldWindow).pressRelaxationMinutes
    + getTegliaFinalProofPlan(coldWindow).proofMinutes, coldWindow);

  const coldWithoutFinalRoom = makeSchedule(method, {
    roomHours: 2,
    fridgeHours: 24,
    roomAfterFridgeHours: 0,
  });
  assert.equal(
    getTegliaFinalProofWindowMinutes(coldWithoutFinalRoom),
    0,
    `${method}: do not reuse initial room time when the final dough also has cold fermentation`,
  );
}

for (const hours of [0.25, 1, 2, 3]) {
  const schedule = makeSchedule('direct', {
    roomHours: hours,
    fridgeHours: 0,
    roomAfterFridgeHours: 0,
  });
  const windowMinutes = getTegliaFinalProofWindowMinutes(schedule);
  const plan = getTegliaFinalProofPlan(windowMinutes);
  assert.ok(plan.totalMinutes <= windowMinutes, `${hours} h: proof plan must fit the selected room window`);
  assert.equal(plan.pressRelaxationMinutes + plan.proofMinutes, plan.totalMinutes);
  if (hours < 1.25) assert.equal(plan.totalMinutes, 0, `${hours} h: insufficient time must not create a timer`);
}

const screen = await readFile(new URL('../app/(tabs)/index.tsx', import.meta.url), 'utf8');
const plannerScreen = await readFile(new URL('../app/(tabs)/planner.tsx', import.meta.url), 'utf8');
const translations = await readFile(new URL('../src/i18n/translations.ts', import.meta.url), 'utf8');
assert.match(screen, /getTegliaFinalProofWindowMinutes\(proFermentationSchedule\)/);
assert.match(screen, /if \(isBeginner \|\| !isRomanTeglia\) return steps;/);
assert.match(screen, /const proPhaseESteps = !isBeginner && detailedDirectSteps/);
assert.equal(
  [...screen.matchAll(/steps=\{isRomanTeglia \? proTegliaPrefermentP3Steps\(path\.p3\.steps\)/g)].length,
  2,
  'only the Biga and Poolish P3 paths should use the adapter',
);
assert.match(screen, /timers=\{isRomanTeglia \|\| bigaHomeSchedule \? \[\] : undefined\}/);
assert.match(screen, /timers=\{isRomanTeglia \|\| poolishHomeSchedule \? \[\] : undefined\}/);
assert.match(
  plannerScreen,
  /const plannerStepCopy = isBeginner[\s\S]*directHomeTegliaCopy: \{[\s\S]*temperingAsMass: t\.planner\.proTegliaTiming\.temperingAsMass,[\s\S]*finalRoom: t\.planner\.proTegliaTiming\.finalRoom/,
  'PRO uses PRO Teglia timing copy while Beginner keeps its original translation object',
);
for (const text of [
  'this rest is already included in the schedule',
  'diese Ruhezeit ist bereits im Zeitplan enthalten',
  'taj je odmor već uključen u raspored',
  'ta počitek je že vključen v načrt',
  'rather than adding a separate rest',
  'statt eine zusätzliche Ruhezeit einzuplanen',
  'umjesto da dodajete zaseban odmor',
  'namesto da dodate ločen počitek',
]) {
  assert.ok(screen.includes(text), `localized F09 copy must include: ${text}`);
}
for (const text of [
  'Od vađenja do pečenja imate ukupno ${temperingDuration}',
  'The total window from removal to baking is ${temperingDuration}',
  'Das gesamte Zeitfenster vom Herausnehmen bis zum Backen beträgt ${temperingDuration}',
  'Skupno časovno okno od odvzema do peke je ${temperingDuration}',
  'jedini završni prozor od vađenja do pečenja',
  'single final window from fridge removal to baking',
  'einzige Zeitfenster vom Herausnehmen bis zum Backen',
  'edino končno časovno okno od odvzema do peke',
]) {
  assert.ok(screen.includes(text) || translations.includes(text), `localized F09 timing copy must include: ${text}`);
}

console.log('PRO Teglia final-proof checks passed for actual Direct/Biga/Poolish room-only and cold schedules.');
