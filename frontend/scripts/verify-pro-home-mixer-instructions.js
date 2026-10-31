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

const { getProHomeMixerStepInfo } = require(path.join(frontendRoot, 'src', 'i18n', 'spiralMixing.ts'));
const { getProHomeMixerDirectSteps, getYeastAwarePrefermentSteps } = require(path.join(frontendRoot, 'src', 'i18n', 'prefermentSteps.ts'));
const { getProIceWaterInstructions } = require(path.join(frontendRoot, 'src', 'i18n', 'proIceWaterInstructions.ts'));
const uiSource = fs.readFileSync(path.join(frontendRoot, 'app', '(tabs)', 'index.tsx'), 'utf8');
const languages = ['hr', 'en', 'de', 'sl'];
const yeastTypes = ['fresh', 'activeDry', 'dry'];
const formatWeight = (grams) => `${grams} g`;
const flattenInfo = (info) => info.flatMap((entry) => entry === undefined ? [] : Array.isArray(entry) ? entry : [entry]);
const styles = [
  { name: 'napolitana', initialWaterPct: 90 },
  { name: 'romanaTonda', initialWaterPct: 80 },
  { name: 'romanaTeglia', initialWaterPct: 80 },
  { name: 'newYork', initialWaterPct: 90 },
];
let checks = 0;

function makeRecipe(lang, {
  ice = true,
  oil = true,
  glutenFree = false,
  blend = false,
  flourBehavior = glutenFree ? 'glutenFree' : 'standard',
  restMinutes,
  initialWaterPct = 90,
} = {}) {
  return {
    flourGrams: 1000,
    flourLabel: blend
      ? ({ hr: 'mješavine brašna', en: 'flour blend', de: 'Mehlmischung', sl: 'mešanice moke' }[lang])
      : ({ hr: 'brašna', en: 'flour', de: 'Mehl', sl: 'moke' }[lang]),
    flourBlendDescription: blend
      ? glutenFree
        ? ({ hr: '700 g bezglutenskog brašna A + 300 g bezglutenskog brašna B', en: '700 g gluten-free flour A + 300 g gluten-free flour B', de: '700 g glutenfreies Mehl A + 300 g glutenfreies Mehl B', sl: '700 g brezglutenske moke A + 300 g brezglutenske moke B' }[lang])
        : ({ hr: '700 g Tipo 00 + 300 g Manitoba', en: '700 g Tipo 00 + 300 g Manitoba', de: '700 g Tipo 00 + 300 g Manitoba', sl: '700 g Tipo 00 + 300 g Manitoba' }[lang])
      : undefined,
    waterBaseGrams: 428,
    liquidWaterGrams: ice ? 336 : 428,
    iceGrams: ice ? 92 : 0,
    initialWaterPct,
    yeastGrams: 2.5,
    saltGrams: 25,
    oilGrams: oil ? 18 : 0,
    psylliumGrams: glutenFree ? 20 : undefined,
    flourBehavior,
    restMinutes,
    formatWeight,
  };
}

for (const lang of languages) {
  for (const yeastType of yeastTypes) {
    for (const scenario of [
      { ice: true, oil: true, blend: true, glutenFree: false, restMinutes: 5 },
      { ice: true, oil: false, blend: false, glutenFree: true, restMinutes: undefined },
      { ice: true, oil: false, blend: true, glutenFree: true, restMinutes: undefined },
      { ice: false, oil: false, blend: false, glutenFree: false, restMinutes: undefined },
      { ice: false, oil: true, blend: false, glutenFree: false, flourBehavior: 'spelt', restMinutes: 5 },
      { ice: false, oil: true, blend: false, glutenFree: false, flourBehavior: 'wholeWheat', restMinutes: undefined },
      { ice: false, oil: true, blend: false, glutenFree: false, flourBehavior: 'manitoba', restMinutes: 5 },
    ]) {
      for (const style of styles) {
        const recipe = makeRecipe(lang, { ...scenario, initialWaterPct: style.initialWaterPct });
        const steps = getProHomeMixerDirectSteps(lang, yeastType, recipe);
        const joined = steps.join(' ');
        const split = {
          initial: Math.round(recipe.liquidWaterGrams * recipe.initialWaterPct / 100),
          remaining: recipe.liquidWaterGrams - Math.round(recipe.liquidWaterGrams * recipe.initialWaterPct / 100),
        };
        const hasOil = recipe.oilGrams > 0;
        const expectedLength = 8 + Number(hasOil) + Number((scenario.glutenFree ? 5 : scenario.restMinutes) !== undefined);

        assert.equal(steps.length, expectedLength, `${lang}/${style.name}/${yeastType} keeps the short recipe-dependent home-mixer structure`);
        assert.match(steps[0], /hands|ruke|Hände|roke/i);
        assert.match(steps[1], /home mixer|kućni mikser|Haushaltsmixer|domači mešalnik/i);
        assert.match(steps[2], new RegExp(`${recipe.liquidWaterGrams} g`), `${lang}/${style.name}/${yeastType} measures actual liquid water`);
        assert.ok(steps[4].includes(`${split.initial} g`), `${lang}/${style.name}/${yeastType} uses the calculated initial liquid-water portion`);
        assert.ok(steps[5].includes(`${split.remaining} g`) || split.remaining === 0, `${lang}/${style.name}/${yeastType} uses the calculated remaining liquid water`);
        assert.doesNotMatch(joined, /\bice\b|\bEis\b|led(?:a|u|om)?/i, `${lang}/${style.name}/${yeastType} keeps ice details out of numbered steps`);
        if (scenario.ice) {
          assert.ok(!steps[2].includes('428 g'), `${lang}/${style.name}/${yeastType} does not label total water equivalent as liquid water`);
          assert.ok(!steps[2].includes('92 g'), `${lang}/${style.name}/${yeastType} keeps ice quantity in INFO only`);
        }
        if (yeastType === 'fresh') assert.match(steps[3], /fresh yeast|svježi kvas|Frischhefe|sveži kvas/i);
        if (yeastType === 'activeDry') assert.match(steps[3], /package|pakiranju|Packungsanleitung|embalaži/i);
        if (yeastType === 'dry') assert.match(steps[3], /not dissolve|nemojte otapati|nicht auf|ne raztapljajte/i);
        if (hasOil) assert.match(joined, /olive oil|maslinovog ulja|Olivenöl|oljčnega olja/i);
        else assert.doesNotMatch(joined, /olive oil|maslinovog ulja|Olivenöl|oljčnega olja/i);
        if (!scenario.glutenFree && scenario.restMinutes === undefined) {
          assert.doesNotMatch(joined, /rest for 5|odmor.*5 minuta|5 Minuten ruhen|5 minut počivati/i);
        }
        if (scenario.glutenFree) {
          assert.match(joined, /psyllium|Flohsamenschalen/i);
          assert.match(steps[4], /20 g.*psyllium|20 g.*Flohsamenschalen/i);
          assert.match(joined, /gluten network|glutensku mrežu|Glutennetz|glutenske mreže/i);
        }
        if (recipe.flourBehavior === 'spelt') assert.match(joined, /overmix|premijes|zu lange|pregnet/i);
        if (recipe.flourBehavior === 'wholeWheat') assert.match(joined, /aggressively|aggressiv|agresiv|kräftig/i);
        const info = flattenInfo(getProHomeMixerStepInfo(lang, recipe, steps));
        assert.equal(info.filter((item) => /speed|brzina|Geschwindigkeit|hitrost/i.test(item.title)).length, 1);
        assert.equal(info.filter((item) => /temperature|temperatura|Temperatur/i.test(item.title)).length, 1);
        assert.equal(info.filter((item) => /flour blend|mješavina brašna|Mehlmischung|mešanica moke/i.test(item.title)).length, Number(scenario.blend));
        assert.equal(info.filter((item) => /gluten-free|bezglutensko|glutenfreier|brezglutensko/i.test(item.title)).length, Number(scenario.glutenFree));

        const iceInfo = scenario.ice
          ? getProIceWaterInstructions({
            lang,
            method: 'direct',
            mixing: 'mixer',
            waterBaseGrams: recipe.waterBaseGrams,
            liquidWaterGrams: recipe.liquidWaterGrams,
            iceGrams: recipe.iceGrams,
            initialWaterPct: recipe.initialWaterPct,
            formatWeight,
          })
          : null;
        if (iceInfo) {
          assert.equal(iceInfo.step, undefined, `${lang}/${style.name}/${yeastType} displays home-mixer ice guidance only as INFO`);
          for (const amount of ['428 g', '336 g', '92 g', `${split.initial} g`, `${split.remaining} g`]) {
            assert.ok(iceInfo.waterInfo.includes(amount), `${lang}/${style.name}/${yeastType} INFO includes ${amount}`);
          }
          assert.match(iceInfo.waterInfo, /home mixer|kućni mikser|Haushaltsmixer|domači mešalnik/i);
        }
        checks += 1;
      }
    }
  }

  for (const method of ['biga', 'poolish']) {
    for (const yeastType of yeastTypes) {
      for (const hasOil of [true, false]) {
        const recipe = makeRecipe(lang, { ice: true, oil: hasOil, blend: true, glutenFree: false });
        const remainingFlour = ({
          hr: '700 g mješavine brašna (490 g Tipo 00 + 210 g Manitoba)',
          en: '700 g flour blend (490 g Tipo 00 + 210 g Manitoba)',
          de: '700 g Mehlmischung (490 g Tipo 00 + 210 g Manitoba)',
          sl: '700 g mešanice moke (490 g Tipo 00 + 210 g Manitoba)',
        }[lang]);
        const path = getYeastAwarePrefermentSteps(
          lang,
          method,
          'mixer',
          yeastType,
          '7 g',
          false,
          hasOil,
          'custom',
          false,
          remainingFlour,
          4,
          recipe,
        );
        const steps = path.p2.steps;
        const joined = steps.join(' ');
        assert.match(steps[1], /302 g/, `${lang}/${method}/${yeastType} includes the initial liquid-water amount`);
        assert.match(joined, /34 g/, `${lang}/${method}/${yeastType} includes the remaining liquid-water amount`);
        assert.doesNotMatch(joined, /\bice\b|\bEis\b|led(?:a|u|om)?/i, `${lang}/${method}/${yeastType} keeps ice out of numbered steps`);
        assert.match(joined, /700 g/, `${lang}/${method}/${yeastType} uses the selected remaining flour amount`);
        assert.match(joined, /25 g/, `${lang}/${method}/${yeastType} includes the calculated salt amount`);
        assert.match(joined, /7 g/, `${lang}/${method}/${yeastType} retains the calculated final yeast amount`);
        if (hasOil) assert.match(joined, /18 g/, `${lang}/${method}/${yeastType} includes the calculated oil amount`);
        if (hasOil) assert.match(joined, /olive oil|maslinov|Olivenöl|oljčn/i);
        else assert.doesNotMatch(joined, /olive oil|maslinov|Olivenöl|oljčn/i);
        if (method === 'biga' && yeastType === 'activeDry') {
          assert.match(steps[1], /initial water|početne vode|Anfangswassers|začetne vode/i);
        }
        const info = flattenInfo(getProHomeMixerStepInfo(lang, recipe, steps));
        assert.equal(info.filter((item) => /speed|brzina|Geschwindigkeit|hitrost/i.test(item.title)).length, 1);
        assert.equal(info.filter((item) => /temperature|temperatura|Temperatur/i.test(item.title)).length, 1);
        assert.equal(info.filter((item) => /flour blend|mješavina brašna|Mehlmischung|mešanica moke/i.test(item.title)).length, 1);
        assert.equal(info.filter((item) => /gluten-free|bezglutensko|glutenfreier|brezglutensko/i.test(item.title)).length, 0);
        checks += 1;
      }
    }
  }
}

assert.match(uiSource, /getProHomeMixerDirectSteps\(lang, preferredYeastType, proSpiralRecipe\)/);
assert.match(uiSource, /getProHomeMixerStepInfo\(lang, proSpiralRecipe/);
assert.match(uiSource, /mixingForExperience !== 'hand' \|\| !proIceWaterInstructions\.step/);
assert.equal(checks, 384, 'the regression matrix covers all four languages, pizza styles, yeast types, methods, and recipe variants');

console.log(`PRO home-mixer instruction regressions passed (${checks} configurations).`);
