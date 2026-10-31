#!/usr/bin/env node

const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const ts = require('typescript');
const vm = require('vm');
const frontendRoot = path.resolve(path.dirname(process.argv[1]), '..');

function loadTypeScript(relativePath) {
  const source = fs.readFileSync(path.join(frontendRoot, relativePath), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const moduleRef = { exports: {} };
  vm.runInNewContext(compiled, { module: moduleRef, exports: moduleRef.exports }, { filename: relativePath });
  return moduleRef.exports;
}

const calculator = loadTypeScript('src/calculator.ts');
const spongeSteps = loadTypeScript('src/i18n/spongeSteps.ts');
const appSource = fs.readFileSync(path.join(frontendRoot, 'app', '(tabs)', 'index.tsx'), 'utf8');
const plannerSource = fs.readFileSync(path.join(frontendRoot, 'app', '(tabs)', 'planner.tsx'), 'utf8');

const options = {
  pizzas: 4,
  ballWeight: 250,
  hydration: 65,
  saltPct: 2.9,
  oilPct: 2,
  method: 'sponge',
  spongeFlourPct: 70,
  spongeHydrationPct: 62,
  spongeFermentationTempC: 27,
  spongeFermentationHours: 4.5,
  spongeYeastMode: 'automatic',
  spongeYeastType: 'fresh',
  roomHours: 2,
  roomTemp: 22,
  fridgeHours: 24,
  fridgeTemp: 4,
  flourType: 'caputo00',
};

const automaticFresh = calculator.doughCalc(options);
assert.equal(automaticFresh.method, 'sponge');
assert.equal(calculator.SPONGE_YEAST_REFERENCE.flourShare, 70);
assert.equal(options.spongeHydrationPct, 62);
assert.equal(automaticFresh.preferment.flour + automaticFresh.main.flour, automaticFresh.total.flour);
assert.equal(automaticFresh.preferment.water + automaticFresh.main.water, automaticFresh.total.water);
assert.ok(Math.abs((automaticFresh.preferment.flour / automaticFresh.total.flour) * 100 - options.spongeFlourPct) < 0.2);
assert.ok(Math.abs((automaticFresh.preferment.water / automaticFresh.preferment.flour) * 100 - options.spongeHydrationPct) < 0.2);
assert.ok(Math.abs((automaticFresh.total.water / automaticFresh.total.flour) * 100 - options.hydration) < 0.1);
assert.equal(automaticFresh.total.salt, Math.round(automaticFresh.total.flour * options.saltPct / 100 * 10) / 10);
assert.equal(automaticFresh.total.oil, Math.round(automaticFresh.total.flour * options.oilPct / 100));
assert.ok(Math.abs(
  automaticFresh.preferment.yeast + automaticFresh.main.yeast - automaticFresh.total.yeast,
) < 1e-10);
const displayedMass = automaticFresh.total.flour
  + automaticFresh.total.water
  + automaticFresh.total.salt
  + automaticFresh.total.oil
  + automaticFresh.total.yeast
  + automaticFresh.total.psyllium;
assert.ok(Math.abs(displayedMass - automaticFresh.totalDough) <= 2);

const expectedFreshYeast = calculator.calculateSpongeAutomaticYeastGrams(
  automaticFresh.total.flour,
  options.spongeFermentationTempC,
  options.spongeFermentationHours,
  'fresh',
);
assert.equal(automaticFresh.preferment.yeast, Math.round(expectedFreshYeast * 100) / 100);
const activeDryYeast = calculator.calculateSpongeAutomaticYeastGrams(1000, 27, 4.5, 'activeDry');
const instantDryYeast = calculator.calculateSpongeAutomaticYeastGrams(1000, 27, 4.5, 'dry');
assert.ok(Math.abs(activeDryYeast - 1000 * 0.022 * 0.4) < 1e-10);
assert.ok(Math.abs(instantDryYeast - 1000 * 0.022 / 3) < 1e-10);

const manualYeastGrams = 1.25;
const manual = calculator.doughCalc({
  ...options,
  spongeYeastMode: 'manual',
  spongeManualYeastGrams: manualYeastGrams,
});
assert.equal(manual.preferment.yeast, manualYeastGrams);
assert.ok(Math.abs(manual.preferment.yeast + manual.main.yeast - manual.total.yeast) < 1e-10);
assert.equal(calculator.validateSpongeManualYeastGrams('', 100), 'empty');
assert.equal(calculator.validateSpongeManualYeastGrams('abc', 100), 'invalid');
assert.equal(calculator.validateSpongeManualYeastGrams('0', 100), 'zero');
assert.equal(calculator.validateSpongeManualYeastGrams('-1', 100), 'negative');
assert.equal(calculator.validateSpongeManualYeastGrams('11', 100), 'unreasonable');
assert.equal(calculator.validateSpongeManualYeastGrams('1', 100), null);
assert.equal(calculator.validateSpongeManualYeastGrams('1,5', 100), null);
assert.throws(() => calculator.doughCalc({
  ...options,
  spongeYeastMode: 'manual',
  spongeManualYeastGrams: 0,
}), /finite positive quantity/);

const schedule = calculator.getSpongeFermentationSchedule(4.5, 27, 2, 22, 24, 4, 2);
assert.equal(schedule.phases[0].kind, 'preferment');
assert.equal(schedule.phases[0].hours, 4.5);
assert.equal(schedule.phases[0].temperature, 27);
assert.equal(schedule.phases[1].kind, 'final');
assert.equal(schedule.prefermentHours, 4.5);
assert.throws(() => calculator.getSpongeFermentationSchedule(0, 27, 2, 22, 24, 4), /Sponge fermentation schedule/);
assert.equal(calculator.isProMethodAllowedForFlour('sponge', 'caputo00', 'caputo00', 'wholeWheat', 70), true);
assert.equal(calculator.isProMethodAllowedForFlour('sponge', 'glutenFree', 'caputo00', 'wholeWheat', 70), false);
assert.equal(calculator.isProMethodAllowedForFlour('sponge', 'custom', 'glutenFree', 'glutenFree', 50), false);

const preparationByLanguage = {};
for (const lang of ['hr', 'en', 'de', 'sl']) {
  const copy = spongeSteps.SPONGE_COPY[lang];
  for (const key of ['flourShare', 'hydration', 'fermentationTemp', 'fermentationDuration', 'yeastType', 'yeastMode', 'automatic', 'manual', 'manualYeast', 'allocationInvalid', 'ready']) {
    assert.ok(copy[key], `${lang} translation is missing ${key}`);
  }
  const phase = spongeSteps.getSpongePreparationPhase(lang, {
    flour: '200 g',
    water: '124 g',
    yeast: '2 g',
    yeastType: 'fresh',
    yeastPct: '1.43',
    fermentationTemp: '27°C',
    fermentationHours: 4.5,
  });
  assert.ok(phase.title);
  assert.equal(phase.steps.length, 5);
  assert.ok(phase.steps.every(Boolean));
  preparationByLanguage[lang] = { title: phase.title, steps: phase.steps };
}

const plannerSteps = calculator.reversePlan(
  new Date('2030-01-02T18:00:00Z'),
  'sponge',
  'neapolitan',
  {},
  null,
  null,
  null,
  'en',
  '250°C',
  22,
  schedule,
  null,
  'homeStone',
  250,
  60,
  'hand',
  preparationByLanguage.en,
);
assert.equal(plannerSteps.length, 1);
assert.equal(plannerSteps[0].title, preparationByLanguage.en.title);
assert.equal(plannerSteps[0].desc, preparationByLanguage.en.steps.join('\n'));

for (const setting of [
  'spongeFlourPct',
  'spongeHydrationPct',
  'spongeFermentationTempC',
  'spongeFermentationHours',
  'spongeYeastType',
  'spongeYeastMode',
  'spongeManualYeastGrams',
]) {
  assert.ok(appSource.includes(setting), `Calculator persistence is missing ${setting}`);
}
assert.ok(appSource.includes("method === 'sponge' && spongePreparationPhase"));
assert.ok(appSource.includes('calculatorSpongePreparation'));
assert.ok(appSource.includes("const method: Method = isBeginner\n    ? 'direct'"));
assert.ok(plannerSource.includes('sharedCalculatorPlanSettings?.spongePreparation'));
assert.ok(plannerSource.includes('savedMethod === \'sponge\''));
assert.ok(!appSource.includes("method === 'sponge' ? (() => {\n                    const path = getYeastAwarePrefermentSteps(lang, 'poolish'"));

console.log('Sponge calculation, yeast, schedule, preparation, Planner, and translation checks passed.');
