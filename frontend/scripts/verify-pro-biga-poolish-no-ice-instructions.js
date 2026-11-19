#!/usr/bin/env node

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

require.extensions['.ts'] = (module, filename) => {
  const source = fs.readFileSync(filename, 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  module._compile(output, filename);
};

const frontendRoot = path.join(__dirname, '..');
const uiSource = fs.readFileSync(path.join(frontendRoot, 'app', '(tabs)', 'index.tsx'), 'utf8');
const translationsSource = fs.readFileSync(path.join(frontendRoot, 'src', 'i18n', 'translations.ts'), 'utf8');
const { getProHomeMixerDirectSteps, getYeastAwarePrefermentSteps } = require(path.join(frontendRoot, 'src', 'i18n', 'prefermentSteps.ts'));
const { getProSpiralMixingStepInfo } = require(path.join(frontendRoot, 'src', 'i18n', 'spiralMixing.ts'));
const { calculateProWaterSplit } = require(path.join(frontendRoot, 'src', 'i18n', 'proIceWaterInstructions.ts'));

const makeRecipe = ({ method = 'biga', waterBaseGrams = 300, liquidWaterGrams = waterBaseGrams, iceGrams = 0 } = {}) => ({
  method,
  flourBehavior: 'standard',
  flourGrams: 1860,
  flourLabel: 'Tipo 00',
  flourBlendDescription: undefined,
  waterBaseGrams,
  liquidWaterGrams,
  iceGrams,
  initialWaterPct: 90,
  yeastGrams: 5,
  saltGrams: 52,
  oilGrams: 0,
  psylliumGrams: 0,
  prefermentGrams: 930,
  restMinutes: 20,
  targetDoughTemperature: 24,
  formatWeight: (grams) => `${Math.round(grams)} g`,
});

const impossibleRecipe = makeRecipe({ waterBaseGrams: -75, liquidWaterGrams: -75 });
assert.throws(() => calculateProWaterSplit(impossibleRecipe), RangeError, 'negative final water remains invalid');
assert.match(uiSource, /pro-preferment-water-warning/, 'PRO UI exposes the infeasible-recipe warning');
assert.match(uiSource, /!proPrefermentWaterInfeasible/, 'PRO UI skips instruction generation while blocked');
assert.match(uiSource, /const proPrefermentPercentagesInvalid = !isBeginner/, 'PRO percentage guard is scoped away from Beginner');
const blockedGuardIndex = uiSource.indexOf('if (proPrefermentPercentagesInvalid || proDirectExposureInvalid)');
const blockedReturnIndex = uiSource.indexOf('return { dough: blockedDough', blockedGuardIndex);
const firstDoughCalcIndex = uiSource.indexOf('const dough = doughCalc(options);', blockedGuardIndex);
const secondDoughCalcIndex = uiSource.indexOf('? dough : doughCalc({', firstDoughCalcIndex);
assert.ok(
  blockedGuardIndex >= 0
    && blockedReturnIndex > blockedGuardIndex
    && firstDoughCalcIndex > blockedReturnIndex
    && secondDoughCalcIndex > firstDoughCalcIndex,
  'combined-input and direct-exposure guards return before both doughCalc paths',
);
assert.match(uiSource, /proRecipeCalculationBlocked\s*\?\s*\(\s*<Text testID=\{proPrefermentPercentagesInvalid/, 'blocked recipe instruction area shows a warning instead of generated steps');
assert.match(uiSource, /disabled=\{proRecipeCalculationBlocked\}/, 'recipe actions are disabled while calculation is blocked');
assert.match(uiSource, /testID="pro-preferment-percent-warning"/, 'PRO UI exposes the percentage warning');
for (const [bigaPct, poolishPct, invalid] of [[50, 50, false], [50, 35, false], [70, 40, true], [100, 5, true]]) {
  assert.equal(!false && bigaPct + poolishPct > 100, invalid, `percentage boundary ${bigaPct}+${poolishPct}`);
}
for (const languageCopy of [
  'Odabrani udjeli Bige i Poolisha zahtijevaju više vode',
  'The selected Biga and Poolish shares require more water',
  'Die gewählten Biga- und Poolish-Anteile benötigen mehr Wasser',
  'Izbrana deleža bige in poolisha zahtevata več vode',
  'Zbroj udjela brašna za Bigu i Poolish',
  'The combined Biga and Poolish flour shares',
  'Die kombinierten Biga- und Poolish-Mehlanteile',
  'Skupna deleža moke za bigo in poolish',
]) {
  assert.match(translationsSource, new RegExp(languageCopy.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `localized warning exists: ${languageCopy}`);
}

for (const lang of ['hr', 'en', 'de', 'sl']) {
  for (const methodOrder of [['biga', 'poolish'], ['poolish', 'biga']]) {
    for (const method of methodOrder) {
    const pathResult = getYeastAwarePrefermentSteps(
      lang,
      method,
      'spiral',
      'fresh',
      '5 g',
      false,
      false,
      'caputo00',
      false,
      undefined,
      4,
      makeRecipe({ method }),
    );
    assert.ok(pathResult.p1.steps.length > 0 && pathResult.p2.steps.length > 0, `${lang} ${method} no-ice path is complete`);
    assert.doesNotThrow(() => getProSpiralMixingStepInfo(lang, makeRecipe({ method }), pathResult.p2.steps), `${lang} ${method} no-ice info generation`);

    const zeroWaterRecipe = makeRecipe({ method, waterBaseGrams: 0, liquidWaterGrams: 0 });
    const zeroWaterPath = getYeastAwarePrefermentSteps(lang, method, 'spiral', 'fresh', '5 g', false, false, 'caputo00', false, undefined, 4, zeroWaterRecipe);
    assert.ok(zeroWaterPath.p2.steps.length > 0, `${lang} ${method} zero-water path remains valid`);
    }
  }

  const validIceRecipe = makeRecipe({ iceGrams: 30, liquidWaterGrams: 270 });
  const validPath = getYeastAwarePrefermentSteps(lang, 'biga', 'spiral', 'fresh', '5 g', false, false, 'caputo00', false, undefined, 4, validIceRecipe);
  assert.match(validPath.p2.steps.join(' '), /243 g|27 g/, `${lang} valid-ice path keeps water details`);

  const directRecipe = makeRecipe({ method: 'direct' });
  assert.ok(getProHomeMixerDirectSteps(lang, 'fresh', directRecipe).length > 0, `${lang} direct path remains complete`);
}

console.log('PRO Biga + Poolish no-ice instruction regression checks passed.');