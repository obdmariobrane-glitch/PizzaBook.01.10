#!/usr/bin/env node

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const frontendRoot = path.join(__dirname, '..');
const calculatorSource = fs.readFileSync(path.join(frontendRoot, 'src', 'calculator.ts'), 'utf8');
const calculator = { exports: {} };
new Function('module', 'exports', 'require', `${ts.transpileModule(calculatorSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText}\nreturn module.exports;`)(calculator, calculator.exports, require);

const { doughCalc } = calculator.exports;
const makeRecipe = (hydration, poolishPct, mixing, flourType = 'caputo00') => doughCalc({
  pizzas: 2,
  ballWeight: 250,
  hydration,
  saltPct: 2,
  oilPct: 0,
  method: 'poolish',
  poolishPct,
  roomHours: 2,
  roomTemp: 22,
  fridgeHours: 0,
  fridgeTemp: 4,
  yeastType: 'fresh',
  mixing,
  flourType,
});

for (const mixing of ['hand', 'mixer', 'spiral']) {
  const below = makeRecipe(50, 49, mixing);
  const exact = makeRecipe(50, 50, mixing);
  const above = makeRecipe(50, 51, mixing);
  assert.ok(below.main.water >= 0, `${mixing}: below-boundary water must be non-negative`);
  assert.equal(exact.main.water, 0, `${mixing}: exact boundary must leave zero water`);
  assert.ok(above.main.water < 0, `${mixing}: above-boundary reproduction must be negative`);
  assert.equal(below.total.water, below.preferment.water + below.main.water, `${mixing}: water mass is conserved below boundary`);
}

for (const flourType of ['caputo00', 'manitoba', 'spelt', 'wholeWheat', 'glutenFree']) {
  const recipe = makeRecipe(75, 75, 'mixer', flourType);
  assert.ok(recipe.main.water >= 0, `${flourType}: exact boundary must be valid`);
}

const source = fs.readFileSync(path.join(frontendRoot, 'app', '(tabs)', 'index.tsx'), 'utf8');
assert.match(source, /const maxProPoolishPct = Math\.min\(100, Math\.max\(20, Math\.floor\(hydration \* 100 \/ poolishHydrationPct\)\)\)/);
assert.match(source, /setPoolishPct\(maxProPoolishPct\)/);
for (const text of [
  'Poolish od ${poolishPct}% nije moguć',
  'A ${poolishPct}% Poolish is not feasible',
  'Ein Poolish mit ${poolishPct}% ist bei',
  'Poolish s ${poolishPct}% pri skupni hidraciji',
]) {
  assert.ok(source.includes(text), `missing localized Poolish water warning: ${text}`);
}

console.log('F23 Poolish water boundary regression passed for boundary, mixing, flour, and localized guard coverage.');
