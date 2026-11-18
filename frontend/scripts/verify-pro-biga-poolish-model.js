#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
function loadModule(relativePath) {
  const source = fs.readFileSync(path.join(here, '..', relativePath), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(compiled, {
    module,
    exports: module.exports,
    require: (specifier) => {
      assert.equal(specifier, './proMethods/bigaPoolish');
      return loadModule('src/proMethods/bigaPoolish.ts');
    },
  }, { filename: relativePath });
  return module.exports;
}

const { calculateBigaPoolishIngredients } = loadModule('src/proMethods/bigaPoolish.ts');
const { normalizeComplementaryPrefermentShares } = loadModule('src/proMethods/prefermentWaterAlignment.ts');
assert.deepEqual({ ...normalizeComplementaryPrefermentShares(55, 'biga') }, { bigaPct: 55, poolishPct: 45 });
assert.deepEqual({ ...normalizeComplementaryPrefermentShares(70, 'biga') }, { bigaPct: 70, poolishPct: 30 });
assert.deepEqual({ ...normalizeComplementaryPrefermentShares(70, 'poolish') }, { bigaPct: 30, poolishPct: 70 });
assert.deepEqual({ ...normalizeComplementaryPrefermentShares(68, 'biga') }, { bigaPct: 70, poolishPct: 30 });
const cases = [
  ['BP-A1', 'automatic', 1000, 65, 2.8, 20, 60, undefined, undefined, 45, 100, true, 800, 516],
  ['BP-A2', 'automatic', 1000, 65, 2.8, 30, 50, undefined, undefined, 45, 100, true, 700, 432.5],
  ['BP-A3', 'automatic', 1200, 70, 2.5, 40, 75, undefined, undefined, 50, 100, true, 720, 540],
  ['BP-A4', 'automatic', 900, 60, 2.8, 50, 40, undefined, undefined, 62, 110, true, 450, 131.4],
  ['BP-A5', 'automatic', 1000, 65, 2.8, 80, 25, undefined, undefined, 45, 80, true, 200, 80],
  ['BP-R1', 'manual', 1000, 65, 2.8, undefined, undefined, 2, 2, 45, 100, true, 960, 621],
  ['BP-R2', 'manual', 1000, 65, 2.8, undefined, undefined, 7, 5.25, 50, 80, true, 877.5, 573],
  ['BP-R3', 'manual', 1000, 65, 2.8, undefined, undefined, 21, 15, 45, 120, true, 640, 375.5],
  ['BP-R4', 'manual', 800, 68, 2.5, undefined, undefined, 37.5, 18.75, 55, 90, true, 350, 244],
  ['BP-R5', 'manual', 1500, 72, 3, undefined, undefined, 70, 30, 45, 100, true, 0, 157.5],
];

for (const [id, mode, flour, hydration, salt, preferment, share, bigaPct, poolishPct, bigaHydration, poolishHydration, requirePositive, expectedFinalFlour, expectedFinalWater] of cases) {
  const result = calculateBigaPoolishIngredients({
    totalFlourGrams: flour,
    totalHydrationPct: hydration,
    totalSaltPct: salt,
    allocationMode: mode,
    prefermentFlourPct: preferment,
    bigaShareOfPrefermentPct: share,
    bigaFlourPct: bigaPct,
    poolishFlourPct: poolishPct,
    bigaHydrationPct: bigaHydration,
    poolishHydrationPct: poolishHydration,
    requirePositiveFinalFlour: requirePositive,
  });
  assert.ok(Math.abs(result.final.flourGrams - expectedFinalFlour) < 1e-9, `${id}: final flour`);
  assert.ok(Math.abs(result.final.waterGrams - expectedFinalWater) < 1e-9, `${id}: final water`);
  assert.ok(Math.abs(result.final.saltGrams - flour * salt / 100) < 1e-9, `${id}: final salt`);
  assert.equal(result.mathStatus, 'valid', `${id}: ingredient balance`);
  assert.ok(Math.abs(result.biga.flourGrams + result.poolish.flourGrams + result.final.flourGrams - result.total.flourGrams) < 1e-9, `${id}: flour balance`);
  assert.ok(Math.abs(result.biga.waterGrams + result.poolish.waterGrams + result.final.waterGrams - result.total.waterGrams) < 1e-9, `${id}: water balance`);
}

const zeroFinal = calculateBigaPoolishIngredients({
  totalFlourGrams: 1000,
  totalHydrationPct: 65,
  totalSaltPct: 2.8,
  allocationMode: 'manual',
  bigaFlourPct: 70,
  poolishFlourPct: 30,
  bigaHydrationPct: 45,
  poolishHydrationPct: 100,
  requirePositiveFinalFlour: true,
});
assert.equal(zeroFinal.final.flourGrams, 0);
assert.equal(zeroFinal.mathStatus, 'valid');
assert.equal(zeroFinal.applicationStatus, 'final-flour-required');

assert.throws(() => calculateBigaPoolishIngredients({
  totalFlourGrams: 1000, totalHydrationPct: 65, totalSaltPct: 2.8,
  allocationMode: 'manual', bigaFlourPct: 60, poolishFlourPct: 41,
  bigaHydrationPct: 45, poolishHydrationPct: 100,
}), (error) => error?.name === 'RangeError');

for (const saltPct of [0, 100]) {
  const result = calculateBigaPoolishIngredients({
    totalFlourGrams: 1000, totalHydrationPct: 65, totalSaltPct: saltPct,
    allocationMode: 'manual', bigaFlourPct: 20, poolishFlourPct: 20,
    bigaHydrationPct: 45, poolishHydrationPct: 100,
  });
  assert.equal(result.total.saltGrams, saltPct * 10, `salt boundary ${saltPct}%`);
}
for (const saltPct of [-0.01, 100.01]) {
  assert.throws(() => calculateBigaPoolishIngredients({
    totalFlourGrams: 1000, totalHydrationPct: 65, totalSaltPct: saltPct,
    allocationMode: 'manual', bigaFlourPct: 20, poolishFlourPct: 20,
    bigaHydrationPct: 45, poolishHydrationPct: 100,
  }), (error) => error?.name === 'RangeError', `invalid salt ${saltPct}%`);
}
assert.throws(() => calculateBigaPoolishIngredients({
  totalFlourGrams: 0, totalHydrationPct: 65, totalSaltPct: 2.8,
  allocationMode: 'manual', bigaFlourPct: 20, poolishFlourPct: 20,
  bigaHydrationPct: 45, poolishHydrationPct: 100,
}), (error) => error?.name === 'RangeError');

const negativeWater = calculateBigaPoolishIngredients({
  totalFlourGrams: 1000, totalHydrationPct: 65, totalSaltPct: 2.8,
  allocationMode: 'manual', bigaFlourPct: 50, poolishFlourPct: 50,
  bigaHydrationPct: 100, poolishHydrationPct: 100,
});
assert.equal(negativeWater.mathStatus, 'negative-remainder');
assert.equal(negativeWater.applicationStatus, 'invalid');

const { doughCalc, reversePlan } = loadModule('src/calculator.ts');
const combinedDough = doughCalc({
  pizzas: 1, ballWeight: 1678, hydration: 65, saltPct: 2.8, oilPct: 0,
  method: 'biga', bigaEnabled: true, poolishEnabled: true,
  bigaPct: 30, poolishPct: 20, bigaHydrationPct: 60, poolishHydrationPct: 100,
  roomHours: 4, roomTemp: 22, fridgeHours: 24, fridgeTemp: 4,
  prefermentHours: 16, yeastType: 'fresh', mixing: 'home',
});
assert.equal(combinedDough.preferment, null);
assert.equal(combinedDough.preferments.biga.flour, Math.round(combinedDough.total.flour * 0.3));
assert.equal(combinedDough.preferments.poolish.flour, Math.round(combinedDough.total.flour * 0.2));
assert.equal(combinedDough.preferments.biga.flour + combinedDough.preferments.poolish.flour + combinedDough.main.flour, combinedDough.total.flour);
assert.equal(combinedDough.preferments.biga.water + combinedDough.preferments.poolish.water + combinedDough.main.water, combinedDough.total.water);
assert.equal(combinedDough.preferments.biga.yeast + combinedDough.preferments.poolish.yeast + combinedDough.main.yeast, combinedDough.total.yeast);
const legacyBiga = doughCalc({
  pizzas: 1, ballWeight: 1678, hydration: 65, saltPct: 2.8, oilPct: 0,
  method: 'biga', bigaPct: 30, roomHours: 4, roomTemp: 22, fridgeHours: 24, fridgeTemp: 4,
});
assert.equal(legacyBiga.preferments, undefined, 'legacy Biga result shape remains unchanged');

const plannerCopy = {
  yeastHandling: { fresh: 'Use fresh yeast.', dry: 'Use dry yeast.' },
  ovenTitle: 'Preheat', ovenDesc: 'Preheat.', ovenRomanDesc: 'Preheat Romana.', ovenNyDesc: 'Preheat New York.',
  warmTitle: 'Temper', warmDesc: 'Temper for {TEMPERING}.', coldTitle: 'Cold ferment', coldDesc: 'Cold ferment {HOURS}.',
  bulkTitle: 'Bulk', bulkDesc: 'Bulk {HOURS}.', directMixTitle: 'Direct mix', directTitle: 'Mix dough.', directDesc: 'Mix dough.', directRomanDesc: 'Mix Romana.', directNyDesc: 'Mix New York.',
  finalBulkTitle: 'Final bulk', finalBulkDesc: 'Final bulk {HOURS}.', finalMixTitle: 'Mix {PREFERMENT}',
  bigaName: 'Biga', poolishName: 'Poolish', finalBigaDesc: 'Add Biga.', finalPoolishDesc: 'Add Poolish.',
  bigaTitle: 'Biga fermentation', bigaDesc: 'Biga {HOURS}: {ROOM_HOURS} room, {FRIDGE_HOURS} cold.',
  poolishTitle: 'Poolish fermentation', poolishDesc: 'Poolish {HOURS}: {ROOM_HOURS} room, {FRIDGE_HOURS} cold.',
  ballsTitle: 'Ball dough', ballsDesc: 'Ball {WEIGHT}.', refreshTitle: 'Refresh', refreshDesc: 'Refresh.',
  bigaMixTitle: 'Mix Biga', bigaMixDesc: 'Mix Biga.', poolishMixTitle: 'Mix Poolish', poolishMixDesc: 'Mix Poolish.',
};
const combinedPlan = reversePlan(
  new Date('2026-11-18T18:00:00Z'), 'biga', 'neapolitan', plannerCopy,
  null, null, null, 'en', '250°C', 22,
  { phases: [
    { kind: 'preferment', environment: 'room', hours: 8, temperature: 22 },
    { kind: 'final', environment: 'fridge', hours: 12, temperature: 4 },
    { kind: 'final-rest', environment: 'room', hours: 2, temperature: 22 },
  ] },
  null, null, { biga: 12, poolish: 8 },
  {
    biga: { flour: 300, water: 135, yeast: 0.3 },
    poolish: { flour: 200, water: 200, yeast: 0.2 },
    final: { flour: 500, water: 315, salt: 28, oil: 0, yeast: 0.5 },
  },
);
assert.deepEqual(JSON.parse(JSON.stringify(combinedPlan
  .filter((step) => ['biga.preferment', 'poolish.preferment', 'combined.finalMix'].includes(step.phaseId))
  .map((step) => step.phaseId))), ['biga.preferment', 'poolish.preferment', 'combined.finalMix']);
assert.match(combinedPlan.find((step) => step.phaseId === 'combined.finalMix').desc, /300 g flour/);
assert.match(combinedPlan.find((step) => step.phaseId === 'combined.finalMix').desc, /200 g flour/);

const calculatorScreen = fs.readFileSync(path.join(here, '..', 'app', '(tabs)', 'index.tsx'), 'utf8');
assert.match(calculatorScreen, /bigaEnabled: !isBeginner && flour !== 'glutenFree' && bigaEnabled/);
assert.match(calculatorScreen, /poolishEnabled: !isBeginner && flour !== 'glutenFree' && poolishEnabled/);
assert.match(calculatorScreen, /setBigaEnabled\(restoredBigaEnabled\)/);
assert.match(calculatorScreen, /setPoolishEnabled\(restoredPoolishEnabled\)/);
assert.match(calculatorScreen, /customBallWeight, method, bigaEnabled, poolishEnabled, bigaPct, poolishPct/);
assert.match(calculatorScreen, /phaseKey="combined-biga-preparation"/);
assert.match(calculatorScreen, /phaseKey="combined-poolish-preparation"/);
assert.match(calculatorScreen, /id: 'biga-fermentation'/);
assert.match(calculatorScreen, /id: 'poolish-fermentation'/);
assert.match(calculatorScreen, /phaseKey="combined-final-mix"/);
assert.match(calculatorScreen, /combinedPrefermentPreparation: combinedPrefermentsActive && dough\.preferments/);
const plannerSource = fs.readFileSync(path.join(here, '..', 'app', '(tabs)', 'planner.tsx'), 'utf8');
assert.match(plannerSource, /sharedCalculatorPlanSettings\?\.bigaEnabled && sharedCalculatorPlanSettings\.poolishEnabled/);
assert.match(plannerSource, /combinedPrefermentPreparation/);

console.log('PASS: model boundaries, combined dough balances, legacy compatibility, dual preparation timers, save/restore, and Planner phases.');
