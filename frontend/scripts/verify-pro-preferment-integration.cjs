#!/usr/bin/env node

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const vm = require('node:vm');

const root = path.join(path.dirname(module.filename), '..');
const route = fs.readFileSync(path.join(root, 'app', '(tabs)', 'index.tsx'), 'utf8');
const sourceFile = ts.createSourceFile('index.tsx', route, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

function compile(source) {
  return ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
}

function load(file, dependencies = {}) {
  const module = { exports: {} };
  vm.runInNewContext(compile(fs.readFileSync(path.join(root, file), 'utf8')), {
    module, exports: module.exports,
    require: (name) => {
      assert.ok(name in dependencies, `unexpected dependency: ${name}`);
      return dependencies[name];
    },
  });
  return module.exports;
}

const alignment = load('src/proMethods/prefermentWaterAlignment.ts');
const model = load('src/proMethods/bigaPoolish.ts');
const translations = load('src/i18n/translations.ts').translations;
const { doughCalc } = load('src/calculator.ts', { './proMethods/bigaPoolish': model });

function declaration(name) {
  let result;
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(sourceFile) === name) result = node.initializer.getText(sourceFile);
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  assert.ok(result, `missing declaration: ${name}`);
  return result;
}

function harness(initial = {}) {
  const state = {
    method: 'biga', bigaPct: 50, poolishPct: 35, bigaHydrationPct: 50, poolishHydrationPct: 100,
    hydration: 60, bigaEnabled: true, poolishEnabled: true, ...initial, poolishHydrationPct: 100,
  };
  const context = {
    ...state, ...alignment, isBeginner: false, loadedIsBeginner: false,
    minimumTotalHydration: initial.minimumTotalHydration ?? 60,
    useCallback: (callback) => callback,
    parsePreferredYeastType: () => null,
    parseMixingSelection: () => null,
    isOvenType: () => false,
    isValidProTrayDimension: () => false,
    isValidProPrefermentShare: (value) => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100,
    restorePoolishPhaseSettings: () => null,
    isValidSpongeWaterAllocation: () => true,
    restoreMethodYeastSettings: () => ({}),
    getCachedPreferredYeastType: () => 'fresh',
    SPONGE_YEAST_REFERENCE: { flourShare: 30 },
    console,
  };
  for (const match of route.matchAll(/\b(set[A-Z]\w*)\(/g)) {
    const name = match[1];
    const key = name[3].toLowerCase() + name.slice(4);
    context[name] = (value) => { state[key] = typeof value === 'function' ? value(state[key]) : value; };
  }
  return { state, context };
}

function runDeclaration(name, context, ...args) {
  const script = compile(`const tested = ${declaration(name)}; tested(...args);`);
  vm.runInNewContext(script, { ...context, args });
}

function runCombinedToggle(context) {
  const start = route.indexOf('                const anchorSide =', route.indexOf('testID="method-biga-poolish"'));
  const end = route.indexOf('                setShowMixSteps(true);', start);
  assert.ok(start >= 0 && end > start);
  vm.runInNewContext(compile(route.slice(start, end)), context);
}

for (const [value, expected] of [[undefined, 50], [NaN, 50], [20, 45], [45, 45], [50, 50], [55, 55], [90, 55]]) {
  assert.equal(alignment.normalizeProBigaHydrationPct(value), expected);
}
assert.deepEqual({ ...alignment.normalizeComplementaryPrefermentShares(35, 'poolish') }, { bigaPct: 65, poolishPct: 35 });
assert.deepEqual({ ...alignment.normalizeComplementaryPrefermentShares(80, 'biga') }, { bigaPct: 80, poolishPct: 20 });
for (const lang of ['hr', 'en', 'de', 'sl']) {
  assert.match(translations[lang].calc.proPrefermentWaterWarning, /poolish/i);
  assert.doesNotMatch(translations[lang].calc.proPrefermentWaterWarning, /hydration will remain unchanged|bleibt unverändert|ostaje nepromijenjena|ostane nespremenjena/i);
}
assert.equal(alignment.getMinimumTotalHydrationPct(50, 35, 55, 120), 70);

for (const name of ['updateProPrefermentShare', 'updateProPrefermentHydration', 'updateProHydration']) {
  assert.doesNotMatch(declaration(name), /repairPrefermentHydration/);
}
{
  const { state, context } = harness();
  runDeclaration('updateProPrefermentShare', context, 'poolish', 50);
  assert.deepEqual([state.bigaPct, state.poolishPct, state.hydration, state.poolishHydrationPct], [50, 50, 75, 100]);
  assert.equal(state.hydrationAdjusted, true);
}
{
  const { state, context } = harness();
  runDeclaration('updateProPrefermentShare', context, 'biga', 80);
  assert.deepEqual([state.bigaPct, state.poolishPct, state.hydration], [80, 20, 60]);
  assert.equal(state.prefermentAdjustmentNotice, null);
}
{
  const { state, context } = harness({ hydration: 65 });
  runDeclaration('updateProPrefermentHydration', context, 55);
  assert.deepEqual([state.bigaPct, state.poolishPct, state.bigaHydrationPct, state.poolishHydrationPct, state.hydration], [50, 35, 55, 100, 65]);
}
{
  const { state, context } = harness({ bigaPct: 20, poolishPct: 80, hydration: 70 });
  runDeclaration('updateProPrefermentHydration', context, 55);
  assert.deepEqual([state.bigaPct, state.poolishPct, state.bigaHydrationPct, state.poolishHydrationPct, state.hydration], [20, 80, 55, 100, 91]);
}
{
  const { state, context } = harness({ hydration: 70, minimumTotalHydration: 70 });
  runDeclaration('updateProHydration', context, 69);
  assert.equal(state.hydration, 70);
  assert.equal(state.hydrationAdjusted, true);
}

const combinedSettings = { method: 'biga', bigaEnabled: true, poolishEnabled: true, bigaPct: 50, poolishPct: 35, bigaHydrationPct: 80, poolishHydrationPct: 120, hydration: 60 };
{
  const { state, context } = harness({ bigaEnabled: false, poolishEnabled: false, bigaHydrationPct: 55, poolishHydrationPct: 120 });
  runCombinedToggle(context);
  assert.deepEqual([state.bigaEnabled, state.poolishEnabled, state.bigaPct, state.poolishPct, state.poolishHydrationPct, state.hydration], [true, true, 50, 50, 100, 78]);
  assert.equal(state.hydrationAdjusted, true);
}
{
  const { state, context } = harness({ method: 'poolish', bigaEnabled: false, poolishEnabled: false });
  runCombinedToggle(context);
  assert.deepEqual([state.bigaPct, state.poolishPct], [65, 35]);
}
for (const mode of ['settings', 'recipe']) {
  const { state, context } = harness();
  if (mode === 'recipe') {
    runDeclaration('applyRecipe', context, { settings: combinedSettings });
  } else {
    const start = route.indexOf('          setBigaEnabled(typeof saved.bigaEnabled');
    const end = route.indexOf('          if (typeof saved.saltPct', start);
    assert.ok(start >= 0 && end > start);
    vm.runInNewContext(compile(route.slice(start, end)), { ...context, saved: combinedSettings });
  }
  assert.deepEqual([state.bigaEnabled, state.poolishEnabled, state.bigaPct, state.poolishPct, state.bigaHydrationPct, state.poolishHydrationPct, state.hydration], [true, true, 50, 50, 55, 100, 78], `${mode} normalizes shares and fixes Poolish hydration`);
  assert.equal(state.hydrationAdjusted, true);
}
{
  const { state, context } = harness();
  runDeclaration('applyRecipe', context, { settings: { ...combinedSettings, bigaPct: 20, poolishPct: 80, bigaHydrationPct: 20, poolishHydrationPct: 200 } });
  assert.deepEqual([state.bigaPct, state.poolishPct, state.bigaHydrationPct, state.poolishHydrationPct, state.hydration], [20, 80, 45, 100, 89]);
}
{
  const { state, context } = harness({ bigaHydrationPct: 45 });
  runDeclaration('applyRecipe', context, { settings: { ...combinedSettings, bigaHydrationPct: undefined, hydration: 80 } });
  assert.equal(state.bigaHydrationPct, 50);
  assert.equal(state.hydration, 80);
}
{
  const { state, context } = harness({ poolishHydrationPct: 100 });
  runDeclaration('applyRecipe', context, { settings: { ...combinedSettings, poolishHydrationPct: 300 } });
  assert.equal(state.poolishHydrationPct, 100);
  assert.equal(state.hydration, 78);
}

assert.match(route, /testID="method-biga-poolish"[\s\S]{0,1000}getMinimumTotalHydrationPct\(shares\.bigaPct, shares\.poolishPct, bigaHydrationPct, poolishHydrationPct\)/);
assert.match(route, /testID="biga-hydration-minus"[^\n]*MIN_PRO_BIGA_HYDRATION_PCT/);
assert.match(route, /testID="biga-hydration-plus"[^\n]*MAX_PRO_BIGA_HYDRATION_PCT/);
assert.match(route, /const poolishHydrationPct = 100;/);
assert.doesNotMatch(route, /setPoolishHydrationPct|testID="poolish-hydration/);
assert.match(route, /testID="pro-hydration-adjusted"/);
assert.doesNotMatch(route, /repairPrefermentHydration\(/);

const options = {
  pizzas: 1, ballWeight: 260, hydration: 70, saltPct: 2.8, oilPct: 0,
  roomHours: 4, roomTemp: 22, fridgeHours: 24, fridgeTemp: 4, prefermentHours: 16,
  yeastType: 'fresh', mixing: 'home', flourType: 'caputo00', method: 'biga',
  bigaEnabled: true, poolishEnabled: true, bigaPct: 50, poolishPct: 35,
  bigaHydrationPct: 55, poolishHydrationPct: 120,
};
const calculated = doughCalc(options);
assert.ok(calculated.main.water >= 0);
assert.equal(calculated.bigaPoolishModel.mathStatus, 'valid');
const impossible = doughCalc({ ...options, hydration: 95, bigaPct: 20, poolishPct: 80, bigaHydrationPct: 50, poolishHydrationPct: 200 });
assert.equal(impossible.bigaPoolishModel.mathStatus, 'negative-remainder');

async function verifyCorrectionEffect() {
  let effect;
  function visit(node) {
    if (ts.isCallExpression(node) && node.expression.getText(sourceFile) === 'useEffect'
      && node.getText(sourceFile).includes('proPrefermentWaterInfeasible')
      && node.getText(sourceFile).includes('combinedMinimumTotalHydration')) effect = node.arguments[0].getText(sourceFile);
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  assert.ok(effect, 'calculator correction effect exists');
  for (const [hydration, minimum, infeasible, cancel, expected] of [
    [60, 70, false, false, 70],
    [70, 70, true, false, 71],
    [95, 170, true, false, 95],
    [60, 70, false, true, 60],
  ]) {
    const { state, context } = harness({ hydration });
    Object.assign(context, { combinedPrefermentsActive: true, proPrefermentPercentagesInvalid: false, proPrefermentWaterInfeasible: infeasible, combinedMinimumTotalHydration: minimum });
    const cleanup = vm.runInNewContext(compile(`(${effect})()`), context);
    if (cancel) cleanup();
    await Promise.resolve();
    assert.equal(state.hydration, expected);
  }
}

verifyCorrectionEffect().then(() => {
  console.log('PASS: combined hydration interactions, restores, bounds and calculator model');
}).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});