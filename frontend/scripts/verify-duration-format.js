#!/usr/bin/env node

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const vm = require('node:vm');

const filePath = path.join(__dirname, '..', 'src', 'i18n', 'prefermentSteps.ts');
const source = fs.readFileSync(filePath, 'utf8');
const sourceFile = ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
const declaration = sourceFile.statements.find((statement) =>
  ts.isFunctionDeclaration(statement) && statement.name?.text === 'formatDuration');
assert.ok(declaration, 'formatDuration must remain a function declaration');

const runtimeSource = `${declaration.getText(sourceFile)}\nmodule.exports = { formatDuration };`;
const compiled = ts.transpileModule(runtimeSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const moduleRef = { exports: {} };
vm.runInNewContext(compiled, { module: moduleRef, exports: moduleRef.exports }, { filename: 'prefermentSteps.ts' });
const { formatDuration } = moduleRef.exports;

const cases = [
  [30 * 60, '30 min'],
  [60 * 60, '1 h'],
  [90 * 60, '1 h 30 min'],
  [2 * 60 * 60 + 2.842170943040401e-14 * 60, '2 h'],
  [24 * 60 * 60, '24 h'],
  [2.5 * 60 * 60, '2 h 30 min'],
  [1.25 * 60 * 60, '1 h 15 min'],
  [1.999 * 60 * 60, '2 h'],
  [3599.5, '1 h'],
  [3600.5, '1 h'],
];

for (const lang of ['hr', 'en', 'de', 'sl']) {
  for (const [seconds, expected] of cases) {
    const actual = formatDuration(seconds, lang);
    assert.equal(actual, expected, `${lang}: ${seconds} seconds`);
    assert.ok(!/[eE][+-]?\d/.test(actual), `${lang}: scientific notation leaked into ${actual}`);
    assert.ok(!/\d+ h 0 min/.test(actual), `${lang}: zero minutes leaked into ${actual}`);
  }
}

console.log('Central duration formatting passed for HR/EN/DE/SL and fractional-hour boundaries.');
