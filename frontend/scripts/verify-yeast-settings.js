#!/usr/bin/env node

const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const ts = require('typescript');
const vm = require('vm');

const frontendRoot = path.resolve(path.dirname(process.argv[1]), '..');

function loadTypeScript(relativePath) {
  const source = fs.readFileSync(path.join(frontendRoot, relativePath), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const moduleRef = { exports: {} };
  vm.runInNewContext(compiled, { module: moduleRef, exports: moduleRef.exports }, { filename: relativePath });
  return moduleRef.exports;
}

function loadFunction(relativePath, functionName, context = {}) {
  const sourcePath = path.join(frontendRoot, relativePath);
  const source = fs.readFileSync(sourcePath, 'utf8');
  const sourceFile = ts.createSourceFile(sourcePath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let declaration;
  const visit = (node) => {
    if (ts.isFunctionDeclaration(node) && node.name?.text === functionName) declaration = node;
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  assert.ok(declaration, `Missing ${functionName} in ${relativePath}`);
  const compiled = ts.transpileModule(
    `${declaration.getText(sourceFile)}\nmodule.exports = ${functionName};`,
    { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } },
  ).outputText;
  const moduleRef = { exports: {} };
  vm.runInNewContext(compiled, { module: moduleRef, exports: moduleRef.exports, ...context });
  return moduleRef.exports;
}

const calculator = loadTypeScript('src/calculator.ts');
const translations = loadTypeScript('src/i18n/yeastSettings.ts').YEAST_SETTINGS_COPY;
const indexSource = fs.readFileSync(path.join(frontendRoot, 'app', '(tabs)', 'index.tsx'), 'utf8');
const plannerSource = fs.readFileSync(path.join(frontendRoot, 'app', '(tabs)', 'planner.tsx'), 'utf8');

const baseOptions = {
  pizzas: 4,
  ballWeight: 250,
  hydration: 65,
  saltPct: 2.9,
  oilPct: 2,
  roomHours: 2,
  roomTemp: 22,
  fridgeHours: 24,
  fridgeTemp: 4,
  flourType: 'caputo00',
};
const types = ['fresh', 'activeDry', 'dry'];
const methods = ['direct', 'biga', 'poolish'];

for (const method of methods) {
  const automaticByType = types.map((yeastType) => calculator.doughCalc({
    ...baseOptions,
    method,
    yeastType,
  }));
  const freshQuantity = automaticByType[0].total.yeast;
  assert.ok(Math.abs(automaticByType[1].total.yeast - freshQuantity * 0.4) <= 0.01);
  assert.ok(Math.abs(automaticByType[2].total.yeast - freshQuantity / 3) <= 0.01);
  assert.deepEqual(
    calculator.doughCalc({ ...baseOptions, method }).total,
    automaticByType[0].total,
    `${method} automatic calculation must preserve its existing fresh-yeast result`,
  );

  for (const yeastType of types) {
    const manualGrams = 1.75;
    const result = calculator.doughCalc({
      ...baseOptions,
      method,
      yeastType,
      yeastMode: 'manual',
      manualYeastGrams: manualGrams,
    });
    assert.equal(result.total.yeast, manualGrams, `${method}/${yeastType} manual quantity must be used exactly once`);
    assert.ok(Math.abs(result.yeastPct - manualGrams / result.total.flour * 100) < 0.01);
    if (method !== 'direct') {
      assert.equal(result.preferment.yeast + result.main.yeast, result.total.yeast);
    }
    const ingredientMass = result.total.flour + result.total.water + result.total.salt
      + result.total.oil + result.total.yeast + result.total.psyllium;
    assert.ok(Math.abs(ingredientMass - result.totalDough) <= 2);
  }
}

assert.equal(calculator.validateManualYeastGrams('', 100), 'empty');
assert.equal(calculator.validateManualYeastGrams('abc', 100), 'invalid');
assert.equal(calculator.validateManualYeastGrams('0', 100), 'zero');
assert.equal(calculator.validateManualYeastGrams('-1', 100), 'negative');
assert.equal(calculator.validateManualYeastGrams('11', 100), 'unreasonable');
assert.equal(calculator.validateManualYeastGrams('1,5', 100), null);

const defaultSettings = {
  direct: { mode: 'automatic', yeastType: 'fresh', manualInput: '1', manualGrams: 1 },
  biga: { mode: 'automatic', yeastType: 'fresh', manualInput: '1', manualGrams: 1 },
  poolish: { mode: 'automatic', yeastType: 'fresh', manualInput: '1', manualGrams: 1 },
  sponge: { mode: 'automatic', yeastType: 'fresh', manualInput: '1', manualGrams: 1 },
};
const isCommercialYeastType = (value) => types.includes(value);
const isYeastMode = (value) => value === 'automatic' || value === 'manual';
const restoreMethodYeastSettings = loadFunction(
  'app/(tabs)/index.tsx',
  'restoreMethodYeastSettings',
  { DEFAULT_METHOD_YEAST_SETTINGS: defaultSettings, isCommercialYeastType, isYeastMode },
);
const restored = restoreMethodYeastSettings({
  direct: { mode: 'manual', yeastType: 'activeDry', manualGrams: 2.25 },
  biga: { mode: 'manual', yeastType: 'dry', manualGrams: 3.5, manualInput: '3.5' },
  poolish: { mode: 'automatic', yeastType: 'fresh', manualGrams: 4 },
});
assert.equal(restored.direct.manualGrams, 2.25);
assert.equal(restored.direct.yeastType, 'activeDry');
assert.equal(restored.biga.manualGrams, 3.5);
assert.equal(restored.biga.yeastType, 'dry');
assert.equal(restored.poolish.manualGrams, 4);
assert.equal(restored.sponge.mode, 'automatic');
const legacySponge = restoreMethodYeastSettings(null, {
  mode: 'manual',
  yeastType: 'dry',
  manualGrams: 5,
});
assert.equal(legacySponge.sponge.manualGrams, 5);
assert.equal(legacySponge.sponge.yeastType, 'dry');

for (const lang of ['hr', 'en', 'de', 'sl']) {
  const copy = translations[lang];
  for (const key of ['title', 'mode', 'automatic', 'manual', 'type', 'fresh', 'activeDry', 'instantDry', 'quantity', 'manualQuantity', 'percentage', 'automaticHelp', 'conversionHelp', 'spongeHelp']) {
    assert.ok(copy[key], `${lang} translation is missing ${key}`);
  }
  for (const error of ['empty', 'invalid', 'zero', 'negative', 'unreasonable']) {
    assert.ok(copy.errors[error], `${lang} translation is missing ${error} validation copy`);
  }
}

for (const method of ['direct', 'biga', 'poolish', 'sponge']) {
  assert.ok(indexSource.includes(`{ k: '${method}' as const`), `${method} must remain selectable`);
}
assert.ok(indexSource.includes('testID={`yeast-settings-${method}`}'));
assert.ok(indexSource.includes('methodYeastSettings'));
assert.ok(indexSource.includes('calculatorYeastSummary'));
assert.ok(plannerSource.includes('plannerYeastSummaryText'));
assert.ok(plannerSource.includes('calculatorYeastSummary'));
for (const label of ['Kvasac:', 'Yeast:', 'Hefe:', 'Kvas:']) {
  assert.ok(plannerSource.includes(label), `Planner summary is missing localized label ${label}`);
}

console.log('Yeast settings calculations, conversions, manual quantities, persistence, Planner summary, and translations passed.');
