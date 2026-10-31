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
  adaptSpiralMixerSourceSteps,
  getProSpiralMixingStepInfo,
} = require(path.join(frontendRoot, 'src', 'i18n', 'spiralMixing.ts'));
const {
  adaptDirectMixingSteps,
  getYeastAwarePrefermentSteps,
} = require(path.join(frontendRoot, 'src', 'i18n', 'prefermentSteps.ts'));
const uiSource = fs.readFileSync(path.join(frontendRoot, 'app', '(tabs)', 'index.tsx'), 'utf8');

const languages = ['hr', 'en', 'de', 'sl'];
const yeastTypes = ['fresh', 'activeDry', 'dry'];
const equipmentAndIceSource = {
  hr: ['Pripremite mikser i posudu miksera.', 'Dodajte vodu (s ledom) u posudu miksera.'],
  en: ['Prepare the mixer and mixer bowl.', 'Add the water (with ice) to the mixer bowl.'],
  de: ['Bereiten Sie den Mixer und die Mixerschüssel vor.', 'Geben Sie Wasser (mit Eis) in die Mixerschüssel.'],
  sl: ['Pripravite mešalnik in posodo mešalnika.', 'Dodajte vodo (z ledom) v posodo mešalnika.'],
};
const equipmentAndIceExpected = {
  hr: ['Pripremite spiralni mikser i posudu spiralnog miksera.', 'Dodajte vodu u posudu spiralnog miksera.'],
  en: ['Prepare the spiral mixer and spiral mixer bowl.', 'Add the water to the spiral mixer bowl.'],
  de: ['Bereiten Sie den Spiralkneter und die Schüssel des Spiralkneters vor.', 'Geben Sie Wasser in die Schüssel des Spiralkneters.'],
  sl: ['Pripravite spiralni mešalnik in posodo spiralnega mešalnika.', 'Dodajte vodo v posodo spiralnega mešalnika.'],
};
const weight = (grams) => `${grams} g`;
let checked = 0;

for (const lang of languages) {
  assert.deepEqual(
    adaptSpiralMixerSourceSteps(equipmentAndIceSource[lang], lang),
    equipmentAndIceExpected[lang],
    `${lang} changes only equipment wording and removes numbered-step ice wording`,
  );

  const directHomeSteps = [
    equipmentAndIceSource[lang][0],
    ({
      hr: 'Izmjerite 1000 g brašna i 428 g vode.',
      en: 'Measure 1000 g flour and 428 g water.',
      de: 'Wiegen Sie 1000 g Mehl und 428 g Wasser ab.',
      sl: 'Odmerite 1000 g moke in 428 g vode.',
    }[lang]),
    equipmentAndIceSource[lang][1],
  ].concat({
    hr: ['U približno 90% vode, odnosno 90 g, otopite kvasac.', 'Miješajte na sporoj brzini dok se tijesto poveže.', 'Dodajte maslinovo ulje i miješajte dok se upije.'],
    en: ['Dissolve the yeast in about 90% of the water, or 90 g.', 'Mix at low speed until the dough comes together.', 'Add olive oil and mix until absorbed.'],
    de: ['Lösen Sie die Hefe in etwa 90% des Wassers, also 90 g, auf.', 'Bei niedriger Geschwindigkeit mischen, bis sich der Teig verbindet.', 'Olivenöl zugeben und mischen, bis es aufgenommen ist.'],
    sl: ['Kvas raztopite v približno 90% vode oziroma 90 g.', 'Mešajte pri nizki hitrosti, da se testo poveže.', 'Dodajte oljčno olje in mešajte, dokler se ne vpije.'],
  }[lang]);
  const adaptedDirectSource = adaptSpiralMixerSourceSteps(directHomeSteps, lang);
  assert.match(adaptedDirectSource[3], /90%|90 %/, `${lang} preserves the source step and its dynamic water amount`);
  for (const yeastType of yeastTypes) {
    const adaptedDirect = adaptDirectMixingSteps(directHomeSteps, lang, yeastType, 'spiral', true, true);
    assert.equal(adaptedDirect.length, directHomeSteps.length, `${lang}/${yeastType} retains the home-mixer step structure`);
    assert.ok(adaptedDirect[0].includes({
      hr: 'spiralni mikser',
      en: 'spiral mixer',
      de: 'Spiralkneter',
      sl: 'spiralni mešalnik',
    }[lang]), `${lang}/${yeastType} identifies the spiral mixer in the source steps`);
    assert.doesNotMatch(adaptedDirect.join(' '), /\b(?:ice|led|eis)\b/i, `${lang}/${yeastType} keeps ice out of numbered steps`);
  }

  const blendRecipe = {
    flourGrams: 1000,
    flourLabel: ({ hr: 'mješavine brašna', en: 'flour blend', de: 'Mehlmischung', sl: 'mešanice moke' }[lang]),
    flourBlendDescription: ({ hr: '670 g Tipo 00 + 330 g brašna', en: '670 g Tipo 00 + 330 g flour', de: '670 g Tipo 00 + 330 g Mehl', sl: '670 g Tipo 00 + 330 g moke' }[lang]),
    waterBaseGrams: 100,
    liquidWaterGrams: 80,
    iceGrams: 20,
    initialWaterPct: 90,
    yeastGrams: 2,
    saltGrams: 2,
    oilGrams: 5,
    flourBehavior: 'standard',
    formatWeight: weight,
  };
  const glutenFreeRecipe = { ...blendRecipe, flourBlendDescription: undefined, flourBehavior: 'glutenFree' };
  const glutenFreeInfo = getProSpiralMixingStepInfo(lang, glutenFreeRecipe, adaptedDirectSource)
    .flatMap((entry) => entry === undefined ? [] : Array.isArray(entry) ? entry : [entry]);
  assert.equal(glutenFreeInfo.filter((item) => /gluten-free|bezglutensko|glutenfreier|brezglutensko/i.test(item.title)).length, 1, `${lang} shows gluten-free INFO only for GF recipes`);
  assert.equal(glutenFreeInfo.filter((item) => /flour blend|mješavina brašna|Mehlmischung|mešanica moke/i.test(item.title)).length, 0, `${lang} hides blend INFO for standard flour`);
  for (const method of ['biga', 'poolish']) {
    for (const yeastType of yeastTypes) {
      for (const hasOil of [false, true]) {
        const pathState = getYeastAwarePrefermentSteps(
          lang,
          method,
          'spiral',
          yeastType,
          '2 g',
          false,
          hasOil,
          'caputo00',
          false,
          '670 g Tipo 00 + 330 g flour (1000 g total)',
          4,
          blendRecipe,
        );
        const steps = pathState.p2.steps;
        const joined = steps.join(' ');
        assert.match(pathState.p2.title, {
          hr: /spiralnim mikserom/,
          en: /spiral/,
          de: /Spiralkneter/,
          sl: /spiralnim mešalnikom/,
        }[lang], `${lang}/${method}/${yeastType} uses the equipment-specific phase title`);
        assert.ok(joined.includes(weight(72)), `${lang}/${method}/${yeastType} shows the initial liquid water amount`);
        assert.ok(joined.includes(weight(8)), `${lang}/${method}/${yeastType} shows the remaining liquid water amount`);
        assert.ok(joined.includes(blendRecipe.flourBlendDescription), `${lang}/${method}/${yeastType} retains the blend quantities`);
        assert.doesNotMatch(joined, /\b(?:ice|led|eis)\b/i, `${lang}/${method}/${yeastType} keeps ice out of numbered steps`);
        assert.equal(/olive oil|maslinov(?:og ulja|o ulje)|olivenöl|oljčn(?:ega olja|o olje)/i.test(joined), hasOil, `${lang}/${method}/${yeastType} includes oil only when selected`);

        const info = getProSpiralMixingStepInfo(lang, blendRecipe, steps);
        const indexedInfo = info.flatMap((entry, index) => (
          entry === undefined ? [] : (Array.isArray(entry) ? entry : [entry]).map((item) => ({ ...item, index }))
        ));
        assert.equal(indexedInfo.filter((item) => /speed|brzina|Geschwindigkeit|hitrost/i.test(item.title)).length, 1, `${lang}/${method}/${yeastType} has one speed INFO`);
        assert.equal(indexedInfo.filter((item) => /temperature|temperatura|Teigtemperatur/i.test(item.title)).length, 1, `${lang}/${method}/${yeastType} has one dough-temperature INFO`);
        assert.equal(indexedInfo.filter((item) => /blend|mješavina|Mehlmischung|mešanica/i.test(item.title)).length, 1, `${lang}/${method}/${yeastType} has one blend INFO`);
        checked += 1;
      }
    }
  }
}

assert.match(uiSource, /const proDirectStepIngredients\s*=\s*\{\s*\.\.\.directStepIngredients,\s*water:\s*!isBeginner\s*&&\s*mixingForExperience\s*!==\s*'hand'\s*&&\s*ice\?\.ice\s*\?\s*ice\.water\s*:\s*dough\.total\.water/s, 'PRO mixer phases receive liquid water rather than the total water equivalent when ice is enabled while the Beginner reference remains unchanged');
assert.equal(
  [...uiSource.matchAll(/remainingWater:\s*!beginnerTextMode\s*&&\s*!isBeginner\s*&&\s*mixingForExperience\s*!==\s*'hand'\s*&&\s*ice\?\.ice\s*\?\s*ice\.water\s*:\s*dough\.main\.water/g)].length,
  2,
  'Biga and Poolish PRO mixer phases receive liquid water when ice is enabled',
);
assert.match(uiSource, /mixingForExperience === 'hand' \|\| mixingForExperience === 'mixer' \|\| mixingForExperience === 'spiral'/, 'Biga and Poolish spiral phases retain the final-dough yeast step');
assert.match(uiSource, /adaptSpiralMixerSourceSteps\(\s*phase\.steps\.map/, 'the final Direct phase adapts the generated home-mixer source steps');
assert.match(uiSource, /labelSelectedYeast\(\s*adaptDirectYeastStep\(step,\s*lang,\s*preferredYeastType,\s*true\)/s, 'the final Direct phase retains the selected yeast type in home-mixer steps');
const renderedSpiralGeneration = uiSource.slice(
  uiSource.indexOf('const generatedMixingSteps'),
  uiSource.indexOf('const proPhaseESteps'),
);
assert.doesNotMatch(renderedSpiralGeneration, /getSpiralMixingSteps\(/, 'the custom spiral generator no longer replaces the rendered calculator steps');

console.log(`PASS: home-mixer spiral parity, dynamic preferment water/flour, oil conditions and source-step INFO coverage (${checked} preferment configurations; HR/EN/DE/SL).`);
