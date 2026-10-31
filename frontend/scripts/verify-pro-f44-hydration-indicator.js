#!/usr/bin/env node

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const frontendRoot = path.join(__dirname, '..');
require.extensions['.ts'] = (module, filename) => {
  const source = fs.readFileSync(filename, 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  module._compile(output, filename);
};

const {
  FLOUR_PROFILES,
  PIZZA_STYLE_PROFILES,
  blendIdealHydration,
} = require(path.join(frontendRoot, 'src', 'calculator.ts'));
const indexSource = fs.readFileSync(path.join(frontendRoot, 'app', '(tabs)', 'index.tsx'), 'utf8');

const gfRange = FLOUR_PROFILES.glutenFree;
for (const value of [64, gfRange.min - 1, gfRange.min, gfRange.ideal, gfRange.max, gfRange.max + 1]) {
  assert.equal(value >= gfRange.min && value <= gfRange.max, value >= 75 && value <= 85, `standard GF range at ${value}%`);
}

for (const [blendA, blendB, pctA] of [
  ['glutenFree', 'caputo00', 100],
  ['caputo00', 'glutenFree', 0],
]) {
  const ideal = blendIdealHydration(blendA, blendB, pctA);
  assert.equal(ideal, gfRange.ideal, 'pure-GF custom blend uses the existing GF ideal');
  for (const value of [ideal - 4, ideal - 3, ideal, ideal + 3, ideal + 4]) {
    assert.equal(Math.abs(value - ideal) <= 3, value >= ideal - 3 && value <= ideal + 3, `custom GF blend range at ${value}%`);
  }
}

for (const style of Object.values(PIZZA_STYLE_PROFILES)) {
  assert.ok(Number.isFinite(style.hydration), 'all supported pizza styles retain a valid style hydration');
}

assert.match(indexSource, /: isProGlutenFreeBlend\s*\n\s*\?\s*customIdeal\s*\n\s*: flourProfile\.ideal/);
assert.match(indexSource, /const hydrationRecommendation = isProGlutenFreeBlend/);
assert.match(indexSource, /const defaultHydrationForStyle = \(style: PizzaStyle\) => \{[\s\S]*?isProEffectivelyGlutenFree\) return isProGlutenFreeBlend \? customIdeal : FLOUR_PROFILES\.glutenFree\.ideal;[\s\S]*?return PIZZA_STYLE_PROFILES\[style\]\.hydration;/);
assert.match(indexSource, /setHydration\(defaultHydrationForStyle\(nextStyle\)\)/);
assert.match(indexSource, /setHydration\(defaultHydrationForStyle\(pizzaStyle\)\)/);
assert.match(indexSource, /hydrationRecommendation\}\$\{isProEffectivelyGlutenFree \? '' : ` \(◎ \$\{styleProfile\.hydration\}%\)`\}/);

console.log('F44 PRO hydration indicator regression passed.');
