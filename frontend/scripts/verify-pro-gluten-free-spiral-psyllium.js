#!/usr/bin/env node

const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const frontendRoot = path.join(__dirname, '..');
require.extensions['.ts'] = (module, filename) => {
  const source = fs.readFileSync(filename, 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  module._compile(output, filename);
};
const { adaptProGlutenFreeMixingPhaseA } = require(path.join(frontendRoot, 'src', 'i18n', 'proGlutenFreeBulk.ts'));
const spiralPath = path.join(frontendRoot, 'src', 'i18n', 'spiralMixing.ts');
const { getSpiralMixingSteps } = require(spiralPath);
const indexSource = fs.readFileSync(path.join(frontendRoot, 'app', '(tabs)', 'index.tsx'), 'utf8');
const languages = ['hr', 'en', 'de', 'sl'];
const styles = ['napolitana', 'romanaTonda', 'romanaTeglia', 'newYork'];
const yeastTypes = ['fresh', 'activeDry', 'dry'];
const flourPaths = [
  { flour: 'caputo00' },
  { flour: 'manitoba' },
  { flour: 'spelt' },
  { flour: 'wholeWheat' },
  { flour: 'custom', blend: 'contains gluten' },
  { flour: 'custom', blend: 'all gluten-free components' },
  { flour: 'glutenFree' },
];
const amount = '7.25 g';
const noDoubleWater = {
  hr: /nemojte je dodavati ponovno/i,
  en: /do not add it again/i,
  de: /geben sie es nicht erneut hinzu/i,
  sl: /ne dodajajte je ponovno/i,
};
const noGlutenKneading = {
  hr: /ne mijesite radi razvoja glutena/i,
  en: /do not knead.*develop gluten/i,
  de: /nicht zur Glutenentwicklung kneten/i,
  sl: /ne gnetite za razvoj glutena/i,
};

for (const lang of languages) {
  for (const style of styles) {
    const initialWaterPct = style === 'romanaTeglia' ? 80 : 90;
    const totalWater = 500;
    const initialWaterGrams = Math.round(totalWater * initialWaterPct / 100);
    for (const hasOil of [false, true]) {
      for (const yeastType of yeastTypes) {
      const glutenFreeSteps = getSpiralMixingSteps(lang, yeastType, {
        method: 'direct',
        hasOil,
        directStyle: style,
        directInitialWaterPct: initialWaterPct,
        directInitialWaterGrams: initialWaterGrams,
        psyllium: { amount, initialWaterPct, initialWaterGrams },
      });
      assert.equal(glutenFreeSteps.length, 8 + Number(hasOil), `${lang}/${style}/${yeastType} stays one mixing phase with one added psyllium step`);
      assert.equal(
        glutenFreeSteps.filter((step) => step.includes(amount)).length,
        1,
        `${lang}/${style}/${yeastType} uses the listed psyllium quantity exactly once`,
      );
      assert.match(glutenFreeSteps[2], new RegExp(`${initialWaterPct}.*${initialWaterGrams}`), `${lang}/${style} keeps the existing first-water allocation`);
      assert.match(glutenFreeSteps[3], /psyllium|Flohsamenschalen/i, `${lang}/${style} explains psyllium incorporation`);
      assert.match(glutenFreeSteps[3], noDoubleWater[lang], `${lang}/${style} explicitly prevents counting the first water portion twice`);
      assert.match(glutenFreeSteps[5], /remaining|preostalu|restliche|preostalo/i, `${lang}/${style} adds only the reserved remaining water`);
      assert.doesNotMatch(glutenFreeSteps[glutenFreeSteps.length - 1], /\b5\s*(?:minutes?|minuta|minut|Minuten)\b/i, `${lang}/${style} does not add a separate timed rest after mixing`);
      assert.match(glutenFreeSteps[glutenFreeSteps.length - 1], noGlutenKneading[lang], `${lang}/${style} avoids kneading gluten-free dough to develop gluten`);
      const adaptedMixingPhase = adaptProGlutenFreeMixingPhaseA({
        title: 'Phase A: Spiral Mixing',
        steps: [...glutenFreeSteps, 'Let the mass rest for 5 minutes so the psyllium absorbs moisture.'],
        timers: [{ id: 'post-mix-rest', seconds: 300, kind: 'rest' }],
      }, 'spiral');
      assert.equal(adaptedMixingPhase.timers[0]?.seconds, 300, `${lang}/${style} retains the spiral post-mix rest timer`);
      assert.match(adaptedMixingPhase.steps.at(-1), /5 minutes/, `${lang}/${style} retains the spiral post-mix rest instruction`);

      const ordinarySpiralSteps = getSpiralMixingSteps(lang, yeastType, {
        method: 'direct',
        hasOil,
        directStyle: style,
        directInitialWaterPct: initialWaterPct,
        directInitialWaterGrams: initialWaterGrams,
      });
      assert.equal(ordinarySpiralSteps.length, 7 + Number(hasOil), `${lang}/${style}/${yeastType} non-gluten-free step count stays unchanged`);
      assert.doesNotMatch(ordinarySpiralSteps.join(' '), /psyllium|Flohsamenschalen/i, `${lang}/${style}/${yeastType} non-gluten-free steps stay unchanged`);

      for (const { flour } of flourPaths) {
        const flourSteps = getSpiralMixingSteps(lang, yeastType, {
          method: 'direct',
          hasOil,
          directStyle: style,
          directInitialWaterPct: initialWaterPct,
          directInitialWaterGrams: initialWaterGrams,
          ...(flour === 'glutenFree' ? { psyllium: { amount, initialWaterPct, initialWaterGrams } } : {}),
        });
        if (flour === 'glutenFree') {
          assert.equal(flourSteps.filter((step) => step.includes(amount)).length, 1, `${lang}/${style}/${flour} uses the calculated psyllium quantity`);
        } else {
          assert.doesNotMatch(flourSteps.join(' '), /psyllium|Flohsamenschalen/i, `${lang}/${style}/${flour} does not add psyllium absent from the calculated ingredients`);
        }
      }

      for (const method of ['biga', 'poolish']) {
        const prefermentSteps = getSpiralMixingSteps(lang, yeastType, {
          method,
          hasOil: false,
          psyllium: { amount, initialWaterPct, initialWaterGrams },
        });
        assert.equal(prefermentSteps.length, 7, `${lang}/${method}/${yeastType} keeps its existing spiral steps`);
        assert.doesNotMatch(prefermentSteps.join(' '), /psyllium|Flohsamenschalen/i, `${lang}/${method}/${yeastType} preferment instructions remain unchanged`);
      }
      }
    }
  }
}

assert.match(indexSource, /const psylliumGrams = isWorkflowGlutenFree \? \(dough\.total\.psyllium \?\? 0\) : 0/);
assert.match(indexSource, /label="Psyllium" value=\{weight\(psylliumGrams\)\}/);
assert.match(indexSource, /psylliumGrams: method === 'direct' && isWorkflowGlutenFree \? psylliumGrams : 0/);
assert.match(indexSource, /initialWaterPct: method === 'direct' \? directInitialWaterPct : 90/);
assert.match(indexSource, /const generatedMixingSteps = !isBeginner && mixingForExperience === 'spiral' && textAlignedDetailedDirectSteps/);
assert.match(indexSource, /textAlignedDetailedDirectSteps\.map\(\(phase, phaseIndex\) => \{/);
assert.match(indexSource, /if \(phaseIndex !== 0\) return phase;/);
assert.match(indexSource, /stepInfo: proSpiralRecipe \? getProSpiralMixingStepInfo\(lang, proSpiralRecipe, steps\) : phase\.stepInfo/);
assert.match(indexSource, /adaptSpiralMixerSourceSteps\(\s*phase\.steps\.map/);
assert.doesNotMatch(indexSource.slice(indexSource.indexOf('const generatedMixingSteps'), indexSource.indexOf('const proPhaseESteps')), /getSpiralMixingSteps\(/);

console.log('PRO gluten-free spiral psyllium instructions passed.');
