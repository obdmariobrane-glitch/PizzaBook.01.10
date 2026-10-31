#!/usr/bin/env node

const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const ts = require('typescript');
const vm = require('vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'app', '(tabs)', 'index.tsx'), 'utf8');
const blockStart = source.indexOf('  const addProPrefermentFinalYeast =');
const blockEnd = source.indexOf('  const applyBeginnerCustomFlourText =', blockStart);
assert.ok(blockStart >= 0 && blockEnd > blockStart, 'PRO yeast adaptation block must remain available');
const sourceBlock = source.slice(blockStart, blockEnd);

function runAdaptation({ isBeginner = false, method, mixing, yeastType }) {
  const phase = {
    title: 'Final mix',
    steps: mixing === 'hand' ? ['wash', 'preferment', 'water', 'salt'] : ['wash', 'prepare mixer', 'preferment', 'water', 'salt'],
  };
  const inputSteps = [...phase.steps];
  const result = vm.runInNewContext(
    `${sourceBlock}\n({ addProPrefermentFinalYeast, proPrefermentFinalYeastStep, proPrefermentDetailedSteps })`,
    {
      isBeginner,
      method,
      mixingForExperience: mixing,
      preferredYeastType: yeastType,
      dough: { main: { yeast: 5.25 } },
      weight: (grams) => `${grams} g`,
      textAlignedDetailedDirectSteps: [phase],
    },
  );
  return { ...result, phase, inputSteps };
}

for (const method of ['biga', 'poolish']) {
  for (const mixing of ['hand', 'mixer', 'spiral']) {
    for (const yeastType of ['fresh', 'activeDry', 'dry']) {
      const { addProPrefermentFinalYeast, proPrefermentFinalYeastStep, proPrefermentDetailedSteps, phase, inputSteps } =
        runAdaptation({ method, mixing, yeastType });
      const insertionIndex = mixing === 'hand' ? 2 : 3;
      assert.equal(addProPrefermentFinalYeast, true);
      assert.equal(proPrefermentDetailedSteps[0].steps.length, inputSteps.length + 1);
      assert.equal(proPrefermentDetailedSteps[0].steps[insertionIndex], proPrefermentFinalYeastStep);
      assert.match(proPrefermentFinalYeastStep, /5\.25 g/);
      assert.match(proPrefermentFinalYeastStep, /završno tijesto/);
      if (yeastType === 'fresh') {
        assert.match(proPrefermentFinalYeastStep, /Svježi kvasac/);
        assert.match(proPrefermentFinalYeastStep, /ne povrh njih/);
      } else if (yeastType === 'activeDry') {
        assert.match(proPrefermentFinalYeastStep, /Aktivni suhi kvasac/);
        assert.match(proPrefermentFinalYeastStep, /prema uputama na pakiranju/);
        assert.match(proPrefermentFinalYeastStep, /ne povrh njih/);
      } else {
        assert.match(proPrefermentFinalYeastStep, /Instant suhi kvasac/);
        assert.match(proPrefermentFinalYeastStep, /umiješajte u preostalo brašno/);
      }
      assert.deepEqual(phase.steps, inputSteps, 'adaptation must not mutate the input phase');
    }
  }
}

for (const scenario of [
  { isBeginner: true, method: 'biga', mixing: 'hand', yeastType: 'fresh' },
  { isBeginner: false, method: 'direct', mixing: 'hand', yeastType: 'fresh' },
]) {
  const { addProPrefermentFinalYeast, proPrefermentDetailedSteps, phase } = runAdaptation(scenario);
  assert.equal(addProPrefermentFinalYeast, false);
  assert.strictEqual(proPrefermentDetailedSteps[0], phase, 'out-of-scope paths must retain their original phase');
}

const prefermentPath = path.join(__dirname, '..', 'src', 'i18n', 'prefermentSteps.ts');
const compiledPreferment = ts.transpileModule(fs.readFileSync(prefermentPath, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const prefermentModule = { exports: {} };
vm.runInNewContext(compiledPreferment, {
  module: prefermentModule,
  exports: prefermentModule.exports,
  require: (specifier) => {
    assert.equal(specifier, './spiralMixing');
    return {
      adaptSpiralMixerSourceSteps: (steps) => steps,
      getSpiralMixingSteps: () => [],
      getSpiralMixingTitle: (lang) => ({
        hr: 'spiralnim mikserom',
        en: 'spiral',
        de: 'Spiralkneter',
        sl: 'spiralnim mešalnikom',
      }[lang]),
    };
  },
});
const { getYeastAwarePrefermentSteps } = prefermentModule.exports;
for (const lang of ['hr', 'en', 'de', 'sl']) {
  for (const method of ['biga', 'poolish']) {
    for (const mixing of ['hand', 'mixer', 'spiral']) {
      for (const yeastType of ['fresh', 'activeDry', 'dry']) {
        const pathSteps = getYeastAwarePrefermentSteps(lang, method, mixing, yeastType, '7.25 g');
        assert.match(pathSteps.p2.steps.join(' '), /7\.25 g/, `${lang}/${method}/${mixing}/${yeastType} must include the calculated final yeast`);
      }
    }
  }
}

const poolishMixSource = source.slice(
  source.indexOf('  const poolishMixSteps ='),
  source.indexOf('  const bigaHomeRecipePhases ='),
);
assert.equal(
  (poolishMixSource.match(/weight\(dough\.main\.yeast, true\)/g) ?? []).length,
  12,
  'all four Poolish hand-mix language copies must retain all three calculated yeast variants',
);

console.log('PRO Biga/Poolish final-dough yeast instructions passed.');
