import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { registerHooks } from 'node:module';
import { doughCalc, getTegliaFinalProofPlan, reversePlan } from '../src/calculator.ts';

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === './spiralMixing' && context.parentURL?.endsWith('/src/i18n/prefermentSteps.ts')) {
      return nextResolve('./spiralMixing.ts', context);
    }
    return nextResolve(specifier, context);
  },
});

const { getYeastAwarePrefermentSteps } = await import('../src/i18n/prefermentSteps.ts');

const proofCases = [
  [74, { totalMinutes: 0, pressRelaxationMinutes: 0, proofMinutes: 0 }],
  [75, { totalMinutes: 75, pressRelaxationMinutes: 15, proofMinutes: 60 }],
  [90, { totalMinutes: 90, pressRelaxationMinutes: 15, proofMinutes: 75 }],
  [180, { totalMinutes: 135, pressRelaxationMinutes: 15, proofMinutes: 120 }],
];
for (const [availableMinutes, expected] of proofCases) {
  assert.deepEqual(getTegliaFinalProofPlan(availableMinutes), expected);
}
assert.deepEqual(getTegliaFinalProofPlan(Number.NaN), {
  totalMinutes: 0,
  pressRelaxationMinutes: 0,
  proofMinutes: 0,
});

const ingredients = doughCalc({
  pizzas: 4,
  ballWeight: 480,
  hydration: 70,
  saltPct: 2.8,
  oilPct: 2,
  method: 'direct',
  roomHours: 3,
  roomTemp: 22,
  fridgeHours: 0,
  fridgeTemp: 4,
});
assert.equal(ingredients.totalDough, 1920, '4 trays × 480 g must produce 1,920 g total');

const bakeAt = new Date('2026-04-20T18:00:00.000Z');
const tegliaSettings = {
  romanFormat: 'teglia',
  trayCount: 4,
  doughPerTray: 480,
  trayWidth: 30,
  trayLength: 40,
};
const directHomeTegliaCopy = {
  start: 'Mix dough.',
  ballingFridge: 'Refrigerate dough.',
  roomOnlyBalling: 'Keep the dough as one mass; use the final {PROOF_WINDOW} for tray preparation and proof.',
  roomOnlyTitle: 'Rest the dough mass',
  bulkAsMass: 'Let the covered dough mass ferment for {HOURS} at room temperature.',
  temperingAsMass: 'Take the covered dough mass out of the refrigerator {TEMPERING} before baking.',
  finalRoom: 'Rest the dough.',
  finalRoomTitle: 'Take the dough mass out of the refrigerator',
  coldMassTitle: 'Cold fermentation of the dough mass',
  preheat: 'Preheat.',
  shapingTitle: 'Top',
  shaping: 'Top and bake.',
  trayPrepareTitle: 'Divide and press into trays',
  trayPrepare: 'Divide {TOTAL_DOUGH} into {TRAY_COUNT} portions of {DOUGH_PER_TRAY}, one per {TRAY_DIMENSIONS} tray.',
  finalProofTitle: 'Final rise in trays',
  finalProof: 'Rise for {PROOF_MINUTES} within the existing final rest.',
  proofUnavailable: 'Move the bake time to allow tray preparation and at least 60 minutes of final rise.',
  bake: 'Bake.',
};
const copy = {
  yeastHandling: { fresh: '', dry: '' },
  ovenTitle: 'Preheat',
  ovenDesc: 'Preheat oven.',
  ovenRomanDesc: 'Preheat oven.',
  ovenNyDesc: 'Preheat oven.',
  warmTitle: 'Warm',
  warmDesc: 'Warm.',
  coldTitle: 'Cold',
  coldDesc: 'Cold.',
  bulkTitle: 'Bulk',
  bulkDesc: 'Bulk.',
  directMixTitle: 'Direct mix',
  directRomanDesc: 'Mix.',
  directNyDesc: 'Mix.',
  directNyBakeDesc: 'Bake.',
  finalBulkTitle: 'Final bulk',
  finalBulkDesc: 'Bulk.',
  finalMixTitle: 'Final mix {PREFERMENT}',
  bigaName: 'Biga',
  poolishName: 'Poolish',
  finalBigaDesc: 'Mix Biga.',
  finalPoolishDesc: 'Mix Poolish.',
  bigaTitle: 'Start Biga',
  bigaDesc: 'Build Biga.',
  poolishTitle: 'Start Poolish',
  poolishDesc: 'Build Poolish.',
  ballsTitle: 'Shape balls',
  ballsDesc: 'Shape dough balls.',
  refreshTitle: 'Refresh',
  refreshDesc: 'Refresh.',
  bigaMixTitle: 'Mix Biga',
  bigaMixDesc: 'Mix Biga.',
  poolishMixTitle: 'Mix Poolish',
  poolishMixDesc: 'Mix Poolish.',
  directTitle: 'Direct dough',
  directDesc: 'Mix dough.',
  directHomeTegliaCopy,
};

for (const method of ['direct', 'biga', 'poolish']) {
  const selectedFermentationSchedule = {
    phases: [{ kind: 'final-rest', environment: 'room', hours: 3, temperature: 22 }],
  };
  const schedule = {
    bakeAt,
    preheatAt: new Date(bakeAt.getTime() - 60 * 60_000),
    finalBallRestHours: 3,
    ...(method === 'biga'
      ? {
        bigaStartAt: new Date(bakeAt.getTime() - 30 * 60 * 60_000),
        bigaRoomHours: 8,
        bigaFridgeHours: 16,
        finalMixAt: new Date(bakeAt.getTime() - 4 * 60 * 60_000),
        finalDoughRoomHours: 1,
        finalDoughFridgeHours: 0,
        ballingAt: new Date(bakeAt.getTime() - 3 * 60 * 60_000),
      }
      : method === 'poolish'
        ? {
          poolishStartAt: new Date(bakeAt.getTime() - 24 * 60 * 60_000),
          poolishRoomHours: 1,
          poolishFridgeHours: 20,
          finalMixAt: new Date(bakeAt.getTime() - 4 * 60 * 60_000),
          finalDoughRoomHours: 1,
          finalDoughFridgeHours: 0,
          ballingAt: new Date(bakeAt.getTime() - 3 * 60 * 60_000),
        }
        : {}),
  };
  const result = reversePlan(
    bakeAt,
    method,
    'romana',
    copy,
    method === 'direct' ? null : undefined,
    method === 'biga' ? schedule : null,
    method === 'poolish' ? schedule : null,
    'en',
    undefined,
    22,
    method === 'direct' ? selectedFermentationSchedule : undefined,
    tegliaSettings,
  );
  const trayPrep = result.find((step) => step.title === 'Divide and press into trays');
  const finalProof = result.find((step) => step.title === 'Final rise in trays');
  assert.ok(trayPrep, `${method}: tray preparation should be present`);
  assert.ok(finalProof, `${method}: exactly one final-rise step should be present`);
  assert.match(trayPrep.desc, /1920 g into 4 portions of 480 g, one per 30 × 40 cm tray/);
  assert.equal(result.filter((step) => step.title === 'Final rise in trays').length, 1);
  assert.equal(finalProof.at.getTime() - trayPrep.at.getTime(), 15 * 60_000);
  assert.doesNotMatch(result.find((step) => /Rest the dough mass/.test(step.title))?.desc ?? '', /balls/i);
}

for (const method of ['direct', 'biga', 'poolish']) {
  const selectedFermentationSchedule = {
    phases: [
      { kind: 'final', environment: 'fridge', hours: 24, temperature: 4 },
      { kind: 'final', environment: 'room', hours: 2, temperature: 22 },
      { kind: 'final-rest', environment: 'room', hours: 2, temperature: 22 },
      ...(method === 'direct' ? [] : [{ kind: 'preferment', environment: 'room', hours: 8, temperature: 22 }]),
    ],
  };
  const result = reversePlan(
    bakeAt,
    method,
    'romana',
    copy,
    null,
    null,
    null,
    'en',
    undefined,
    22,
    selectedFermentationSchedule,
    tegliaSettings,
  );
  const trayPrep = result.find((step) => step.title === 'Divide and press into trays');
  const finalProof = result.find((step) => step.title === 'Final rise in trays');
  assert.ok(trayPrep, `${method}: Pro Planner tray preparation should be present`);
  assert.ok(finalProof, `${method}: Pro Planner final rise should be present`);
  assert.equal(result.filter((step) => step.title === 'Final rise in trays').length, 1);
  assert.match(trayPrep.desc, /1920 g into 4 portions of 480 g, one per 30 × 40 cm tray/);
  assert.equal(finalProof.at.getTime() - trayPrep.at.getTime(), 15 * 60_000);
  assert.equal(bakeAt.getTime() - finalProof.at.getTime(), 105 * 60_000);
  assert.ok(result.every((step) => !/\b(?:balls|kugeln|kuglice|kroglice)\b/i.test(`${step.title} ${step.desc}`)),
    `${method}: Pro Teglia Planner must not instruct shaping dough balls`);
  assert.match(result.find((step) => /bulk/i.test(step.title))?.desc ?? '', /covered dough mass/);
}

const insufficientTimePlan = reversePlan(
  bakeAt,
  'direct',
  'romana',
  copy,
  null,
  null,
  null,
  'en',
  undefined,
  22,
  { phases: [{ kind: 'final-rest', environment: 'room', hours: 38 / 60, temperature: 22 }] },
  tegliaSettings,
);
assert.ok(insufficientTimePlan.some((step) => step.title === 'Final rise in trays' && /Move the bake time/.test(step.desc)));

for (const lang of ['hr', 'en', 'de', 'sl']) {
  for (const method of ['biga', 'poolish']) {
    for (const mixing of ['hand', 'mixer']) {
      const teglia = getYeastAwarePrefermentSteps(lang, method, mixing, 'fresh', true);
      assert.match(teglia.p3.title, /(?:Faza C|Phase C)/);
      assert.match(teglia.p3.steps[0], /one mass|eine Masse|jednu masu|eno maso/i);
      assert.match(teglia.p3.steps[2], /60–120/);
      assert.doesNotMatch(teglia.p3.steps.join(' '), /260\s*[–-]\s*(?:280|300)\s*g/i);

      const round = getYeastAwarePrefermentSteps(lang, method, mixing, 'fresh');
      assert.match(round.p3.steps.join(' '), /260–300|260–280|260–300/);
    }
  }
}

const translations = await readFile(new URL('../src/i18n/translations.ts', import.meta.url), 'utf8');
for (const languageMarker of ['trayPrepareTitle:', 'finalProofTitle:', 'finalProof:', 'proofUnavailable:']) {
  assert.equal((translations.match(new RegExp(languageMarker.replace(':', ''), 'g')) ?? []).length >= 4, true);
}
for (const languageMarker of ['bulkAsMass:', 'temperingAsMass:']) {
  assert.equal((translations.match(new RegExp(languageMarker.replace(':', ''), 'g')) ?? []).length, 4);
}

const screen = await readFile(new URL('../app/(tabs)/index.tsx', import.meta.url), 'utf8');
assert.match(screen, /getYeastAwarePrefermentSteps\(lang, 'biga', mixingForExperience, preferredYeastType, isRomanTeglia, dough\.main\.oil > 0\)/);
assert.match(screen, /getYeastAwarePrefermentSteps\(lang, 'poolish', mixingForExperience, preferredYeastType, isRomanTeglia, dough\.main\.oil > 0\)/);
assert.match(screen, /Divide the total \$\{totalDoughLabel\} of dough into \$\{trayCount\} portions of \$\{doughPerTrayLabel\} each/);

console.log('Teglia workflow checks passed: per-tray mass, Direct/Biga/Poolish planner phases, time window and HR/EN/DE/SL hand/mixer steps.');
