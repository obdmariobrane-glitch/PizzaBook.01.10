#!/usr/bin/env node

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'src', 'calculator.ts'), 'utf8');
const output = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const moduleValue = { exports: {} };
new Function('module', 'exports', 'require', `${output}\nreturn module.exports;`)(moduleValue, moduleValue.exports, require);
const { doughCalc } = moduleValue.exports;
const plannerSource = fs.readFileSync(path.join(root, 'app', '(tabs)', 'planner.tsx'), 'utf8');

assert.match(plannerSource, /sharedCalculatorPlanSettings\.proFermentationSchedule/);
assert.match(plannerSource, /getFermentationSchedule\(/);
assert.match(plannerSource, /activeCalculatorPlanSettings\.bigaHours/);

for (const bigaPct of [20, 35, 50, 75, 100]) {
  const result = doughCalc({
    pizzas: 2,
    ballWeight: 250,
    hydration: 65,
    saltPct: 2.8,
    oilPct: 1,
    method: 'biga',
    bigaPct,
    roomHours: 2,
    roomTemp: 22,
    fridgeHours: 16,
    fridgeTemp: 4,
    prefermentHours: 24,
    mixing: 'hand',
    flourType: 'caputo00',
  });
  const calculatedHydration = result.preferment.water / result.preferment.flour * 100;
  assert.ok(Math.abs(calculatedHydration - 45) <= 1.5);
  assert.ok(Math.abs(result.preferment.flour + result.main.flour - result.total.flour) <= 1);
  assert.ok(Math.abs(result.preferment.water + result.main.water - result.total.water) <= 1);
}

console.log('F30 Biga Calculator/Planner parity regression passed.');
