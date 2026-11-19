#!/usr/bin/env node

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const root = path.join(__dirname, '..');
function loadTypeScriptModule(filePath) {
  const source = fs.readFileSync(filePath, 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const moduleValue = { exports: {} };
  const localRequire = (request) => request === './proMethods/bigaPoolish'
    ? loadTypeScriptModule(path.join(root, 'src', 'proMethods', 'bigaPoolish.ts'))
    : require(request);
  new Function('module', 'exports', 'require', `${output}\nreturn module.exports;`)(moduleValue, moduleValue.exports, localRequire);
  return moduleValue.exports;
}

const moduleValue = loadTypeScriptModule(path.join(root, 'src', 'calculator.ts'));
const {
  calculateBigaYeastAllocation,
  calculateBigaYeastGrams,
  calculateDirectFermentationScheduleExposure,
  calculateDirectFreshYeastPct,
  DIRECT_YEAST_REFERENCE,
  doughCalc,
  getFermentationSchedule,
  PIZZA_STYLE_PROFILES,
  YEAST_MASS_FACTORS,
} = moduleValue;
const plannerSource = fs.readFileSync(path.join(root, 'app', '(tabs)', 'planner.tsx'), 'utf8');
const calculatorSource = fs.readFileSync(path.join(root, 'app', '(tabs)', 'index.tsx'), 'utf8');
const yeastCopySource = fs.readFileSync(path.join(root, 'src', 'i18n', 'yeastSettings.ts'), 'utf8');
const yeastCopyOutput = ts.transpileModule(yeastCopySource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const yeastCopyModule = { exports: {} };
new Function('module', 'exports', yeastCopyOutput)(yeastCopyModule, yeastCopyModule.exports);

assert.match(plannerSource, /sharedCalculatorPlanSettings\.proFermentationSchedule/);
assert.match(plannerSource, /getFermentationSchedule\(/);
assert.match(plannerSource, /activeCalculatorPlanSettings\.bigaHours/);

for (const bigaPct of [20, 35, 50, 75, 100]) {
  const result = doughCalc({
    pizzas: 2,
    ballWeight: 250,
    hydration: 65,
    saltPct: 2.8,
    oilPct: 1,
    method: 'biga',
    bigaPct,
    roomHours: 2,
    roomTemp: 22,
    fridgeHours: 16,
    fridgeTemp: 4,
    prefermentHours: 24,
    mixing: 'hand',
    flourType: 'caputo00',
  });
  const calculatedHydration = result.preferment.water / result.preferment.flour * 100;
  assert.ok(Math.abs(calculatedHydration - 45) <= 1.5);
  assert.ok(Math.abs(result.preferment.flour + result.main.flour - result.total.flour) <= 1);
  assert.ok(Math.abs(result.preferment.water + result.main.water - result.total.water) <= 1);
}

const makeBudgetedBigaResult = ({
  schedule,
  style,
  flourType,
  bigaPct,
  bigaHydrationPct,
  roomTemp,
  fridgeTemp,
  yeastType,
  mode = 'automatic',
  manualGrams = 0,
}) => {
  const profile = PIZZA_STYLE_PROFILES[style];
  const flourGrams = 1000;
  const directPct = calculateDirectFreshYeastPct(calculateDirectFermentationScheduleExposure(schedule.phases))
    * YEAST_MASS_FACTORS[yeastType];
  const totalDough = mode === 'manual'
    ? flourGrams * (100 + profile.hydration + profile.saltPct + profile.oilPct) / 100 + manualGrams
    : flourGrams * (100 + profile.hydration + profile.saltPct + profile.oilPct + directPct) / 100;
  return doughCalc({
    pizzas: 4,
    ballWeight: totalDough / 4,
    hydration: profile.hydration,
    saltPct: profile.saltPct,
    oilPct: profile.oilPct,
    method: 'biga',
    bigaPct,
    bigaHydrationPct,
    roomHours: 2,
    roomTemp,
    fridgeHours: 24,
    fridgeTemp,
    prefermentHours: schedule.prefermentHours,
    yeastType,
    ...(mode === 'manual' ? { yeastMode: 'manual', manualYeastGrams: manualGrams } : {}),
    flourType,
    useDirectYeastModelForBiga: true,
    fermentationSchedule: schedule,
  });
};

let verifiedBudgetScenarios = 0;
for (const style of ['neapolitan', 'romana', 'ny_style']) {
  for (const flourType of ['caputo00', 'manitoba', 'spelt', 'wholeWheat', 'custom']) {
    for (const bigaPct of [20, 50, 70, 100]) {
      for (const bigaHours of [4, 8, 12, 24, 36, 48]) {
        for (const [roomTemp, fridgeTemp] of [[10, 2], [10, 10], [22, 4], [35, 10]]) {
          const hydration = PIZZA_STYLE_PROFILES[style].hydration;
          const maxBigaHydration = Math.min(200, Math.floor(hydration * 100 / bigaPct));
          for (const bigaHydrationPct of [Math.min(45, maxBigaHydration), Math.min(62, maxBigaHydration)]) {
            const schedule = getFermentationSchedule({
              method: 'biga',
              prefermentHours: bigaHours,
              roomHours: 2,
              roomTemp,
              fridgeHours: 24,
              fridgeTemp,
              roomAfterFridgeHours: 2,
            });
            const phases = schedule.phases;
            const prefermentPhases = phases.filter((phase) => phase.kind === 'preferment');
            assert.equal(prefermentPhases.reduce((sum, phase) => sum + phase.hours, 0), bigaHours);
            assert.equal(phases.reduce((sum, phase) => sum + phase.hours, 0), bigaHours + 28);
            assert.equal(prefermentPhases[0].hours, Math.min(8, bigaHours));
            assert.equal(prefermentPhases[0].temperature, roomTemp);
            if (bigaHours > 8) {
              assert.equal(prefermentPhases[1].hours, bigaHours - 8);
              assert.equal(prefermentPhases[1].temperature, fridgeTemp);
            }

            for (const yeastType of ['fresh', 'activeDry', 'dry']) {
              const result = makeBudgetedBigaResult({
                schedule, style, flourType, bigaPct, bigaHydrationPct,
                roomTemp, fridgeTemp, yeastType,
              });
              const actualFlour = result.total.flour;
              const expectedBudget = actualFlour
                * calculateDirectFreshYeastPct(calculateDirectFermentationScheduleExposure(phases))
                * YEAST_MASS_FACTORS[yeastType] / 100;
              const expectedBiga = calculateBigaYeastGrams(
                actualFlour * bigaPct / 100,
                prefermentPhases,
                yeastType,
              );
              assert.ok(Math.abs(result.yeastBudgetGrams - expectedBudget) < 0.00002, `${style}/${flourType}/${bigaPct}/${bigaHours}/${yeastType}: Direct budget mismatch`);
              assert.ok(Math.abs(result.bigaYeastRequiredGrams - expectedBiga) < 1e-10, `${style}/${flourType}/${bigaPct}/${bigaHours}/${yeastType}: raw Biga requirement mismatch`);
              assert.equal(result.bigaYeastGrams, result.bigaYeastRequiredGrams,
                `${style}/${flourType}/${bigaPct}/${bigaHours}/${yeastType}: Biga yeast is not limited by the Direct budget`);
              assert.equal(result.finalDoughYeastGrams, Math.max(0, result.yeastBudgetGrams - result.bigaYeastRequiredGrams));
              assert.ok(Math.abs(result.total.yeast - (result.bigaYeastGrams + result.finalDoughYeastGrams)) < 1e-12);
              assert.ok(result.bigaYeastGrams >= 0 && result.finalDoughYeastGrams >= 0);
              assert.equal(result.bigaYeastExcessGrams, Math.max(0, result.bigaYeastRequiredGrams - result.yeastBudgetGrams));
              assert.equal(result.main.yeast, result.finalDoughYeastGrams);
              assert.equal(result.preferment.yeast, result.bigaYeastGrams);
              assert.equal(result.bigaYeastBudgetExceeded, result.bigaYeastExcessGrams > 0);
              if (bigaPct === 100) assert.ok(result.finalDoughYeastGrams >= 0);
              verifiedBudgetScenarios += 1;
            }
          }
        }
      }
    }
  }
}

const referenceBigaPhases = [
  { kind: 'preferment', environment: 'room', hours: 8, temperature: 22 },
  { kind: 'preferment', environment: 'fridge', hours: 16, temperature: 4 },
];
const referenceBigaGrams = calculateBigaYeastGrams(1000, referenceBigaPhases, 'fresh');
assert.ok(Math.abs(referenceBigaGrams - 0.4464285714285714) < 1e-12);
const referenceAllocation = calculateBigaYeastAllocation(2.235, referenceBigaGrams);
assert.ok(Math.abs(referenceAllocation.finalDoughYeastGrams - 1.7885714285714285) < 1e-12);

const equalityBigaPhases = [{ kind: 'preferment', environment: 'room', hours: 4, temperature: 22 }];
const equalBigaGrams = calculateBigaYeastGrams(1000, equalityBigaPhases, 'fresh');
const equalBigaPct = equalBigaGrams / 10;
const equalExposure = DIRECT_YEAST_REFERENCE.Y_REF * DIRECT_YEAST_REFERENCE.E_REF / equalBigaPct;
const equalFinalFridgeHours = (equalExposure - calculateDirectFermentationScheduleExposure(equalityBigaPhases))
  / calculateDirectFermentationScheduleExposure([{ hours: 1, temperature: 4 }]);
const equalSchedule = getFermentationSchedule({
  method: 'biga', prefermentHours: 4, roomHours: 0, roomTemp: 22,
  fridgeHours: equalFinalFridgeHours, fridgeTemp: 4, roomAfterFridgeHours: 0,
});
const equalResult = makeBudgetedBigaResult({
  schedule: equalSchedule, style: 'neapolitan', flourType: 'caputo00', bigaPct: 100,
  bigaHydrationPct: 45, roomTemp: 22, fridgeTemp: 4, yeastType: 'fresh',
});
assert.equal(equalResult.finalDoughYeastGrams, 0);
assert.equal(equalResult.bigaYeastBudgetExceeded, false);

const excessSchedule = getFermentationSchedule({
  method: 'biga', prefermentHours: 4, roomHours: 2, roomTemp: 22,
  fridgeHours: 72, fridgeTemp: 4, roomAfterFridgeHours: 2,
});
const excessResult = makeBudgetedBigaResult({
  schedule: excessSchedule, style: 'neapolitan', flourType: 'caputo00', bigaPct: 100,
  bigaHydrationPct: 45, roomTemp: 22, fridgeTemp: 4, yeastType: 'fresh',
});
assert.equal(excessResult.finalDoughYeastGrams, 0);
assert.equal(excessResult.bigaYeastGrams, excessResult.bigaYeastRequiredGrams);
assert.equal(excessResult.total.yeast, excessResult.bigaYeastRequiredGrams);
assert.ok(excessResult.bigaYeastRequiredGrams > excessResult.yeastBudgetGrams);
assert.ok(excessResult.bigaYeastExcessGrams > 0);
assert.equal(excessResult.bigaYeastBudgetExceeded, true);

const reportedExampleSchedule = getFermentationSchedule({
  method: 'biga', prefermentHours: 4, roomHours: 24, roomTemp: 10,
  fridgeHours: 72, fridgeTemp: 10, roomAfterFridgeHours: 24,
});
const reportedExample = makeBudgetedBigaResult({
  schedule: reportedExampleSchedule, style: 'neapolitan', flourType: 'caputo00', bigaPct: 100,
  bigaHydrationPct: 62, roomTemp: 10, fridgeTemp: 10, yeastType: 'fresh',
});
assert.ok(Math.abs(reportedExample.yeastBudgetGrams - 0.414) < 0.001);
assert.ok(Math.abs(reportedExample.bigaYeastRequiredGrams - 6.249) < 0.002);
assert.equal(reportedExample.bigaYeastGrams, reportedExample.bigaYeastRequiredGrams);
assert.equal(reportedExample.finalDoughYeastGrams, 0);
assert.equal(reportedExample.total.yeast, reportedExample.bigaYeastRequiredGrams);
assert.equal(reportedExample.bigaYeastBudgetExceeded, true);

for (const invalidHours of [0, -1, 49, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
  assert.throws(() => getFermentationSchedule({
    method: 'biga', prefermentHours: invalidHours, roomHours: 2, roomTemp: 22,
    fridgeHours: 24, fridgeTemp: 4, roomAfterFridgeHours: 2,
  }), RangeError, `${invalidHours}: unsupported Biga duration is rejected`);
}
assert.throws(() => calculateBigaYeastGrams(1000, [], 'fresh'), /finite positive fermentation phases/);
assert.throws(() => calculateBigaYeastGrams(1000, [
  { kind: 'preferment', environment: 'room', hours: Number.NaN, temperature: 22 },
], 'fresh'), /finite positive fermentation phases/);
assert.throws(() => doughCalc({
  pizzas: 4, ballWeight: 250, hydration: 65, saltPct: 2.8, oilPct: 0,
  method: 'biga', bigaPct: Number.NaN, roomHours: 2, roomTemp: 22,
  fridgeHours: 24, fridgeTemp: 4, prefermentHours: 24,
}), /Biga flour percentage must be finite/);

const manualSchedule = getFermentationSchedule({
  method: 'biga', prefermentHours: 24, roomHours: 2, roomTemp: 22,
  fridgeHours: 24, fridgeTemp: 4, roomAfterFridgeHours: 2,
});
const manualResult = makeBudgetedBigaResult({
  schedule: manualSchedule, style: 'neapolitan', flourType: 'caputo00', bigaPct: 100,
  bigaHydrationPct: 45, roomTemp: 22, fridgeTemp: 4, yeastType: 'activeDry',
  mode: 'manual', manualGrams: 1,
});
assert.equal(manualResult.yeastBudgetGrams, 1);
assert.equal(manualResult.total.yeast, manualResult.bigaYeastGrams + manualResult.finalDoughYeastGrams);
assert.ok(Math.abs(manualResult.total.yeast - Math.max(manualResult.yeastBudgetGrams, manualResult.bigaYeastRequiredGrams)) < 1e-12);

const manualOverBudgetResult = makeBudgetedBigaResult({
  schedule: manualSchedule, style: 'neapolitan', flourType: 'caputo00', bigaPct: 100,
  bigaHydrationPct: 45, roomTemp: 22, fridgeTemp: 4, yeastType: 'activeDry',
  mode: 'manual', manualGrams: 0.1,
});
assert.ok(manualOverBudgetResult.bigaYeastBudgetExceeded);
assert.equal(manualOverBudgetResult.bigaYeastGrams, manualOverBudgetResult.bigaYeastRequiredGrams);
assert.equal(manualOverBudgetResult.total.yeast, manualOverBudgetResult.bigaYeastRequiredGrams);
assert.equal(manualOverBudgetResult.finalDoughYeastGrams, 0);

const finalDurationBudgets = [12, 24, 48].map((fridgeHours) => {
  const schedule = getFermentationSchedule({
    method: 'biga', prefermentHours: 24, roomHours: 2, roomTemp: 22,
    fridgeHours, fridgeTemp: 4, roomAfterFridgeHours: 2,
  });
  return makeBudgetedBigaResult({
    schedule, style: 'neapolitan', flourType: 'caputo00', bigaPct: 50,
    bigaHydrationPct: 45, roomTemp: 22, fridgeTemp: 4, yeastType: 'fresh',
  }).yeastBudgetGrams;
});
assert.ok(finalDurationBudgets[0] > finalDurationBudgets[1]);
assert.ok(finalDurationBudgets[1] > finalDurationBudgets[2]);

assert.match(calculatorSource, /useDirectYeastModelForBiga: !isBeginner && method === 'biga'/);
assert.match(calculatorSource, /yeastBudgetGrams: dough\.yeastBudgetGrams/);
assert.match(calculatorSource, /bigaYeastGrams: dough\.bigaYeastGrams/);
assert.match(calculatorSource, /bigaYeastRequiredGrams: dough\.bigaYeastRequiredGrams/);
assert.match(calculatorSource, /yeastBudgetGrams: dough\.yeastBudgetGrams,[\s\S]*bigaYeastRequiredGrams: dough\.bigaYeastRequiredGrams/);
assert.match(calculatorSource, /finalDoughYeastGrams: dough\.finalDoughYeastGrams/);
assert.match(calculatorSource, /bigaYeastExcessGrams: dough\.bigaYeastExcessGrams/);
assert.match(calculatorSource, /applyRecipe = \(recipe: any\) =>/);
assert.match(calculatorSource, /dough\.bigaYeastBudgetExceeded \? yeastSettingsCopy\.bigaBudgetWarning : yeastSettingsCopy\.bigaBudgetSummary/);
assert.match(calculatorSource, /setBigaPct\(settings\.bigaPct\)/);
assert.match(calculatorSource, /setBigaHours\(settings\.bigaHours\)/);
assert.match(calculatorSource, /setBigaHydrationPct\(normalizeProBigaHydrationPct\(settings\.bigaHydrationPct\)\)/);
assert.match(calculatorSource, /setRoomTemp\(settings\.roomTemp\)/);
assert.match(calculatorSource, /setRoomHours\(settings\.roomHours\)/);
assert.match(calculatorSource, /setFridgeTemp\(settings\.fridgeTemp\)/);
assert.match(calculatorSource, /setFridgeHours\(settings\.fridgeHours\)/);
assert.match(plannerSource, /bigaYeastGrams/);
assert.match(plannerSource, /bigaYeastRequiredGrams/);
assert.match(plannerSource, /bigaYeastBudgetExceeded/);
assert.match(plannerSource, /activeYeastSummary\.bigaYeastBudgetExceeded && \(activeYeastSummary\.bigaYeastExcessGrams \?\? 0\) > 0/);
for (const lang of ['hr', 'en', 'de', 'sl']) {
  assert.ok(yeastCopyModule.exports.YEAST_SETTINGS_COPY[lang].bigaBudgetSummary.includes('{BUDGET}'));
  assert.ok(yeastCopyModule.exports.YEAST_SETTINGS_COPY[lang].bigaBudgetWarning.includes('{EXCESS}'));
  assert.ok(yeastCopyModule.exports.YEAST_SETTINGS_COPY[lang].bigaBudgetWarning.includes('{REQUIRED}'));
  assert.ok(yeastCopyModule.exports.YEAST_SETTINGS_COPY[lang].bigaBudgetWarning.includes('{BIGA}'));
  assert.ok(yeastCopyModule.exports.YEAST_SETTINGS_COPY[lang].bigaBudgetWarning.includes('{FINAL}'));
  assert.doesNotMatch(yeastCopyModule.exports.YEAST_SETTINGS_COPY[lang].bigaBudgetWarning, /cap|limit|begrenz|omej|ogranič/i);
}

console.log(`F30 Biga budget regression passed: ${verifiedBudgetScenarios} Calculator combinations plus exact reference, zero-remainder, over-budget, Planner, recipe, and HR/EN/DE/SL checks.`);
