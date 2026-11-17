#!/usr/bin/env node

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const vm = require('node:vm');

const sourcePath = path.join(__dirname, '..', 'src', 'calculator.ts');
const compiled = ts.transpileModule(fs.readFileSync(sourcePath, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const moduleRef = { exports: {} };
vm.runInNewContext(compiled, { module: moduleRef, exports: moduleRef.exports });
const calculator = moduleRef.exports;

const exposureCases = [
  { hours: 2, temperature: 22, expected: 2.29739670999407 },
  { hours: 24, temperature: 4, expected: 7.917047464637365 },
  { hours: 4.5, temperature: 27, expected: 7.31027156720612 },
  { hours: 48, temperature: 4, expected: 15.83409492927473 },
];
for (const testCase of exposureCases) {
  assert.ok(Math.abs(
    calculator.calculateDirectFermentationExposure(testCase.hours, testCase.temperature) - testCase.expected,
  ) < 1e-12, `${testCase.hours}h at ${testCase.temperature}C exposure`);
}

const schedule = [
  { kind: 'final', environment: 'room', hours: 2, temperature: 22 },
  { kind: 'final', environment: 'fridge', hours: 24, temperature: 4 },
];
const expectedScheduleExposure = 10.214444174631435;
assert.ok(Math.abs(
  calculator.calculateDirectFermentationScheduleExposure(schedule) - expectedScheduleExposure,
) < 1e-12);
assert.ok(Math.abs(calculator.calculateDirectFreshYeastPct(expectedScheduleExposure) - 0.25134415338962973) < 1e-12);

const commonOptions = {
  pizzas: 4,
  ballWeight: 250,
  hydration: 65,
  saltPct: 2.9,
  oilPct: 2,
  roomHours: 2,
  roomTemp: 22,
  fridgeHours: 24,
  fridgeTemp: 4,
  fermentationSchedule: { phases: schedule },
};
const expectedDirectYeastGrams = {
  fresh: 1.48,
  activeDry: 0.59,
  dry: 0.49,
};
for (const [yeastType, expectedGrams] of Object.entries(expectedDirectYeastGrams)) {
  const result = calculator.doughCalc({ ...commonOptions, method: 'direct', yeastType });
  assert.ok(Math.abs(result.total.yeast - expectedGrams) < 1e-10, `Direct/${yeastType} recipe grams`);
}

const expectedLegacyGrams = {
  biga: { fresh: 0.57, activeDry: 0.23, dry: 0.19 },
  poolish: { fresh: 0.57, activeDry: 0.23, dry: 0.19 },
};
for (const [method, yeastByType] of Object.entries(expectedLegacyGrams)) {
  for (const [yeastType, expectedGrams] of Object.entries(yeastByType)) {
    const result = calculator.doughCalc({ ...commonOptions, method, yeastType });
    assert.ok(Math.abs(result.total.yeast - expectedGrams) < 1e-10, `${method}/${yeastType} recipe grams`);
  }
}

assert.throws(() => calculator.calculateDirectFreshYeastPct(0), /positive fermentation exposure/);
assert.throws(() => calculator.calculateDirectFreshYeastPct(Number.NaN), /positive fermentation exposure/);

console.log('Direct yeast calibration golden values passed across temperatures, durations, yeast types, and methods.');