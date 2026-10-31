#!/usr/bin/env node

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const frontendRoot = path.join(__dirname, '..');
function loadTypeScriptModule(filePath) {
  const compiled = ts.transpileModule(fs.readFileSync(filePath, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const module = { exports: {} };
  const localRequire = (request) => {
    if (request === './spiralMixing') {
      return loadTypeScriptModule(path.join(frontendRoot, 'src', 'i18n', 'spiralMixing.ts'));
    }
    if (request === './proIceWaterInstructions') {
      return loadTypeScriptModule(path.join(frontendRoot, 'src', 'i18n', 'proIceWaterInstructions.ts'));
    }
    throw new Error(`Unexpected runtime import: ${request}`);
  };
  vm.runInNewContext(compiled, { module, exports: module.exports, require: localRequire });
  return module.exports;
}

const { getYeastAwarePrefermentSteps } = loadTypeScriptModule(
  path.join(frontendRoot, 'src', 'i18n', 'prefermentSteps.ts'),
);
const indexSource = fs.readFileSync(path.join(frontendRoot, 'app', '(tabs)', 'index.tsx'), 'utf8');
assert.match(indexSource, /const remainingFlourDescription = isCustom/);
assert.match(indexSource, /remainingFlourDescription, fridgeTemp, proSpiralRecipe\);/);

const languages = ['hr', 'en', 'de', 'sl'];
const styles = [
  { id: 'neapolitan', teglia: false },
  { id: 'romanaTonda', teglia: false },
  { id: 'romanaTeglia', teglia: true },
  { id: 'newYork', teglia: false },
];
const flours = [
  { flour: 'caputo00', description: '420 g' },
  { flour: 'manitoba', description: '420 g' },
  { flour: 'spelt', description: '420 g' },
  { flour: 'wholeWheat', description: '420 g' },
  { flour: 'custom', description: '294 g Tipo 0 / 00 + 126 g Manitoba (420 g total)' },
];
const mixing = ['hand', 'mixer', 'spiral'];
const yeastTypes = ['fresh', 'activeDry', 'dry'];
const ingredientWords = {
  hr: { water: /vode/i, salt: /sol/i, oil: /ulj/i, hand: /ručn/i, mixer: /mikser/i, spiral: /spiral/i },
  en: { water: /water/i, salt: /salt/i, oil: /oil/i, hand: /hand/i, mixer: /mixer/i, spiral: /spiral/i },
  de: { water: /wasser/i, salt: /salz/i, oil: /öl/i, hand: /hand/i, mixer: /mixer|kneter|küchenmaschine/i, spiral: /spiral/i },
  sl: { water: /vode/i, salt: /sol/i, oil: /olj/i, hand: /ročno/i, mixer: /mešalnik/i, spiral: /spiral/i },
};

let checked = 0;
for (const lang of languages) {
  for (const style of styles) {
    for (const flour of flours) {
      for (const method of mixing) {
        for (const yeastType of yeastTypes) {
          const result = getYeastAwarePrefermentSteps(
            lang,
            'biga',
            method,
            yeastType,
            '0.42 g',
            style.teglia,
            true,
            flour.flour,
            false,
            flour.description,
          );
          const finalMix = result.p2.steps.join(' ');
          const label = `${lang}/${style.id}/${method}/${yeastType}/${flour.flour}`;
          assert.equal(finalMix.split(flour.description).length - 1, 1, `${label}: remaining flour must appear once`);
          assert.ok(method === 'spiral'
            ? /yeast|kvas|Hefe/i.test(finalMix)
            : finalMix.includes('0.42 g'), `${label}: final-dough yeast must be included`);
          assert.ok(ingredientWords[lang].water.test(finalMix), `${label}: remaining water must be included`);
          assert.ok(ingredientWords[lang].salt.test(finalMix), `${label}: salt must be included`);
          assert.ok(ingredientWords[lang].oil.test(finalMix), `${label}: oil must be included`);
          if (method === 'spiral') {
            assert.ok(ingredientWords[lang].spiral.test(result.p2.title), `${label}: spiral procedure must be retained`);
          } else {
            assert.ok(ingredientWords[lang][method].test(result.p2.title), `${label}: equipment-specific title must be retained`);
          }
          if (method === 'mixer') assert.match(finalMix, /speed 1|1\. brzini|Stufe 1|1\. hitrosti/i, `${label}: mixer must start on its first speed`);
          checked += 1;
        }
      }
    }
  }
}

console.log(`F17 Biga remaining-flour regression passed: ${checked} generated final-mix combinations across HR/EN/DE/SL.`);
