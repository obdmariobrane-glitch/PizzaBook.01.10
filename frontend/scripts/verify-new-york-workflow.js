#!/usr/bin/env node

const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const ts = require('typescript');
const vm = require('vm');

function loadTypeScript(relativePath) {
  const source = fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const moduleRef = { exports: {} };
  vm.runInNewContext(compiled, { module: moduleRef, exports: moduleRef.exports }, { filename: relativePath });
  return moduleRef.exports;
}

const calculator = loadTypeScript(path.join('src', 'calculator.ts'));
const units = loadTypeScript(path.join('src', 'units.ts'));
const uiSource = fs.readFileSync(path.join(__dirname, '..', 'app', '(tabs)', 'index.tsx'), 'utf8');
const translations = fs.readFileSync(path.join(__dirname, '..', 'src', 'i18n', 'translations.ts'), 'utf8');
const { PIZZA_STYLE_PROFILES, doughCalc, formatBakingTimeRange, getBakingTimeRange, reversePlan } = calculator;
const profile = PIZZA_STYLE_PROFILES.ny_style;

assert.equal(profile.defaultDiameter, 35);
assert.equal(profile.ballWeight, 375);
assert.match(uiSource, /if \(isBeginner && nextStyle === 'ny_style'\) setDiameter\(next\.defaultDiameter\)/);
assert.match(uiSource, /isRomanTeglia, pizzaStyle === 'ny_style', pizzaStyle === 'neapolitan'/, 'Pro and Beginner Direct, Biga, and Poolish steps receive the New York protocol');
assert.match(uiSource, /pizzaStyle === 'ny_style' \? 'newYork' : 'napolitana'/, 'localized Pro steps select New York rather than Neapolitan shaping');
assert.match(uiSource, /Gently stretch the dough outward from the center to an even thickness; keep the center slightly thinner for a foldable slice/);
assert.match(uiSource, /Večjo kepico oblikujte s tanko sredino in čim bolj enakomerno debelino/);
assert.match(uiSource, /Testo nežno raztegnite od sredine navzven do enakomerne debeline/);

const onePizza = doughCalc({
  pizzas: 1, ballWeight: profile.ballWeight, hydration: profile.hydration,
  saltPct: profile.saltPct, oilPct: profile.oilPct, method: 'direct',
  roomHours: 2, roomTemp: 22, fridgeHours: 0, fridgeTemp: 4, yeastType: 'fresh',
});
const threePizzas = doughCalc({
  pizzas: 3, ballWeight: profile.ballWeight, hydration: profile.hydration,
  saltPct: profile.saltPct, oilPct: profile.oilPct, method: 'direct',
  roomHours: 2, roomTemp: 22, fridgeHours: 0, fridgeTemp: 4, yeastType: 'fresh',
});
assert.equal(onePizza.totalDough, 375);
assert.equal(threePizzas.totalDough, 1125);
for (const ingredient of ['flour', 'water', 'salt', 'yeast', 'oil']) {
  assert.ok(threePizzas.total[ingredient] > onePizza.total[ingredient], `${ingredient} did not scale with pizza count`);
}

assert.deepEqual(
  JSON.parse(JSON.stringify(getBakingTimeRange('homeStone', 300))),
  { min: 3, max: 4.5 },
);
assert.deepEqual(
  JSON.parse(JSON.stringify(getBakingTimeRange('homePan', 300))),
  { min: 6, max: 9 },
);
assert.equal(formatBakingTimeRange('homeStone', 300, 'en'), '3 min–4.5 min');
assert.equal(formatBakingTimeRange('homePan', 300, 'en'), '6 min–9 min');
assert.equal(formatBakingTimeRange('ooni', 450, 'en'), '60 s–90 s');
const bakeAt = new Date('2026-10-03T19:00:00');
const plannerSteps = reversePlan(bakeAt, 'direct', 'ny_style', {
  ovenTitle: 'Preheat', ovenDesc: 'Preheat oven', ovenRomanDesc: 'Preheat Romana', ovenNyDesc: 'Preheat New York',
  bakeTitle: 'Bake pizza', bakeDesc: 'Bake', directNyBakeDesc: 'Bake the New York pizza for {BAKE_TIME} at {OVEN_TEMP_DISPLAY}.',
  warmTitle: 'Warm dough', warmDesc: 'Warm {STYLE}', coldTitle: 'Cold dough', coldDesc: 'Cold {HOURS} {STYLE}',
  directMixTitle: 'Mix dough', directNyDesc: 'Mix New York',
}, {
  startAt: new Date('2026-10-03T15:00:00'), bakeAt, ovenType: 'homeStone', ovenTemp: 300,
  roomBeforeFridgeHours: 1, fridgeHours: 1, roomAfterFridgeHours: 1, prefermentHours: 0,
}, null, null, 'en', '572°F');
assert.equal(plannerSteps.at(-1).desc, 'Bake the New York pizza for 3 min–4.5 min at 572°F.');

const formatUS = (text) => units.formatUnitText(text, 'celsius', 'us');
for (const sentence of [
  'Add 3 g dry yeast, then add 300 g water.',
  'Mešajte 3 g suhega kvasa, nato dodajte 300 g vode.',
  'Geben Sie 3 g Trockenhefe und anschließend 300 g Wasser dazu.',
  'Dodajte 3 g suhega kvasa, nato 300 g vode.',
]) {
  assert.match(formatUS(sentence), /3 g/);
  assert.match(formatUS(sentence), /10\.6 oz/);
}
assert.match(formatUS('500 g flour, 10 g salt, and 18 g oil.'), /1\.1 lb/);
assert.match(formatUS('500 g flour, 10 g salt, and 18 g oil.'), /10 g/);
assert.match(formatUS('500 g flour, 10 g salt, and 18 g oil.'), /0\.6 oz/);
assert.equal(units.formatUnitText('300 g water', 'celsius', 'metric'), '300 g water');

assert.equal((translations.match(/directNyBakeDesc:/g) ?? []).length, 4);
assert.equal((translations.match(/\{OVEN_TEMP_DISPLAY\}/g) ?? []).length, 4);
assert.match(uiSource, /const bakingTimeRange = formatBakingTimeRange\(oven, ovenTemp, lang\)/, 'Recipe card, detailed steps, and timer share the selected oven/temperature bake range');
assert.match(uiSource, /Bake \$\{bakingTimeRange\} at \$\{ovenTemp\} °C/);
assert.match(uiSource, /t\.calc\.styleInfo\.baking\}: \{formatTemperature\(ovenTemp, temperatureUnit\)\} · \{bakingTimeRange\}/, 'Style information uses the same selected-oven bake values as the detailed steps');
assert.match(uiSource, /!isRomanTonda && !isNewYork/);
assert.match(uiSource, /Bake the pizza for \$\{bakingTimeRange\} total/);
assert.match(uiSource, /Bake the pizza on the bottom rack for \$\{bakingTimeRange\} total/);
assert.match(uiSource, /Bake for \$\{bakingTimeRange\} total, including any grill finish/);
assert.doesNotMatch(uiSource, /Bake the pizza for approximately 60–90 seconds|Bake the pizza on the bottom of the oven for 5–7 minutes/);
assert.match(uiSource, /const range = getBakingTimeRange\(oven, ovenTemp\)/, 'Beginner bake timer uses the same oven/temperature-derived range');
assert.match(uiSource, /dims\.cheese, dims\.sauce/);
assert.match(uiSource, /use approximately \$\{sauceAmount\} g sauce and \$\{cheeseAmount\} g mozzarella/);
assert.match(uiSource, /Mijesite samo dok se sastojci povežu i ne ostanu suhi dijelovi; završite razvoj na radnoj površini/);
assert.match(uiSource, /mijesite dlanovima 10–15 minuta dok površina ne postane glatka/);
assert.match(translations, /A larger dough ball makes a thin center with even thickness for a foldable slice/);
assert.match(translations, /Ein größerer Teigballen ergibt eine dünne Mitte mit gleichmäßiger Dicke/);
assert.match(translations, /Večja kepica omogoča tanko sredino in enakomerno debelino/);

console.log('Beginner New York workflow checks passed.');
