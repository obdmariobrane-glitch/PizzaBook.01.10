#!/usr/bin/env node

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const vm = require('node:vm');

const frontendRoot = path.resolve(__dirname, '..');
const calculatorSource = fs.readFileSync(path.join(frontendRoot, 'src', 'calculator.ts'), 'utf8');
const compiled = ts.transpileModule(calculatorSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const calculatorModule = { exports: {} };
vm.runInNewContext(compiled, {
  module: calculatorModule,
  exports: calculatorModule.exports,
  require,
}, { filename: 'calculator.ts' });
const { doughCalc, getFermentationSchedule } = calculatorModule.exports;
const indexSource = fs.readFileSync(path.join(frontendRoot, 'app', '(tabs)', 'index.tsx'), 'utf8');
const plannerSource = fs.readFileSync(path.join(frontendRoot, 'app', '(tabs)', 'planner.tsx'), 'utf8');

const baseOptions = {
  pizzas: 4,
  ballWeight: 250,
  hydration: 70,
  saltPct: 2.9,
  oilPct: 2,
  roomHours: 2,
  roomTemp: 18,
  fridgeHours: 24,
  fridgeTemp: 4,
  flourType: 'caputo00',
  yeastType: 'fresh',
};

const bigaOptions = {
  ...baseOptions,
  method: 'biga',
  bigaPct: 50,
  bigaHydrationPct: 62,
  bigaHours: 24,
};
const biga = doughCalc(bigaOptions);
assert.equal(biga.total.flour, biga.preferment.flour + biga.main.flour);
assert.equal(biga.total.water, biga.preferment.water + biga.main.water);
assert.ok(Math.abs((biga.preferment.water / biga.preferment.flour) * 100 - 62) < 0.3);
assert.ok(Math.abs((biga.total.water / biga.total.flour) * 100 - bigaOptions.hydration) < 0.2);
assert.equal(biga.main.salt, biga.total.salt);
assert.equal(biga.main.oil, biga.total.oil);
assert.equal(biga.total.yeast, biga.preferment.yeast + biga.main.yeast);
assert.equal(biga.totalDough, bigaOptions.pizzas * bigaOptions.ballWeight);

const legacyBiga = doughCalc({ ...bigaOptions, bigaHydrationPct: undefined });
assert.ok(Math.abs((legacyBiga.preferment.water / legacyBiga.preferment.flour) * 100 - 45) < 0.3);

const poolishOptions = {
  ...baseOptions,
  method: 'poolish',
  poolishPct: 35,
  poolishHydrationPct: 100,
  poolishFermentationTempC: 22,
  prefermentHours: 24,
};
const poolish = doughCalc(poolishOptions);
assert.equal(poolish.total.flour, poolish.preferment.flour + poolish.main.flour);
assert.equal(poolish.total.water, poolish.preferment.water + poolish.main.water);
assert.ok(Math.abs((poolish.preferment.water / poolish.preferment.flour) * 100 - 100) < 0.3);
assert.ok(Math.abs((poolish.total.water / poolish.total.flour) * 100 - poolishOptions.hydration) < 0.2);
assert.equal(poolish.main.salt, poolish.total.salt);
assert.equal(poolish.main.oil, poolish.total.oil);
assert.equal(poolish.total.yeast, poolish.preferment.yeast + poolish.main.yeast);

const adjustedPoolish = doughCalc({ ...poolishOptions, poolishHydrationPct: 80 });
assert.ok(Math.abs((adjustedPoolish.preferment.water / adjustedPoolish.preferment.flour) * 100 - 80) < 0.3);
assert.equal(adjustedPoolish.total.water, adjustedPoolish.preferment.water + adjustedPoolish.main.water);

const selectedTemperatureSchedule = getFermentationSchedule({
  method: 'poolish',
  prefermentHours: 24,
  prefermentTempC: 22,
  roomHours: 2,
  roomTemp: 18,
  fridgeHours: 24,
  fridgeTemp: 4,
});
assert.equal(selectedTemperatureSchedule.prefermentRoomHours, 24);
assert.equal(selectedTemperatureSchedule.prefermentFridgeHours, 0);
assert.equal(selectedTemperatureSchedule.phases[0].temperature, 22);
assert.equal(selectedTemperatureSchedule.prefermentTemperatureC, 22);
assert.notEqual(
  doughCalc({ ...poolishOptions, poolishFermentationTempC: 4 }).total.yeast,
  doughCalc({ ...poolishOptions, poolishFermentationTempC: 35 }).total.yeast,
);
assert.throws(
  () => getFermentationSchedule({ ...selectedTemperatureSchedule, method: 'poolish', prefermentTempC: 36 }),
  /between 4°C and 35°C/,
);

const yeastBlock = indexSource.indexOf('testID={`yeast-settings-${method}`}');
const spongeBlock = indexSource.indexOf('testID="sponge-settings"', yeastBlock);
const bigaBlock = indexSource.indexOf('testID="biga-settings"', spongeBlock);
const poolishBlock = indexSource.indexOf('testID="poolish-settings"', bigaBlock);
const mixerSelection = indexSource.indexOf('testID="mix-hand"', poolishBlock);
const finalDoughHydration = indexSource.indexOf('<View style={styles.hydRow}>', mixerSelection);
assert.ok(yeastBlock >= 0 && spongeBlock > yeastBlock);
assert.ok(bigaBlock > spongeBlock && poolishBlock > bigaBlock);
assert.ok(mixerSelection > poolishBlock && finalDoughHydration > mixerSelection);
for (const setting of ['bigaHydrationPct', 'poolishHydrationPct', 'poolishFermentationTempC']) {
  assert.ok(indexSource.includes(setting), `Calculator does not wire ${setting}`);
  assert.ok(plannerSource.includes(setting), `Planner does not wire ${setting}`);
}
assert.ok(plannerSource.includes('planner-preferment-settings'));
assert.match(indexSource, /bigaHydrationPct: !isBeginner \? bigaHydrationPct : undefined/);
assert.match(indexSource, /poolishFermentationTempC: !isBeginner && method === 'poolish'/);
for (const label of [
  'Hidratacija Bige', 'Biga hydration', 'Biga-Hydration', 'Hidracija Bige',
  'Hidratacija Poolisha', 'Poolish hydration', 'Poolish-Hydration', 'Hidracija Poolisha',
  'Temperatura fermentacije Poolisha', 'Poolish fermentation temperature',
  'Poolish-Fermentationstemperatur',
]) {
  assert.ok(indexSource.includes(label), `Missing translated UI label: ${label}`);
}

console.log('Biga/Poolish allocation, fermentation temperature, Planner wiring, and settings order checks passed.');
