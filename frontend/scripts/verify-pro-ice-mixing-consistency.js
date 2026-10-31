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

const { iceCalc } = moduleValue.exports;
const uiSource = fs.readFileSync(path.join(root, 'app', '(tabs)', 'index.tsx'), 'utf8');

const cases = [
  { method: 'direct', preferment: 0, hydration: 65, totalWater: 213 },
  { method: 'biga', preferment: 0.35, hydration: 65, totalWater: 213 },
  { method: 'poolish', preferment: 0.35, hydration: 65, totalWater: 213 },
];

for (const testCase of cases) {
  const base = testCase.method === 'direct' ? testCase.totalWater : 90;
  const ice = iceCalc(base, 24, 4);
  assert.ok(Number.isFinite(ice.water) && Number.isFinite(ice.ice));
  assert.ok(ice.water >= 0 && ice.ice >= 0);
  assert.equal(ice.water + ice.ice, base);
}

assert.match(uiSource, /const iceWaterBase = method === 'direct' \? dough\.total\.water : dough\.main\.water/);
assert.match(uiSource, /Gradually add \$\{weight\(Math\.max\(0, dough\.main\.water - ice\.ice\)\)\}/);
for (const text of ['preostalo', 'the remaining', 'das verbleibende', 'preostalo']) {
  assert.ok(uiSource.includes(text), `missing localized remaining-water wording: ${text}`);
}

console.log('F25 ice/mixing consistency regression passed.');
