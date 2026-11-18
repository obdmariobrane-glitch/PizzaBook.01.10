#!/usr/bin/env node

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const vm = require('node:vm');

const sourcePath = path.join(__dirname, '..', 'src', 'calculator.ts');
const compiled = ts.transpileModule(fs.readFileSync(sourcePath, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const bigaPoolishSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'proMethods', 'bigaPoolish.ts'), 'utf8');
const bigaPoolishCompiled = ts.transpileModule(bigaPoolishSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const bigaPoolishModule = { exports: {} };
vm.runInNewContext(bigaPoolishCompiled, { module: bigaPoolishModule, exports: bigaPoolishModule.exports });
const moduleRef = { exports: {} };
vm.runInNewContext(compiled, {
  module: moduleRef,
  exports: moduleRef.exports,
  require: (specifier) => {
    assert.equal(specifier, './proMethods/bigaPoolish');
    return bigaPoolishModule.exports;
  },
});
const calculator = moduleRef.exports;

const referencePhases = [
  { kind: 'preferment', environment: 'room', hours: 8, temperature: 22 },
  { kind: 'preferment', environment: 'fridge', hours: 16, temperature: 4 },
];
const expectedGramsByType = {
  fresh: 0.4464285714285714,
  activeDry: 0.17857142857142855,
  dry: 0.1488095238095238,
};
for (const [yeastType, expectedGrams] of Object.entries(expectedGramsByType)) {
  assert.ok(Math.abs(calculator.calculateBigaYeastGrams(1000, referencePhases, yeastType) - expectedGrams) < 1e-12);
}

const balanced = calculator.calculateBigaYeastAllocation(2.235, expectedGramsByType.fresh);
assert.equal(balanced.bigaYeastGrams, expectedGramsByType.fresh);
assert.ok(Math.abs(balanced.finalDoughYeastGrams - 1.7885714285714285) < 1e-12);
assert.equal(balanced.exceedsBudget, false);
const overBudget = calculator.calculateBigaYeastAllocation(0.414, 6.249);
assert.equal(overBudget.bigaYeastGrams, 6.249);
assert.equal(overBudget.finalDoughYeastGrams, 0);
assert.equal(overBudget.excessGrams, 5.835);
assert.equal(overBudget.exceedsBudget, true);

const phases = [
  { kind: 'preferment', environment: 'room', hours: 4, temperature: 22 },
  { kind: 'final', environment: 'fridge', hours: 24, temperature: 4 },
];
const commonOptions = {
  pizzas: 4,
  ballWeight: 250,
  hydration: 65,
  saltPct: 2.9,
  oilPct: 2,
  bigaPct: 100,
  roomHours: 0,
  roomTemp: 22,
  fridgeHours: 24,
  fridgeTemp: 4,
  fermentationSchedule: { phases },
  flourType: 'caputo00',
};
const result = calculator.doughCalc({
  ...commonOptions,
  method: 'biga',
  yeastType: 'fresh',
  useDirectYeastModelForBiga: true,
});
assert.ok(result.bigaYeastGrams > 0);
assert.equal(result.preferment.yeast, result.bigaYeastGrams);
assert.equal(result.main.yeast, result.finalDoughYeastGrams);
assert.equal(result.total.yeast, result.bigaYeastGrams + result.finalDoughYeastGrams);
assert.ok(Math.abs(result.yeastBudgetGrams - 1.2062705973564747) < 1e-12);

const beginnerBiga = calculator.doughCalc({
  ...commonOptions,
  method: 'biga',
  yeastType: 'fresh',
});
assert.equal(beginnerBiga.yeastBudgetGrams, undefined);
assert.ok(beginnerBiga.total.yeast < result.total.yeast);

const indexSource = fs.readFileSync(path.join(__dirname, '..', 'app', '(tabs)', 'index.tsx'), 'utf8');
assert.match(indexSource, /useDirectYeastModelForBiga: !isBeginner && method === 'biga'/);
assert.match(indexSource, /getYeastAwarePrefermentSteps\(lang, 'biga',[^\n]*dough\.main\.yeast > 0\)/);
assert.match(indexSource, /weight\(dough\.preferment\.yeast, true\)/);
assert.match(indexSource, /weight\(dough\.main\.yeast, true\)/);
const indexFile = ts.createSourceFile('index.tsx', indexSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let weightInitializer;
function findWeight(node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(indexFile) === 'weight') weightInitializer = node.initializer.getText(indexFile);
  ts.forEachChild(node, findWeight);
}
findWeight(indexFile);
const compiledWeight = ts.transpileModule(`globalThis.weight = (${weightInitializer});`, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const weightContext = {
  formatWeight: (grams) => `${Math.round(grams * 100) / 100} g`,
  measurementSystem: 'metric',
  lang: 'en',
  isBeginner: false,
  Math,
  Intl,
};
vm.runInNewContext(compiledWeight, weightContext);
assert.equal(weightContext.weight(0.004, true), '<0.01 g');
assert.equal(weightContext.weight(0.014, true), '0.01 g');

const prefermentSourcePath = path.join(__dirname, '..', 'src', 'i18n', 'prefermentSteps.ts');
const prefermentCompiled = ts.transpileModule(fs.readFileSync(prefermentSourcePath, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const prefermentModule = { exports: {} };
vm.runInNewContext(prefermentCompiled, {
  module: prefermentModule,
  exports: prefermentModule.exports,
  require: (specifier) => {
    assert.equal(specifier, './spiralMixing');
    return { getSpiralMixingSteps: () => [], getSpiralMixingTitle: () => '' };
  },
});
const noExtraYeastCopy = {
  hr: /nije potrebno dodavati dodatni kvasac/i,
  en: /no additional yeast is needed/i,
  de: /keine zusätzliche hefe erforderlich/i,
  sl: /ni treba dodati dodatnega kvasa/i,
};
for (const lang of Object.keys(noExtraYeastCopy)) {
  const withoutFinalYeast = prefermentModule.exports.getYeastAwarePrefermentSteps(lang, 'biga', 'hand', 'fresh', false, false, false).p2.steps.join(' ');
  const withFinalYeast = prefermentModule.exports.getYeastAwarePrefermentSteps(lang, 'biga', 'hand', 'fresh', false, false, true).p2.steps.join(' ');
  assert.match(withoutFinalYeast, noExtraYeastCopy[lang], `${lang}: zero final yeast is explicit`);
  assert.doesNotMatch(withoutFinalYeast, /(?<![\d.,])0(?:[,.]0+)?\s*g/i, `${lang}: zero-gram yeast action is absent`);
  assert.doesNotMatch(withFinalYeast, noExtraYeastCopy[lang], `${lang}: positive final yeast keeps the yeast action`);
}

console.log('PRO Biga yeast model golden values and recipe integration passed.');
