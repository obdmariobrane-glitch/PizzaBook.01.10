#!/usr/bin/env node

const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const ts = require('typescript');
const vm = require('vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'calculator.ts'), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const moduleRef = { exports: {} };
vm.runInNewContext(compiled, { module: moduleRef, exports: moduleRef.exports }, { filename: 'calculator.ts' });

const { doughCalc } = moduleRef.exports;
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

console.log('doughCalc profile compatibility checks passed.');