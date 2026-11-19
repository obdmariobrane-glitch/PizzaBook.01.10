#!/usr/bin/env node

const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const ts = require('typescript');
const vm = require('vm');

function loadTypeScriptModule(filePath) {
  const source = fs.readFileSync(filePath, 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const moduleRef = { exports: {} };
  const localRequire = (request) => request === './proMethods/bigaPoolish'
    ? loadTypeScriptModule(path.join(path.dirname(filePath), 'proMethods', 'bigaPoolish.ts'))
    : require(request);
  vm.runInNewContext(compiled, { module: moduleRef, exports: moduleRef.exports, require: localRequire }, { filename: filePath });
  return moduleRef.exports;
}

const moduleRef = { exports: loadTypeScriptModule(path.join(__dirname, '..', 'src', 'calculator.ts')) };

const {
  calculateDirectFermentationExposure,
  calculateDirectFreshYeastPct,
  calculateDirectFermentationScheduleExposure,
  calculateDirectHomeCandidateExposure,
  DIRECT_YEAST_REFERENCE,
  doughCalc,
  getFermentationSchedule,
} = moduleRef.exports;
const shared = {
  pizzas: 2,
  ballWeight: 250,
  hydration: 65,
  saltPct: 2.9,
  oilPct: 2,
  roomHours: 2,
  roomTemp: 22,
  fridgeHours: 24,
  fridgeTemp: 4,
  prefermentHours: 16,
  yeastType: 'fresh',
  mixing: 'home',
  flourType: 'caputo00',
};

for (const method of ['direct', 'biga', 'poolish']) {
  const options = {
    ...shared,
    method,
    ...(method === 'biga' ? { bigaPct: 50 } : {}),
    ...(method === 'poolish' ? { poolishPct: 35 } : {}),
  };
  const firstResult = doughCalc(options);
  const secondResult = doughCalc(options);

  assert.deepEqual(secondResult, firstResult, `${method} result is not stable`);
}

const referenceExposure = 4 * Math.pow(2, 0.2) + 24 * Math.pow(2, -1.8);
assert.ok(Math.abs(DIRECT_YEAST_REFERENCE.E_REF - referenceExposure) < 1e-12);
assert.ok(Math.abs(calculateDirectFreshYeastPct(referenceExposure) - 0.2235) < 1e-9, `reference direct fresh yeast pct should be 0.2235%, got ${calculateDirectFreshYeastPct(referenceExposure)}`);

const referencePhases = [
  { kind: 'final', environment: 'room', hours: 2, temperature: 22 },
  { kind: 'final', environment: 'fridge', hours: 24, temperature: 2 },
  { kind: 'final-rest', environment: 'room', hours: 2, temperature: 22 },
];
const referenceSchedule = { phases: referencePhases, prefermentHours: 0, prefermentRoomHours: 0, prefermentFridgeHours: 0 };
const referenceYeastTypePct = 0.2235;
const targetReferenceFlour = 671;
const targetReferenceDough = targetReferenceFlour * (100 + 65 + 2.9 + 2 + referenceYeastTypePct) / 100;
const directReference = doughCalc({
  pizzas: 1,
  ballWeight: targetReferenceDough,
  hydration: 65,
  saltPct: 2.9,
  oilPct: 2,
  roomHours: 2,
  roomTemp: 22,
  fridgeHours: 24,
  fridgeTemp: 2,
  method: 'direct',
  yeastType: 'fresh',
  fermentationSchedule: referenceSchedule,
});
assert.ok(Math.abs(directReference.preciseYeastPct - 0.2235) < 1e-12, `production reference percentage should be 0.2235%, got ${directReference.preciseYeastPct}`);
assert.ok(Math.abs(directReference.preciseYeastGrams - 1.499685) < 1e-9, `production reference grams should be 1.499685g, got ${directReference.preciseYeastGrams}`);
assert.equal(directReference.yeastPct, 0.22, 'display percentage remains rounded to two decimals');

for (const flour of [500, 1000]) {
  const expectedPct = 0.2235;
  const totalDough = flour * (100 + 65 + 2.9 + 2 + expectedPct) / 100;
  const result = doughCalc({ ...shared, pizzas: 1, ballWeight: totalDough, roomHours: 4, fridgeHours: 24, fridgeTemp: 2, method: 'direct' });
  assert.ok(Math.abs(result.preciseYeastGrams - flour * expectedPct / 100) < 1e-9, `${flour}g flour production grams mismatch`);
}

const scenarios = {
  A: { flour: 300, phases: [{ hours: 3, temp: 22 }, { hours: 18, temp: 4 }, { hours: 2, temp: 22 }], expectedPct: 0.219782541013, expectedGrams: 0.659347623039 },
  B: { flour: 500, phases: [{ hours: 6, temp: 20 }, { hours: 12, temp: 4 }], expectedPct: 0.257803354436, expectedGrams: 1.289016772178 },
  C: { flour: 1000, phases: [{ hours: 4, temp: 24 }, { hours: 20, temp: 3 }, { hours: 2, temp: 22 }], expectedPct: 0.186972012171, expectedGrams: 1.869720121713 },
  D: { flour: 750, phases: [{ hours: 2, temp: 22 }, { hours: 48, temp: 4 }, { hours: 2, temp: 22 }], expectedPct: 0.125672076695, expectedGrams: 0.942540575211 },
  E: { flour: 400, phases: [{ hours: 5, temp: 25 }], expectedPct: 0.363076821171, expectedGrams: 1.452307284685 },
  F: { flour: 1200, phases: [{ hours: 12, temp: 10 }, { hours: 24, temp: 2 }], expectedPct: 0.199139230614, expectedGrams: 2.389670767372 },
  G: { flour: 850, phases: [{ hours: 2, temp: 24 }, { hours: 3, temp: 20 }, { hours: 16, temp: 4 }, { hours: 2, temp: 22 }], expectedPct: 0.194282921740, expectedGrams: 1.651404834791 },
  H: { flour: 600, phases: [{ hours: 3, temp: 26 }], expectedPct: 0.564604421025, expectedGrams: 3.387626526151 },
};

for (const [name, scenario] of Object.entries(scenarios)) {
  const phases = scenario.phases.map((phase) => ({
    kind: 'final',
    environment: phase.temp === 4 || phase.temp === 3 || phase.temp === 2 ? 'fridge' : 'room',
    hours: phase.hours,
    temperature: phase.temp,
  }));
  const freshPct = calculateDirectFreshYeastPct(phases.reduce(
    (total, phase) => total + calculateDirectFermentationExposure(phase.hours, phase.temperature),
    0,
  ));
  const totalDough = scenario.flour * (100 + 65 + 2.9 + 2 + freshPct) / 100;
  const production = doughCalc({
    ...shared,
    pizzas: 1,
    ballWeight: totalDough,
    method: 'direct',
    fermentationSchedule: { phases, prefermentHours: 0, prefermentRoomHours: 0, prefermentFridgeHours: 0 },
  });
  assert.ok(Math.abs(freshPct - scenario.expectedPct) < 1e-9, `${name} pct mismatch: ${freshPct} vs ${scenario.expectedPct}`);
  assert.ok(Math.abs(production.preciseYeastPct - scenario.expectedPct) < 1e-9, `${name} production pct mismatch: ${production.preciseYeastPct}`);
  assert.ok(Math.abs(production.preciseYeastGrams - scenario.expectedGrams) < 1e-9, `${name} production grams mismatch: ${production.preciseYeastGrams}`);
}

const beginnerExposure = calculateDirectHomeCandidateExposure({
  strategy: 'hybrid', roomBeforeFridgeHours: 2, fridgeHours: 24, roomAfterFridgeHours: 2,
  status: 'acceptable', warnings: [],
}, 22, 2);
assert.ok(Math.abs(beginnerExposure.totalExposure - referenceExposure) < 1e-12, 'Beginner Home-plan exposure must use Direct Q10 phases');

const beginnerReferenceSchedule = getFermentationSchedule({ method: 'direct', roomHours: 4, roomTemp: 22, fridgeHours: 24, fridgeTemp: 2 });
for (const yeastType of ['fresh', 'activeDry', 'dry']) {
  const beginner = doughCalc({ ...shared, pizzas: 1, ballWeight: targetReferenceDough, roomHours: 4, fridgeHours: 24, fridgeTemp: 2, yeastType, method: 'direct' });
  const pro = doughCalc({ ...shared, pizzas: 1, ballWeight: targetReferenceDough, roomHours: 2, fridgeHours: 24, fridgeTemp: 2, yeastType, method: 'direct', fermentationSchedule: referenceSchedule });
  assert.equal(beginner.preciseYeastPct, pro.preciseYeastPct, `${yeastType} Beginner and PRO percentage must match exactly`);
  assert.equal(beginner.preciseYeastGrams, pro.preciseYeastGrams, `${yeastType} Beginner and PRO grams must match exactly`);
}

assert.equal(calculateDirectFermentationScheduleExposure(referencePhases), DIRECT_YEAST_REFERENCE.E_REF);

for (const [yeastType, factor] of [['fresh', 1], ['activeDry', 0.4], ['dry', 1 / 3]]) {
  const expectedPct = 0.2235 * factor;
  const flour = 671;
  const totalDough = flour * (100 + 65 + 2.9 + 2 + expectedPct) / 100;
  const result = doughCalc({
    ...shared,
    pizzas: 1,
    ballWeight: totalDough,
    roomHours: 2,
    fridgeHours: 24,
    fridgeTemp: 2,
    roomAfterFridgeHours: 2,
    yeastType,
    method: 'direct',
    fermentationSchedule: referenceSchedule,
  });
  assert.ok(Math.abs(result.preciseYeastPct - expectedPct) < 1e-12, `${yeastType} production conversion percentage mismatch`);
  assert.ok(Math.abs(result.preciseYeastGrams - flour * expectedPct / 100) < 1e-9, `${yeastType} production conversion grams mismatch`);
}

const manualDirect = doughCalc({ ...shared, method: 'direct', yeastMode: 'manual', manualYeastGrams: 1.234 });
assert.equal(manualDirect.total.yeast, 1.23, 'manual Direct yeast retains its existing two-decimal behavior');

for (const method of ['biga', 'poolish']) {
  const result = doughCalc({ ...shared, method, ...(method === 'biga' ? { bigaPct: 50 } : { poolishPct: 35 }) });
  assert.equal(result.preciseYeastPct, undefined, `${method} must not use Direct precision output`);
}

console.log('doughCalc profile compatibility checks passed.');