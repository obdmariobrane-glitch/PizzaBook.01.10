#!/usr/bin/env node

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'calculator.ts'), 'utf8');
const output = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const moduleValue = { exports: {} };
new Function('module', 'exports', 'require', `${output}\nreturn module.exports;`)(moduleValue, moduleValue.exports, require);
const { iceCalc } = moduleValue.exports;

for (const water of [0, 0.1, 1, 10, 90, 250, 1000]) {
  for (const tapTemp of [-40, 0, 4, 24, 100, 1000]) {
    for (const targetTemp of [-20, 0, 4, 24, 80]) {
      const result = iceCalc(water, tapTemp, targetTemp);
      assert.ok(Number.isFinite(result.ice) && Number.isFinite(result.water));
      assert.ok(result.ice >= 0 && result.water >= 0);
      assert.ok(result.ice <= water);
      assert.ok(Math.abs(result.ice + result.water - water) <= 1);
    }
  }
}

const normal = iceCalc(90, 24, 4);
assert.equal(normal.ice, 21);
assert.equal(normal.water, 69);

const prefermentStage = iceCalc(90, 30, 4);
assert.ok(prefermentStage.ice <= 90);
assert.equal(prefermentStage.ice + prefermentStage.water, 90);

console.log('F28 PRO ice boundary regression passed.');
