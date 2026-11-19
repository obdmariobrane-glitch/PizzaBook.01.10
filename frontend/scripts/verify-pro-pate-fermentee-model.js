#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const source = fs.readFileSync(path.join(here, '..', 'src', 'proMethods', 'pateFermentee.ts'), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const module = { exports: {} };
vm.runInNewContext(compiled, { module, exports: module.exports }, { filename: 'pateFermentee.ts' });
const { calculatePateFermentee } = module.exports;

const cases = [
  ['PF1', 'mass', 330, undefined, 60, 2.8, 0.75, 1000, 650, 28, 2.5],
  ['PF2', 'mass', 500, undefined, 65, 3, 0.67, 1000, 650, 28, 4],
  ['PF3', 'mass', 600, undefined, 60, 2.5, 0.5, 1200, 780, 30, 3],
  ['PF4', 'mass', 250, undefined, 55, 2.8, 0.8, 900, 585, 25.2, 2],
  ['PF5', 'mass', 430, undefined, 70, 3, 0.4, 1000, 700, 30, 2.5],
  ['PF6', 'mass', 800, undefined, 65, 2.8, 0.7, 1000, 650, 28, 4],
  ['PF7', 'mass', 1200, undefined, 60, 2.8, 0.4, 1000, 650, 28, 3.5],
  ['PF8', 'mass', 160, undefined, 50, 2, 0.5, 1000, 650, 28, 1],
  ['PF9', 'flour', undefined, 200, 62, 2.8, 0.8, 1000, 650, 28, 2.5],
];

for (const [id, mode, oldMass, oldFlour, oldHydration, oldSalt, oldYeast, totalFlour, totalWater, totalSalt, targetYeast] of cases) {
  const result = calculatePateFermentee({
    inputMode: mode,
    totalFlourGrams: totalFlour,
    totalHydrationPct: totalWater / totalFlour * 100,
    totalSaltPct: totalSalt / totalFlour * 100,
    targetYeastGrams: targetYeast,
    oldDoughMassGrams: oldMass,
    oldFlourGrams: oldFlour,
    oldHydrationPct: oldHydration,
    oldSaltPct: oldSalt,
    oldYeastPct: oldYeast,
    composition: 'modeled-only',
  });
  assert.equal(result.status, 'valid', `${id}: status`);
  assert.ok(Math.abs(result.old.flourGrams + result.remaining.flourGrams - totalFlour) < 1e-9, `${id}: flour balance`);
  assert.ok(Math.abs(result.old.waterGrams + result.remaining.waterGrams - totalWater) < 1e-9, `${id}: water balance`);
  assert.ok(Math.abs(result.old.saltGrams + result.remaining.saltGrams - totalSalt) < 1e-9, `${id}: salt balance`);
  assert.ok(Math.abs(result.old.yeastGrams + result.remaining.yeastGrams - targetYeast) < 1e-9, `${id}: yeast balance`);
  assert.equal(result.oldFlourPctBasis, true, `${id}: flour basis`);
}

const literalCases = [
  {
    id: 'PF-LITERAL-MASS',
    input: {
      inputMode: 'mass', totalFlourGrams: 1000, totalHydrationPct: 65,
      totalSaltPct: 2.8, targetYeastGrams: 2.5, oldDoughMassGrams: 330,
      oldHydrationPct: 50, oldSaltPct: 0, oldYeastPct: 0, composition: 'modeled-only',
    },
    expected: {
      old: { flourGrams: 220, waterGrams: 110, saltGrams: 0, yeastGrams: 0, totalMassGrams: 330 },
      remaining: { flourGrams: 780, waterGrams: 540, saltGrams: 28, yeastGrams: 2.5 },
    },
  },
  {
    id: 'PF-LITERAL-FLOUR',
    input: {
      inputMode: 'flour', totalFlourGrams: 1000, totalHydrationPct: 65,
      totalSaltPct: 2.8, targetYeastGrams: 2.5, oldFlourGrams: 200,
      oldHydrationPct: 62, oldSaltPct: 2.8, oldYeastPct: 0.8, composition: 'modeled-only',
    },
    expected: {
      old: { flourGrams: 200, waterGrams: 124, saltGrams: 5.6, yeastGrams: 1.6, totalMassGrams: 331.2 },
      remaining: { flourGrams: 800, waterGrams: 526, saltGrams: 22.4, yeastGrams: 0.9 },
    },
  },
];

for (const { id, input, expected } of literalCases) {
  const result = calculatePateFermentee(input);
  assert.equal(result.status, 'valid', `${id}: status`);
  for (const ingredient of ['flourGrams', 'waterGrams', 'saltGrams', 'yeastGrams']) {
    assert.ok(Math.abs(result.old[ingredient] - expected.old[ingredient]) < 1e-9, `${id}: old ${ingredient}`);
    assert.ok(Math.abs(result.remaining[ingredient] - expected.remaining[ingredient]) < 1e-9, `${id}: remaining ${ingredient}`);
  }
  assert.ok(Math.abs(result.old.totalMassGrams - expected.old.totalMassGrams) < 1e-9, `${id}: old mass`);
}

const incomplete = calculatePateFermentee({
  inputMode: 'mass',
  totalFlourGrams: 1000,
  totalHydrationPct: 65,
  totalSaltPct: 2.8,
  targetYeastGrams: 2.5,
  oldDoughMassGrams: 330,
  composition: 'unknown-additions',
});
assert.equal(incomplete.status, 'incomplete-data');

assert.throws(() => calculatePateFermentee({
  inputMode: 'mass', totalFlourGrams: 1000, totalHydrationPct: 65,
  totalSaltPct: 2.8, targetYeastGrams: 2.5, oldDoughMassGrams: 10,
  oldHydrationPct: 60, oldSaltPct: 2.8, oldYeastPct: 0.5,
  composition: 'known-additions', knownAdditionalMassGrams: 20,
}), (error) => error?.name === 'RangeError');

assert.throws(() => calculatePateFermentee({
  inputMode: 'mass', totalFlourGrams: 1000, totalHydrationPct: 65,
  totalSaltPct: 100.01, targetYeastGrams: 2.5, oldDoughMassGrams: 330,
  oldHydrationPct: 60, oldSaltPct: 2.8, oldYeastPct: 0.5,
  composition: 'modeled-only',
}), (error) => error?.name === 'RangeError');

assert.throws(() => calculatePateFermentee({
  inputMode: 'mass', totalFlourGrams: 1000, totalHydrationPct: 65,
  totalSaltPct: 2.8, targetYeastGrams: 2.5, oldDoughMassGrams: 330,
  oldHydrationPct: 60, oldSaltPct: 100.01, oldYeastPct: 0.5,
  composition: 'modeled-only',
}), (error) => error?.name === 'RangeError');

assert.throws(() => calculatePateFermentee({
  inputMode: 'mass', totalFlourGrams: 1000, totalHydrationPct: 65,
  totalSaltPct: 2.8, targetYeastGrams: 2.5, oldDoughMassGrams: 330,
  oldHydrationPct: 60, oldSaltPct: 2.8, oldYeastPct: 0.5,
  composition: 'known-additions', knownAdditionalMassGrams: 330,
}), (error) => error?.name === 'RangeError');

assert.throws(() => calculatePateFermentee({
  inputMode: 'mass', totalFlourGrams: 1000, totalHydrationPct: 65,
  totalSaltPct: 2.8, targetYeastGrams: 2.5, oldDoughMassGrams: 0,
  oldHydrationPct: 60, oldSaltPct: 2.8, oldYeastPct: 0.5,
  composition: 'modeled-only',
}), (error) => error?.name === 'RangeError');

assert.throws(() => calculatePateFermentee({
  inputMode: 'flour', totalFlourGrams: 1000, totalHydrationPct: 65,
  totalSaltPct: 2.8, targetYeastGrams: 2.5, oldFlourGrams: 0,
  oldHydrationPct: 60, oldSaltPct: 2.8, oldYeastPct: 0.5,
  composition: 'modeled-only',
}), (error) => error?.name === 'RangeError');

const negative = calculatePateFermentee({
  inputMode: 'mass',
  totalFlourGrams: 1000,
  totalHydrationPct: 60,
  totalSaltPct: 2.8,
  targetYeastGrams: 2,
  oldDoughMassGrams: 2500,
  oldHydrationPct: 60,
  oldSaltPct: 2.8,
  oldYeastPct: 0.5,
  composition: 'modeled-only',
});
assert.equal(negative.status, 'negative-remainder');

const tinyDifference = calculatePateFermentee({
  inputMode: 'flour',
  totalFlourGrams: 1000,
  totalHydrationPct: 65,
  totalSaltPct: 2.8,
  targetYeastGrams: 2,
  oldFlourGrams: 200,
  oldHydrationPct: 65,
  oldSaltPct: 2.8,
  oldYeastPct: 0.5,
  composition: 'modeled-only',
  toleranceGrams: 0.01,
});
assert.equal(tinyDifference.status, 'valid');

assert.throws(() => calculatePateFermentee({
  inputMode: 'mass', totalFlourGrams: 1000, totalHydrationPct: 65,
  totalSaltPct: 2.8, targetYeastGrams: 2, oldDoughMassGrams: 330,
  oldHydrationPct: -1, oldSaltPct: 2.8, oldYeastPct: 0.5,
  composition: 'modeled-only',
}), (error) => error?.name === 'RangeError');

console.log('PASS: PF cases including literal mass/flour expectations, incomplete-data, negative-remainder, tolerance, salt bounds, derived-flour validation, and F/W/S/Y balances.');
