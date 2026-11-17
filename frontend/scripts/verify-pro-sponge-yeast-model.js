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

assert.equal(calculator.SPONGE_YEAST_REFERENCE.freshYeastPctOfTotalFlour, 2.2);
assert.equal(calculator.SPONGE_YEAST_REFERENCE.fermentationTempC, 27);
assert.equal(calculator.SPONGE_YEAST_REFERENCE.fermentationHours, 4.5);
assert.ok(Math.abs(calculator.calculateSpongeAutomaticYeastGrams(1000, 27, 4.5, 'fresh') - 22) < 1e-12);
assert.ok(Math.abs(calculator.calculateSpongeAutomaticYeastGrams(1000, 27, 4.5, 'activeDry') - 8.8) < 1e-12);
assert.ok(Math.abs(calculator.calculateSpongeAutomaticYeastGrams(1000, 27, 4.5, 'dry') - 7.333333333333333) < 1e-12);
assert.ok(Math.abs(calculator.calculateSpongeAutomaticYeastGrams(1000, 22, 9, 'fresh') - 15.556349186104047) < 1e-12);
assert.ok(Math.abs(calculator.calculateSpongeAutomaticYeastGrams(1000, 35, 0.5, 'fresh') - 113.72113714470645) < 1e-10);
assert.ok(Math.abs(calculator.calculateSpongeAutomaticYeastGrams(1000, 4, 24, 'fresh') - 20.313882820191115) < 1e-12);
assert.throws(() => calculator.calculateSpongeAutomaticYeastGrams(1000, 36, 4.5, 'fresh'), /finite and positive/);
assert.throws(() => calculator.calculateSpongeAutomaticYeastGrams(1000, 27, 49, 'fresh'), /finite and positive/);

const schedule = calculator.getSpongeFermentationSchedule(4.5, 27, 2, 22, 24, 4, 2);
assert.equal(JSON.stringify(schedule.phases.map(({ kind, hours, temperature }) => ({ kind, hours, temperature }))), JSON.stringify([
  { kind: 'preferment', hours: 4.5, temperature: 27 },
  { kind: 'final', hours: 2, temperature: 22 },
  { kind: 'final', hours: 24, temperature: 4 },
  { kind: 'final-rest', hours: 2, temperature: 22 },
]));
assert.throws(() => calculator.getSpongeFermentationSchedule(0, 27, 2, 22, 24, 4), /Sponge fermentation schedule/);

const commonOptions = {
  pizzas: 4,
  ballWeight: 250,
  hydration: 65,
  saltPct: 2.9,
  oilPct: 2,
  method: 'sponge',
  spongeFlourPct: 70,
  spongeHydrationPct: 62,
  spongeFermentationTempC: 27,
  spongeFermentationHours: 4.5,
  spongeYeastMode: 'automatic',
  spongeYeastType: 'fresh',
  roomHours: 2,
  roomTemp: 22,
  fridgeHours: 24,
  fridgeTemp: 4,
  flourType: 'caputo00',
};
const automatic = calculator.doughCalc(commonOptions);
assert.equal(automatic.total.yeast, 13.02);
assert.equal(automatic.preferment.yeast, 12.78);
assert.equal(automatic.main.yeast, 0.24);
assert.equal(automatic.preferment.flour, 407);
assert.equal(automatic.main.flour + automatic.preferment.flour, automatic.total.flour);
assert.equal(automatic.preferment.yeast + automatic.main.yeast, automatic.total.yeast);
assert.ok(Math.abs(automatic.total.flour + automatic.total.water + automatic.total.salt
  + automatic.total.oil + automatic.total.yeast - automatic.totalDough) < 2);

const activeDry = calculator.doughCalc({ ...commonOptions, spongeYeastType: 'activeDry' });
const instantDry = calculator.doughCalc({ ...commonOptions, spongeYeastType: 'dry' });
assert.equal(activeDry.preferment.yeast, 5.15);
assert.equal(instantDry.preferment.yeast, 4.3);
const manual = calculator.doughCalc({
  ...commonOptions,
  spongeYeastMode: 'manual',
  spongeManualYeastGrams: 1.25,
});
assert.equal(manual.preferment.yeast, 1.25);
assert.equal(manual.total.yeast, 1.49);
assert.throws(() => calculator.doughCalc({
  ...commonOptions,
  spongeYeastMode: 'manual',
  spongeManualYeastGrams: 0,
}), /finite positive quantity/);

console.log('PRO Sponge yeast model golden values and recipe integration passed.');