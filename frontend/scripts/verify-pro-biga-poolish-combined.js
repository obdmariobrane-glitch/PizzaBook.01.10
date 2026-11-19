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

const frontendRoot = path.join(__dirname, '..');
const { doughCalc } = loadTypeScriptModule(path.join(frontendRoot, 'src', 'calculator.ts'));
const shared = {
  pizzas: 1,
  ballWeight: 1678,
  hydration: 65,
  saltPct: 2.8,
  oilPct: 0,
  roomHours: 4,
  roomTemp: 22,
  fridgeHours: 24,
  fridgeTemp: 4,
  prefermentHours: 16,
  yeastType: 'fresh',
  mixing: 'home',
  flourType: 'caputo00',
  bigaPct: 30,
  bigaHydrationPct: 60,
  poolishPct: 20,
  poolishHydrationPct: 100,
};
const bigaSchedule = {
  phases: [{ kind: 'preferment', environment: 'room', hours: 10, temperature: 21 }],
  prefermentHours: 10,
  prefermentRoomHours: 10,
  prefermentFridgeHours: 0,
};
const poolishSchedule = {
  phases: [
    { kind: 'preferment', environment: 'room', hours: 4, temperature: 22 },
    { kind: 'preferment', environment: 'fridge', hours: 8, temperature: 4 },
  ],
  prefermentHours: 12,
  prefermentRoomHours: 4,
  prefermentFridgeHours: 8,
  poolishMode: 'rt-ct',
};
const close = (actual, expected, message) => assert.ok(Math.abs(actual - expected) < 1e-9, `${message}: ${actual} !== ${expected}`);

const legacyBiga = doughCalc({ ...shared, method: 'biga' });
assert.equal(legacyBiga.preferment.flour, 300, 'legacy Biga fallback remains active');
assert.equal(legacyBiga.preferments, undefined, 'legacy Biga keeps the legacy result shape');

const legacyPoolish = doughCalc({ ...shared, method: 'poolish' });
assert.equal(legacyPoolish.preferment.flour, 200, 'legacy Poolish fallback remains active');
assert.equal(legacyPoolish.preferments, undefined, 'legacy Poolish keeps the legacy result shape');

const explicitDisabled = doughCalc({ ...shared, method: 'biga', bigaEnabled: false, poolishEnabled: false });
assert.equal(explicitDisabled.method, 'direct', 'explicit false flags override legacy method');
assert.equal(explicitDisabled.preferment, null, 'disabled branches have no preferment');
assert.equal(explicitDisabled.preferments, undefined, 'disabled branches do not create combined output');

const combined = doughCalc({
  ...shared,
  method: 'biga',
  bigaEnabled: true,
  poolishEnabled: true,
  fermentationSchedule: bigaSchedule,
  bigaFermentationSchedule: bigaSchedule,
  poolishFermentationSchedule: poolishSchedule,
});
assert.equal(combined.preferment, null, 'combined output does not collapse to one preferment');
assert.equal(combined.preferments.biga.flour, 300, 'combined Biga flour');
assert.equal(combined.preferments.biga.water, 180, 'combined Biga water');
assert.equal(combined.preferments.poolish.flour, 200, 'combined Poolish flour');
assert.equal(combined.preferments.poolish.water, 200, 'combined Poolish water');
assert.equal(combined.main.flour, 500, 'combined main flour is the remaining flour');
assert.equal(combined.main.water, 270, 'combined main water is the remaining water');
assert.equal(combined.total.flour, 1000, 'combined total flour is balanced');
assert.equal(combined.total.water, 650, 'combined total water is balanced');
assert.equal(combined.total.salt, 28, 'salt remains in the final dough total');
close(combined.preferments.biga.yeast + combined.preferments.poolish.yeast + combined.main.yeast, combined.total.yeast, 'yeast balance');
assert.equal(combined.prefermentSchedules.biga.endAtHours, 10, 'Biga end time is independent');
assert.equal(combined.prefermentSchedules.poolish.endAtHours, 12, 'Poolish end time includes both RT and CT phases');
assert.equal(combined.prefermentSchedules.poolish.phases.length, 2, 'Poolish RT/CT phases remain separate');
assert.equal(combined.prefermentSchedules.poolish.phases[0].environment, 'room');
assert.equal(combined.prefermentSchedules.poolish.phases[1].environment, 'fridge');
assert.equal(combined.prefermentSchedules.finalMixStartHours, 12, 'final mixing waits for the slower branch');

const direct = doughCalc({ ...shared, method: 'direct' });
assert.equal(direct.preferment, null, 'Direct remains without a preferment');
assert.equal(direct.main.flour, direct.total.flour, 'Direct flour remains in the main dough');
assert.equal(direct.main.water, direct.total.water, 'Direct water remains in the main dough');

assert.throws(() => doughCalc({ ...shared, method: 'biga', bigaEnabled: true, poolishEnabled: true, bigaPct: 80, poolishPct: 30 }), /cannot exceed 100/);
const calculatorSource = fs.readFileSync(path.join(frontendRoot, 'app', '(tabs)', 'index.tsx'), 'utf8');
for (const text of [
  'Biga + Poolish zajedno',
  'Biga + Poolish together',
  'Biga + Poolish zusammen',
  'Biga + Poolish skupaj',
  'Završno miješanje počinje',
  'Final mixing starts',
  'Das abschließende Mischen beginnt',
  'Končno mešanje se začne',
]) {
  assert.ok(calculatorSource.includes(text), `missing localized combined text: ${text}`);
}

console.log('PASS: combined Biga + Poolish Calculator integration');
