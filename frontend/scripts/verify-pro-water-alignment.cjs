#!/usr/bin/env node

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'proMethods', 'prefermentWaterAlignment.ts'), 'utf8');
const moduleRecord = { exports: {} };
vm.runInNewContext(ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, { module: moduleRecord, exports: moduleRecord.exports });

const { alignPrefermentShare, repairPrefermentHydration } = moduleRecord.exports;

const bigaIncrease = alignPrefermentShare({
  bigaPct: 50,
  poolishPct: 30,
  totalHydrationPct: 70,
  bigaHydrationPct: 62,
  poolishHydrationPct: 100,
  changedSide: 'biga',
  requestedPct: 80,
});
assert.deepEqual([bigaIncrease.bigaPct, bigaIncrease.poolishPct, bigaIncrease.blocked], [80, 20, false]);

const poolishIncrease = alignPrefermentShare({
  bigaPct: 30,
  poolishPct: 50,
  totalHydrationPct: 70,
  bigaHydrationPct: 62,
  poolishHydrationPct: 100,
  changedSide: 'poolish',
  requestedPct: 80,
});
assert.deepEqual([poolishIncrease.bigaPct, poolishIncrease.poolishPct, poolishIncrease.blocked], [20, 55, false]);

const hydrationDecrease = repairPrefermentHydration({
  bigaPct: 50,
  poolishPct: 35,
  totalHydrationPct: 62,
  bigaHydrationPct: 62,
  poolishHydrationPct: 100,
});
assert.deepEqual([hydrationDecrease.bigaPct, hydrationDecrease.poolishPct, hydrationDecrease.blocked], [50, 30, false]);
assert.ok(hydrationDecrease.bigaPct <= 50 && hydrationDecrease.poolishPct <= 35);

console.log('PRO water alignment assertions passed');
