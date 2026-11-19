#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

require.extensions['.ts'] = (module, filename) => {
  const source = fs.readFileSync(filename, 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  module._compile(output, filename);
};

const { getYeastAwarePrefermentSteps } = require(path.join(frontendRoot, 'src', 'i18n', 'prefermentSteps.ts'));
const indexSource = fs.readFileSync(path.join(frontendRoot, 'app', '(tabs)', 'index.tsx'), 'utf8');
const languages = ['hr', 'en', 'de', 'sl'];
const mixingMethods = ['hand', 'mixer', 'spiral'];
const styles = ['napolitana', 'romanaTonda', 'romanaTeglia', 'newYork'];
const selectedTemperatures = [2, 4, 6];
assert.match(indexSource, /if \(isProEffectivelyGlutenFree\) \{[\s\S]*?setMethod\('direct'\)[\s\S]*?setBigaEnabled\(false\)[\s\S]*?setPoolishEnabled\(false\)/);
assert.match(indexSource, /if \(f === 'glutenFree'\) \{\s*setMethod\('direct'\);\s*if \(!isBeginner\) \{\s*setBigaEnabled\(false\);\s*setPoolishEnabled\(false\);/);
assert.match(indexSource, /if \(isEffectivelyGlutenFreeBlend\(a, b, p\)\) \{\s*setMethod\('direct'\);\s*setBigaEnabled\(false\);\s*setPoolishEnabled\(false\);/);
const gfFlourPaths = [
  ['glutenFree', false],
  ['custom', true],
];

for (const lang of languages) {
  for (const mixing of mixingMethods) {
    for (const [flour, glutenFreeBlend] of gfFlourPaths) {
      for (const style of styles) {
        const teglia = style === 'romanaTeglia';
        for (const fridgeTemp of selectedTemperatures) {
          const biga = getYeastAwarePrefermentSteps(
            lang, 'biga', mixing, 'dry', '6.5 g', teglia, false, flour, glutenFreeBlend, undefined, fridgeTemp,
          );
          const bigaColdSteps = [...biga.p1.steps, ...(!teglia ? biga.p3.steps : [])]
            .filter((step) => /fridge|refrigerat|kühlschrank|hladilnik|hladnjak/i.test(step));
          assert.ok(bigaColdSteps.length > 0, `${lang}/${style}/${mixing}/${flour}/${fridgeTemp} has GF Biga cold steps`);
          for (const step of bigaColdSteps) {
            assert.ok(step.includes(`${fridgeTemp}°C`), `${lang}/${style}/${mixing}/${flour} uses selected ${fridgeTemp}°C: ${step}`);
            assert.doesNotMatch(step, /4–6°C/, `${lang}/${style}/${mixing}/${flour} has no stale 4–6°C range: ${step}`);
          }
          assert.match(biga.p1.steps.join(' '), /16 (hours|sati|Stunden|ur)/i, 'Biga cold duration remains unchanged');
          if (!teglia) assert.match(biga.p3.steps.join(' '), /60–90/, 'GF Biga rest duration remains unchanged');

          const poolish = getYeastAwarePrefermentSteps(
            lang, 'poolish', mixing, 'dry', '6.5 g', teglia, false, flour, glutenFreeBlend, undefined, fridgeTemp,
          );
          assert.doesNotMatch(
            [...poolish.p1.steps, ...poolish.p3.steps].join(' '),
            /4–6°C/,
            `${lang}/${style}/${mixing}/${flour} Poolish GF instructions contain no fixed fridge range`,
          );
          if (!teglia) assert.match(poolish.p3.steps.join(' '), /30/, 'Poolish GF room rest chronology remains unchanged');
        }
      }
    }
  }
}

for (const lang of languages) {
  for (const mixing of mixingMethods) {
    for (const fridgeTemp of selectedTemperatures) {
      const nonGlutenFreeBiga = getYeastAwarePrefermentSteps(
        lang, 'biga', mixing, 'dry', '6.5 g', false, false, 'caputo00', false, undefined, fridgeTemp,
      );
      const bigaColdSteps = [...nonGlutenFreeBiga.p1.steps, ...nonGlutenFreeBiga.p2.steps, ...nonGlutenFreeBiga.p3.steps]
        .filter((step) => /fridge|refrigerat|kühlschrank|hladilnik|hladnjak/i.test(step));
      assert.ok(
        bigaColdSteps.some((step) => step.includes(`${fridgeTemp}°C`)),
        `${lang}/${mixing}/non-GF Biga uses its selected ${fridgeTemp}°C refrigerator setting`,
      );
      assert.doesNotMatch(
        bigaColdSteps.join(' '),
        /4\s*[–-]\s*6\s*°C/i,
        `${lang}/${mixing}/non-GF Biga contains no generic refrigerator range`,
      );
      const nonGlutenFreePoolish = getYeastAwarePrefermentSteps(
        lang, 'poolish', mixing, 'dry', '6.5 g', false, false, 'caputo00', false, undefined, fridgeTemp,
      );
      assert.doesNotMatch(
        [...nonGlutenFreePoolish.p1.steps, ...nonGlutenFreePoolish.p2.steps, ...nonGlutenFreePoolish.p3.steps].join(' '),
        /4\s*[–-]\s*6\s*°C/i,
        `${lang}/${mixing}/non-GF Poolish contains no generic refrigerator range`,
      );
    }
  }
}

for (const lang of languages) {
  const restoredAfterLanguageChange = getYeastAwarePrefermentSteps(
    lang, 'biga', 'hand', 'dry', '6.5 g', false, false, 'custom', true, undefined, 2,
  );
  assert.ok(
    [...restoredAfterLanguageChange.p1.steps, ...restoredAfterLanguageChange.p3.steps]
      .some((step) => step.includes('2°C')),
    `${lang} retains the selected setting when instructions are regenerated after a language change/reload`,
  );
}

assert.match(indexSource, /getYeastAwarePrefermentSteps\(lang, 'biga'[\s\S]*?remainingFlourDescription, fridgeTemp, proSpiralRecipe\)/);
assert.match(indexSource, /getYeastAwarePrefermentSteps\(lang, 'poolish'[\s\S]*?undefined, fridgeTemp, proSpiralRecipe\)/);
const detailedStepBuilderStart = indexSource.indexOf('const buildDetailedDirectSteps =');
const detailedStepBuilderEnd = indexSource.indexOf('const generatedDetailedDirectSteps =', detailedStepBuilderStart);
const detailedStepBuilder = indexSource.slice(detailedStepBuilderStart, detailedStepBuilderEnd);
assert.match(detailedStepBuilder, /pct: bigaPct,[\s\S]*?proFinalRestMinutes, undefined, fridgeTemp\)/);
assert.match(detailedStepBuilder, /pct: method === 'sponge' \? spongeFlourPct : poolishPct,[\s\S]*?proFinalRestMinutes, undefined, fridgeTemp\)/);
assert.match(detailedStepBuilder, /getDetailedDirectSteps\(mixingForExperience, beginnerTextMode \? directStepIngredients : proDirectStepIngredients,[\s\S]*?proFinalRestMinutes, activeYeastType, fridgeTemp\)/);
assert.match(detailedStepBuilder, /getDetailedDirectStepsLocalized\(lang,[\s\S]*?directRecipeRoomHours, roomTemp, fridgeTemp,/);
for (const styleMarker of ["pizzaStyle === 'romana'", 'isRomanTeglia', "pizzaStyle === 'ny_style'", "pizzaStyle === 'neapolitan'"]) {
  assert.ok(detailedStepBuilder.includes(styleMarker), `GF recipe generation retains ${styleMarker} style routing`);
}
assert.match(indexSource, /const coldTemperature = formatTemperature\(fridgeTemp, 'celsius'\)/);
assert.match(indexSource, /const coldTemperature = formatTemperature\(fridgeTemp, temperatureUnit\)/);
assert.match(indexSource, /adapted = adapted\.replace\(\/\\d\+\(\?:\\s\*\[-–\]\\s\*\\d\+\)\?\\s\*°\\s\*C\/g, `\$\{fridgeTemp\}°C`\)/);
assert.doesNotMatch(indexSource, /(?:4–6|3–5) °C/);

console.log('F43 PRO gluten-free fridge-temperature parity regression passed.');
