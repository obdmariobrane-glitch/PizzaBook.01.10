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
  vm.runInNewContext(compiled, {
    module: moduleRef,
    exports: moduleRef.exports,
    require: (specifier) => {
      if (specifier === './proMethods/bigaPoolish') {
        return loadTypeScript('src/proMethods/bigaPoolish.ts');
      }
      throw new Error(`Unexpected dependency in ${relativePath}: ${specifier}`);
    },
  }, { filename: relativePath });
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
const units = loadTypeScript('src/units.ts');

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
    const manualGrams = 1;
    const result = calculator.doughCalc({
      ...baseOptions,
      method,
      yeastType,
      yeastMode: 'manual',
      manualYeastGrams: manualGrams,
    });
    assert.equal(result.total.yeast, manualGrams, `${method}/${yeastType} manual quantity must be used exactly once`);
    assert.ok(Math.abs(result.yeastPct - manualGrams / result.total.flour * 100) < 0.01);
    const recommended = calculator.doughCalc({
      ...baseOptions,
      method,
      yeastType,
      yeastMode: 'automatic',
      manualYeastGrams: 0,
    });
    assert.equal(
      recommended.total.yeast,
      automaticByType[types.indexOf(yeastType)].total.yeast,
      `${method}/${yeastType} recommendation must not depend on the 1 g manual recipe input`,
    );
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
  sponge: { mode: 'manual', yeastType: 'fresh', manualGrams: 0.05 },
});
assert.equal(restored.direct.manualGrams, 2.25);
assert.equal(restored.direct.yeastType, 'activeDry');
assert.equal(restored.biga.manualGrams, 3.5);
assert.equal(restored.biga.yeastType, 'dry');
assert.equal(restored.poolish.manualGrams, 4);
assert.equal(restored.sponge.mode, 'manual');
assert.equal(restored.sponge.manualGrams, 0.05);
assert.equal(restored.sponge.manualInput, '0.05');
const legacySponge = restoreMethodYeastSettings(null, {
  mode: 'manual',
  yeastType: 'dry',
  manualGrams: 5,
});
assert.equal(legacySponge.sponge.manualGrams, 5);
assert.equal(legacySponge.sponge.yeastType, 'dry');
const stepManualYeastGrams = loadFunction('app/(tabs)/index.tsx', 'stepManualYeastGrams');
for (const [input, current, flour, direction, expected] of [
  ['1.00', 1, 100, 1, 1.05],
  ['0.05', 0.05, 100, -1, 0.05],
  ['bad', 1, 100, 1, 1.05],
]) {
  const stepped = stepManualYeastGrams(input, current, flour, direction);
  assert.equal(stepped.manualGrams, expected);
  assert.equal(stepped.manualInput, expected.toFixed(2));
}

const indexFile = ts.createSourceFile('index.tsx', indexSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let weightInitializer;
const findWeight = (node) => {
  if (ts.isVariableDeclaration(node) && node.name.getText(indexFile) === 'weight') weightInitializer = node.initializer.getText(indexFile);
  ts.forEachChild(node, findWeight);
};
findWeight(indexFile);
assert.ok(weightInitializer, 'The active calculator route must define its weight formatter');
const weightModule = { exports: {} };
const compiledWeight = ts.transpileModule(
  `const weight = ${weightInitializer}; module.exports = weight;`,
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } },
).outputText;
vm.runInNewContext(compiledWeight, {
  module: weightModule,
  exports: weightModule.exports,
  formatWeight: units.formatWeight,
  measurementSystem: 'metric',
  lang: 'en',
  isBeginner: false,
});
assert.equal(weightModule.exports(0.004, true), '<0.01 g');
assert.equal(weightModule.exports(2.518, true), '2.52 g');

for (const lang of ['hr', 'en', 'de', 'sl']) {
  const copy = translations[lang];
  for (const key of ['title', 'mode', 'automatic', 'manual', 'type', 'fresh', 'activeDry', 'instantDry', 'quantity', 'manualQuantity']) {
    assert.ok(copy[key], `${lang} translation is missing ${key}`);
  }
  assert.equal(copy.quantity, {
    hr: 'Idealna količina kvasca',
    en: 'Ideal yeast quantity',
    de: 'Ideale Hefemenge',
    sl: 'Idealna količina kvasa',
  }[lang]);
  for (const key of ['percentage', 'automaticHelp', 'conversionHelp', 'spongeHelp']) {
    assert.equal(copy[key], undefined, `${lang} must not retain explanatory yeast copy ${key}`);
  }
  for (const error of ['empty', 'invalid', 'zero', 'negative', 'unreasonable']) {
    assert.ok(copy.errors[error], `${lang} translation is missing ${error} validation copy`);
  }
}

const yeastUiStart = indexSource.indexOf('testID={`yeast-settings-${method}`}');
const yeastUiEnd = indexSource.indexOf('testID="sponge-settings"', yeastUiStart);
const yeastUi = indexSource.slice(yeastUiStart, yeastUiEnd);
assert.ok(yeastUi.includes('yeastSettingsCopy.quantity'));
assert.ok(yeastUi.includes('format(idealYeastQuantity)'), 'The calculator must display the automatic recommendation');
assert.ok(!yeastUi.includes('format(activeYeastQuantity)'), 'The calculator must not display the manual recipe quantity as its recommendation');
assert.ok(yeastUi.includes('value={activeYeastSettings.manualInput}'), 'Manual entry must remain a separate control');
assert.ok(yeastUi.includes('testID={`manual-yeast-${method}-minus`}'), 'Manual yeast must have a decrement stepper');
assert.ok(yeastUi.includes('testID={`manual-yeast-${method}-plus`}'), 'Manual yeast must have an increment stepper');
assert.ok(yeastUi.includes('0.05 g'), 'Manual yeast stepper must change in 0.05 g increments');
assert.match(yeastUi, /method === 'sponge' \? \([\s\S]*?manual-yeast-\$\{method\}-minus/);
assert.ok(indexSource.includes('!isBeginner && precise && grams > 0 && Math.round(grams * 100) === 0'), 'Tiny positive yeast must not render as zero');
for (const removedCopy of ['yeastSettingsCopy.percentage', 'yeastSettingsCopy.automaticHelp', 'yeastSettingsCopy.conversionHelp', 'yeastSettingsCopy.spongeHelp', 'automaticReference', 'automaticCaution']) {
  assert.ok(!yeastUi.includes(removedCopy), `Yeast UI must not display ${removedCopy}`);
}
assert.ok(indexSource.includes('{methodExpanded && !isBeginner ? <>'), 'Beginner must remain outside the Pro yeast settings UI');
assert.ok(indexSource.includes("yeastMode: 'automatic',\n      manualYeastGrams: 0"), 'Recommendation must be calculated independently of manual input');
assert.ok(indexSource.includes('manualYeastGrams: !isBeginner ? activeYeastSettings.manualGrams : 0'), 'Recipe calculation must retain the selected manual quantity');
assert.ok(indexSource.includes('yeastQuantity: activeYeastQuantity'), 'Saved recipe must retain the actual calculated yeast quantity');

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
