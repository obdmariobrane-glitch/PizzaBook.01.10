#!/usr/bin/env node

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'app', '(tabs)', 'index.tsx'), 'utf8');

assert.match(source, /if \(isBeginner \|\| !phases\) return phases/);
assert.match(source, /zeroIngredientInstruction/);
assert.match(source, /dough\.total\.salt > 0/);
assert.match(source, /dough\.total\.oil > 0/);
for (const language of ['soli', 'salt', 'Salz', 'oljčnega']) {
  assert.ok(source.includes(language), `missing localized ingredient path: ${language}`);
}

for (const total of [0, 1, 3.2, 8.7]) {
  const saltSteps = total > 0 ? [`${total} g salt`] : [];
  assert.equal(saltSteps.some((step) => /\b0(?:\.0+)?\s*g\b/.test(step)), false);
}
for (const total of [0, 2.5, 11]) {
  const oilSteps = total > 0 ? [`${total} g oil`] : [];
  assert.equal(oilSteps.some((step) => /\b0(?:\.0+)?\s*g\b/.test(step)), false);
}

console.log('F27 zero-ingredient PRO instruction regression passed.');
