#!/usr/bin/env node

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const frontendRoot = path.join(__dirname, '..');
require.extensions['.ts'] = (module, filename) => {
  const source = fs.readFileSync(filename, 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  module._compile(output, filename);
};

const {
  doughCalc,
  isEffectivelyGlutenFreeBlend,
  isProMethodAllowedForFlour,
} = require(path.join(frontendRoot, 'src', 'calculator.ts'));
const { translations } = require(path.join(frontendRoot, 'src', 'i18n', 'translations.ts'));
const indexSource = fs.readFileSync(path.join(frontendRoot, 'app', '(tabs)', 'index.tsx'), 'utf8');
const plannerSource = fs.readFileSync(path.join(frontendRoot, 'app', '(tabs)', 'planner.tsx'), 'utf8');

const cases = [
  ['glutenFree', 'glutenFree', 70, true, 'pure GF blend at a mixed percentage'],
  ['glutenFree', 'caputo00', 100, true, '100/0 GF A boundary'],
  ['caputo00', 'glutenFree', 0, true, '0/100 GF B boundary'],
  ['glutenFree', 'caputo00', 70, false, 'mixed GF and gluten-containing blend'],
  ['caputo00', 'glutenFree', 70, false, 'mixed gluten-containing and GF blend'],
  ['caputo00', 'manitoba', 70, false, 'non-GF blend'],
];

for (const [blendA, blendB, pctA, expected, label] of cases) {
  assert.equal(isEffectivelyGlutenFreeBlend(blendA, blendB, pctA), expected, label);
}
assert.equal(isEffectivelyGlutenFreeBlend('caputo00', 'glutenFree', 120), false, 'blend percentage is bounded at 100');
assert.equal(isEffectivelyGlutenFreeBlend('glutenFree', 'caputo00', -5), false, 'blend percentage is bounded at 0');
assert.equal(isEffectivelyGlutenFreeBlend('glutenFree', 'caputo00', Number.NaN), false, 'invalid blend percentage is not classified as GF');

const methods = ['direct', 'biga', 'poolish'];
const styles = ['neapolitan', 'romana-tonda', 'romana-teglia', 'ny_style'];
const languages = ['hr', 'en', 'de', 'sl'];
const directOnlyMessages = {
  hr: 'Za bezglutensko brašno ili mješavinu dostupna je samo direktna metoda.',
  en: 'Only the direct method is available with gluten-free flour or blends.',
  de: 'Mit glutenfreiem Mehl oder einer glutenfreien Mischung ist nur die direkte Methode verfügbar.',
  sl: 'Pri brezglutenski moki ali mešanici je na voljo samo direktna metoda.',
};
for (const style of styles) {
  for (const lang of languages) {
    assert.ok(translations[lang].calc.direct, `${style}/${lang}: localized Direct method label`);
    assert.ok(translations[lang].calc.biga, `${style}/${lang}: localized Biga method label`);
    assert.ok(translations[lang].calc.poolish, `${style}/${lang}: localized Poolish method label`);
    assert.ok(indexSource.includes(directOnlyMessages[lang]), `${style}/${lang}: localized GF Blend method guidance`);
    const pureBlendMethods = methods.filter((method) => (
      isProMethodAllowedForFlour(method, 'custom', 'glutenFree', 'glutenFree', 70)
    ));
    assert.deepEqual(pureBlendMethods, ['direct'], `${style}/${lang}: a 100% GF blend only allows Direct`);
    const wheatBlendMethods = methods.filter((method) => (
      isProMethodAllowedForFlour(method, 'custom', 'glutenFree', 'caputo00', 70)
    ));
    assert.deepEqual(wheatBlendMethods, methods, `${style}/${lang}: a blend containing wheat retains all methods`);
    for (const method of ['biga', 'poolish']) {
      const allowed = isProMethodAllowedForFlour(method, 'custom', 'glutenFree', 'glutenFree', 70);
      assert.equal(allowed, false, `${style}/${lang}: ${method} is unavailable for a pure GF blend`);
      assert.equal(allowed ? method : 'direct', 'direct',
        `${style}/${lang}: selecting ${method} then changing to pure GF normalizes to Direct`);
    }
  }
}

assert.equal(isProMethodAllowedForFlour('direct', 'custom', 'glutenFree', 'glutenFree', 70), true);
assert.equal(isProMethodAllowedForFlour('biga', 'glutenFree', 'caputo00', 'wholeWheat', 70), false);
assert.equal(isProMethodAllowedForFlour('poolish', 'glutenFree', 'caputo00', 'wholeWheat', 70), false);
assert.equal(isProMethodAllowedForFlour('biga', 'custom', 'glutenFree', 'caputo00', 70), true);
assert.equal(isProMethodAllowedForFlour('poolish', 'custom', 'caputo00', 'glutenFree', 70), true);

const common = {
  pizzas: 2,
  ballWeight: 250,
  hydration: 75,
  saltPct: 2.8,
  oilPct: 0,
  method: 'direct',
  roomHours: 2,
  roomTemp: 21,
  fridgeHours: 0,
  fridgeTemp: 4,
};
const standard = doughCalc({ ...common, flourType: 'caputo00' });
const glutenFree = doughCalc({ ...common, flourType: 'glutenFree' });
const glutenFreeBiga = doughCalc({ ...common, method: 'biga', flourType: 'glutenFree' });
const glutenFreePoolish = doughCalc({ ...common, method: 'poolish', flourType: 'glutenFree' });
const normalizedBigaForGfBlend = doughCalc({
  ...common,
  method: isProMethodAllowedForFlour('biga', 'custom', 'glutenFree', 'glutenFree', 70) ? 'biga' : 'direct',
  flourType: 'glutenFree',
});
const normalizedPoolishForGfBlend = doughCalc({
  ...common,
  method: isProMethodAllowedForFlour('poolish', 'custom', 'glutenFree', 'glutenFree', 70) ? 'poolish' : 'direct',
  flourType: 'glutenFree',
});
assert.equal(standard.total.psyllium, 0, 'non-GF calculation does not add psyllium');
assert.ok(glutenFree.total.psyllium > 0, 'effective-GF calculation includes the existing 2% psyllium rule');
assert.ok(glutenFreeBiga.total.psyllium > 0, 'supported GF Biga calculation includes psyllium');
assert.ok(glutenFreePoolish.total.psyllium > 0, 'supported GF Poolish calculation includes psyllium');
assert.deepEqual(normalizedBigaForGfBlend, glutenFree, 'a stored Biga selection recalculates as Direct for a pure GF blend');
assert.deepEqual(normalizedPoolishForGfBlend, glutenFree, 'a stored Poolish selection recalculates as Direct for a pure GF blend');
assert.equal(glutenFree.total.psyllium, Math.round(glutenFree.total.flour * 0.02), 'GF psyllium remains at the existing 2% rate');
assert.ok(Math.abs(glutenFree.total.water / glutenFree.total.flour - 0.75) < 0.01, 'GF classification does not alter the selected hydration');
assert.notEqual(glutenFree.total.flour, standard.total.flour, 'existing baker-percentage totals account for psyllium');

assert.match(indexSource, /const isProGlutenFreeBlend = !isBeginner && isCustom && blendPercentageReady && isEffectivelyGlutenFreeBlend\(blendA, blendB, blendPctA\)/);
assert.match(indexSource, /flourType: isProEffectivelyGlutenFree \? 'glutenFree' : flour/);
assert.match(indexSource, /const changeFlour = \(f: FlourType\) => \{\s*setFlour\(f\);\s*if \(f === 'glutenFree'\) \{\s*setMethod\('direct'\);\s*if \(!isBeginner\) \{\s*setBigaEnabled\(false\);\s*setPoolishEnabled\(false\);/);
assert.match(indexSource, /isProMethodAllowedForFlour\(selectedMethod, flour, blendA, blendB, blendPctA\)/);
assert.match(indexSource, /if \(isProEffectivelyGlutenFree\) \{\s*\/\/ eslint-disable-next-line react-hooks\/set-state-in-effect[^\n]*\n\s*if \(selectedMethod !== 'direct'\) setMethod\('direct'\);[\s\S]*?if \(bigaEnabled\) setBigaEnabled\(false\);[\s\S]*?if \(poolishEnabled\) setPoolishEnabled\(false\);\s*return;/);
assert.match(indexSource, /\}, \[isBeginner, isProEffectivelyGlutenFree, selectedMethod, bigaEnabled, poolishEnabled, flour, blendA, blendB, blendPctA, pizzaStyle\]\);/);
assert.match(indexSource, /setSharedCalculatorPlanSettings\(\{\s*pizzaStyle,\s*romanFormat,\s*method,\s*bigaEnabled,\s*poolishEnabled,/);
assert.match(plannerSource, /if \(isBeginner \|\| method !== 'biga'\) return \[\];/);
assert.match(plannerSource, /if \(sharedCalculatorPlanSettings\?\.poolishEnabled\)/);
assert.match(indexSource, /if \(!isProMethodAllowedForFlour\(selectedMethod, flour, a, b, p\)\) setMethod\('direct'\)/);
assert.match(indexSource, /isProMethodAllowedForFlour\(m\.k, flour, blendA, blendB, blendPctA\)/);
assert.match(indexSource, /isProMethodAllowedForFlour\(selectedMethod, flour, blendA, blendB, blendPctA\)\s*\?\s*selectedMethod\s*:\s*'direct'/);
assert.match(indexSource, /const \{ dough, idealYeastQuantity \} = useMemo\([\s\S]*?const options = \{[\s\S]*?saltPct, oilPct, method,[\s\S]*?doughCalc\(options\)/);
assert.match(indexSource, /isProEffectivelyGlutenFree \? <Text style=\{styles\.hint\}>/);
assert.match(indexSource, /alignProDirectSteps\(generatedDetailedDirectSteps, proTextReferenceSteps, \{\s*isProGlutenFreeBlend,\s*isProEffectivelyGlutenFree,/);
assert.match(indexSource, /getDetailedDirectSteps\([\s\S]*?!beginnerTextMode && isProEffectivelyGlutenFree \? 'glutenFree' : flour/);
assert.match(indexSource, /getDetailedDirectStepsLocalized\([\s\S]*?!beginnerTextMode && isProEffectivelyGlutenFree \? 'glutenFree' : flour/);
assert.match(indexSource, /getYeastAwarePrefermentSteps\(lang, 'biga'[\s\S]*?isProEffectivelyGlutenFree/);
assert.match(indexSource, /getYeastAwarePrefermentSteps\(lang, 'poolish'[\s\S]*?isProEffectivelyGlutenFree/);
assert.match(indexSource, /const isWorkflowGlutenFree = flour === 'glutenFree' \|\| isProGlutenFreeBlend/);
assert.match(indexSource, /psylliumGrams: method === 'direct' && isWorkflowGlutenFree \? psylliumGrams : 0/);
assert.match(indexSource, /const proSpiralRecipe: SpiralMixingRecipe \| undefined = !isBeginner/);
assert.match(indexSource, /getYeastAwarePrefermentSteps\(lang, 'biga'[\s\S]*?fridgeTemp, proSpiralRecipe\)/);
assert.match(indexSource, /getYeastAwarePrefermentSteps\(lang, 'poolish'[\s\S]*?fridgeTemp, proSpiralRecipe\)/);
for (const lang of ['hr', 'en', 'de', 'sl']) {
  assert.ok(indexSource.includes(`${lang}:`), `${lang} translations remain present`);
}

console.log('F38 PRO effectively-gluten-free custom blend regression passed.');
