#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
function loadTypeScriptModule(filePath) {
  const source = fs.readFileSync(filePath, 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const loaded = { exports: {} };
  new Function('module', 'exports', 'require', `${compiled}\nreturn module.exports;`)(
    loaded,
    loaded.exports,
    (request) => {
      if (!request.startsWith('.')) throw new Error(`Unexpected runtime import: ${request}`);
      const local = path.resolve(path.dirname(filePath), `${request}.ts`);
      return loadTypeScriptModule(local);
    },
  );
  return loaded.exports;
}

const { calculatePoolishExposure, doughCalc, getPoolishFermentationSchedule } = loadTypeScriptModule(
  path.join(scriptDirectory, '..', 'src', 'calculator.ts'),
);
const frontendRoot = path.join(scriptDirectory, '..');
const calculatorUiSource = fs.readFileSync(path.join(frontendRoot, 'app', '(tabs)', 'index.tsx'), 'utf8');
const plannerUiSource = fs.readFileSync(path.join(frontendRoot, 'app', '(tabs)', 'planner.tsx'), 'utf8');
const isRangeError = (error) => error?.name === 'RangeError';

const standard = {
  rtTemperatureC: 22,
  ctTemperatureC: 4,
  rtHours: 12,
  ctHours: 24,
  roomHours: 2,
  roomTemp: 22,
  fridgeHours: 18,
  fridgeTemp: 4,
  roomAfterFridgeHours: 2,
};
const cases = [
  { mode: 'rt', expected: [['room', 22, 12]] },
  { mode: 'ct', expected: [['fridge', 4, 24]] },
  { mode: 'rt-ct', expected: [['room', 22, 12], ['fridge', 4, 24]] },
  { mode: 'ct-rt', expected: [['fridge', 4, 24], ['room', 22, 12]] },
];

for (const testCase of cases) {
  const schedule = getPoolishFermentationSchedule({ ...standard, mode: testCase.mode });
  const preferment = schedule.phases.filter((phase) => phase.kind === 'preferment');
  assert.equal(JSON.stringify(preferment.map(({ environment, temperature, hours }) => [environment, temperature, hours])), JSON.stringify(testCase.expected),
    `${testCase.mode}: preserve explicit Poolish phase order`);
  assert.equal(schedule.poolishMode, testCase.mode);
  assert.equal(schedule.prefermentHours, testCase.expected.reduce((sum, phase) => sum + phase[2], 0));
  assert.equal(schedule.phases.reduce((sum, phase) => sum + phase.hours, 0), schedule.prefermentHours + 22);
}

for (const temperature of [20, 24]) {
  assert.equal(getPoolishFermentationSchedule({ ...standard, mode: 'rt', rtTemperatureC: temperature }).phases[0].temperature, temperature);
}
for (const temperature of [4, 6]) {
  assert.equal(getPoolishFermentationSchedule({ ...standard, mode: 'ct', ctTemperatureC: temperature }).phases[0].temperature, temperature);
}

const rtThenCt = getPoolishFermentationSchedule({ ...standard, mode: 'rt-ct' });
const ctThenRt = getPoolishFermentationSchedule({ ...standard, mode: 'ct-rt' });
const rtThenCtExposure = calculatePoolishExposure(rtThenCt.phases.filter((phase) => phase.kind === 'preferment'));
const ctThenRtExposure = calculatePoolishExposure(ctThenRt.phases.filter((phase) => phase.kind === 'preferment'));
assert.equal(rtThenCtExposure, ctThenRtExposure, 'the current additive model does not invent an unsupported sequence effect');

const recipeOptions = {
  pizzas: 1,
  ballWeight: 1000,
  hydration: 62,
  saltPct: 2.8,
  oilPct: 0,
  method: 'poolish',
  poolishPct: 35,
  poolishHydrationPct: 100,
  yeastType: 'fresh',
  roomHours: standard.roomHours,
  roomTemp: standard.roomTemp,
  fridgeHours: standard.fridgeHours,
  fridgeTemp: standard.fridgeTemp,
};
const rtThenCtRecipe = doughCalc({
  ...recipeOptions,
  fermentationSchedule: rtThenCt,
});
const ctThenRtRecipe = doughCalc({
  ...recipeOptions,
  fermentationSchedule: ctThenRt,
});
for (const [mode, recipe] of [['RT->CT', rtThenCtRecipe], ['CT->RT', ctThenRtRecipe]]) {
  assert.equal(recipe.preferment.flour + recipe.main.flour, recipe.total.flour, `${mode}: flour balance`);
  assert.equal(recipe.preferment.water + recipe.main.water, recipe.total.water, `${mode}: water balance`);
  assert.ok(recipe.preferment.water >= 0 && recipe.main.water >= 0, `${mode}: nonnegative water`);
  assert.equal(recipe.poolishYeastGrams, recipe.preferment.yeast, `${mode}: Poolish yeast summary matches the recipe`);
  assert.equal(recipe.finalDoughYeastGrams, recipe.main.yeast, `${mode}: final-dough yeast summary matches the recipe`);
  assert.equal(Math.round((recipe.poolishYeastGrams + recipe.finalDoughYeastGrams) * 100) / 100, recipe.total.yeast,
    `${mode}: separately calculated yeast quantities sum to the total`);
}
assert.equal(rtThenCtRecipe.eTotal, ctThenRtRecipe.eTotal, 'swapping equal RT/CT durations retains equal provisional exposure');
assert.equal(rtThenCtRecipe.poolishYeastGrams, ctThenRtRecipe.poolishYeastGrams, 'swapping equal RT/CT durations retains equal Poolish yeast');
assert.equal(rtThenCtRecipe.finalDoughYeastGrams, ctThenRtRecipe.finalDoughYeastGrams, 'swapping equal RT/CT durations retains equal final-dough yeast');
const manualRecipe = doughCalc({
  ...recipeOptions,
  yeastMode: 'manual',
  manualYeastGrams: 5,
  fermentationSchedule: rtThenCt,
});
assert.equal(manualRecipe.total.yeast, 5, 'manual yeast retains the entered total quantity');
assert.equal(manualRecipe.poolishYeastGrams, undefined, 'manual yeast does not claim a separate automatic phase estimate');

assert.match(calculatorUiSource, /poolishFermentationMode, poolishRtHours, poolishCtHours, poolishRtTemperatureC, poolishCtTemperatureC/,
  'recipe persistence includes all four Poolish mode inputs');
assert.match(calculatorUiSource, /restorePoolishPhaseSettings\((saved|settings)\)/,
  'saved Poolish fermentation mode is restored');
assert.match(plannerUiSource, /getPoolishPlannerFallbackSchedule\(/,
  'Planner fallback reconstructs the explicit ordered Poolish schedule');
assert.match(calculatorUiSource, /poolish-model-limitation/,
  'Calculator surfaces the provisional-model limitation');
assert.match(calculatorUiSource, /Platform\.OS === 'web' && process\.env\.EXPO_PUBLIC_PREVIEW_COMMIT/,
  'preview build marker is gated to Web builds with an explicit preview commit');
assert.match(calculatorUiSource, /WEB TEST BUILD .*EXPO_PUBLIC_PREVIEW_COMMIT\.slice\(0, 7\)/,
  'preview build marker displays the short commit SHA');
for (const language of [
  'The yeast estimate is provisional',
  'Die Hefeschätzung ist vorläufig',
  'Ocena kvasa je začasna',
  'Procjena kvasca je privremena',
]) {
  assert.ok(calculatorUiSource.includes(language), `Poolish model limitation is localized: ${language}`);
}

for (const invalid of [
  { mode: 'rt', rtTemperatureC: 19 },
  { mode: 'rt', rtTemperatureC: 25 },
  { mode: 'ct', ctTemperatureC: 3 },
  { mode: 'ct', ctTemperatureC: 7 },
  { mode: 'rt', rtHours: -1 },
  { mode: 'rt', rtHours: 49 },
  { mode: 'ct', ctHours: -1 },
  { mode: 'ct', ctHours: 121 },
  { mode: 'rt', rtHours: 0 },
  { mode: 'ct', ctHours: 0 },
  { mode: 'rt-ct', rtHours: 0 },
  { mode: 'ct-rt', ctHours: 0 },
]) {
  assert.throws(() => getPoolishFermentationSchedule({ ...standard, ...invalid }), isRangeError, JSON.stringify(invalid));
}
assert.throws(() => getPoolishFermentationSchedule({ ...standard, mode: 'invalid' }), isRangeError);
assert.throws(() => calculatePoolishExposure([]), isRangeError);
assert.throws(() => calculatePoolishExposure([{ hours: -1, temperature: 22 }]), isRangeError);
assert.throws(() => calculatePoolishExposure([{ hours: 2, temperature: 25 }]), isRangeError);

console.log('Poolish mode schedule regression passed: ordered RT, CT, RT->CT, CT->RT phases, additive exposure, and input boundaries.');
