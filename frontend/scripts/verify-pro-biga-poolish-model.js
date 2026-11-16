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
  vm.runInNewContext(compiled, { module, exports: module.exports }, { filename: relativePath });
  return module.exports;
}

const { calculateBigaPoolishIngredients } = loadModule('src/proMethods/bigaPoolish.ts');
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

console.log('PASS: 10 BP cases, automatic/manual allocation, ingredient balances, F_final=0 policy, invalid percentages, negative water remainder.');
