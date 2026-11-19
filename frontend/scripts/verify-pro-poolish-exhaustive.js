#!/usr/bin/env node

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const frontendRoot = path.join(__dirname, '..');
const calculatorUiSource = fs.readFileSync(path.join(frontendRoot, 'app', '(tabs)', 'index.tsx'), 'utf8');
const plannerUiSource = fs.readFileSync(path.join(frontendRoot, 'app', '(tabs)', 'planner.tsx'), 'utf8');

function loadTypeScriptModule(filePath) {
  const source = fs.readFileSync(filePath, 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const module = { exports: {} };
  const localRequire = (request) => {
    if (request.startsWith('.')) {
      return loadTypeScriptModule(path.resolve(path.dirname(filePath), `${request}.ts`));
    }
    if (request === './spiralMixing') {
      return loadTypeScriptModule(path.join(frontendRoot, 'src', 'i18n', 'spiralMixing.ts'));
    }
    if (request === './proIceWaterInstructions') {
      return loadTypeScriptModule(path.join(frontendRoot, 'src', 'i18n', 'proIceWaterInstructions.ts'));
    }
    throw new Error(`Unexpected runtime import in ${filePath}: ${request}`);
  };
  vm.runInNewContext(compiled, { module, exports: module.exports, require: localRequire });
  return module.exports;
}

const {
  doughCalc,
  getFermentationSchedule,
  YEAST_MASS_FACTORS,
} = loadTypeScriptModule(path.join(frontendRoot, 'src', 'calculator.ts'));

const temperatures = [4, 5, 6, 7, 8, 9, 10, 11, 12, 15, 18, 20, 22, 25, 28, 30, 32, 35];
const durations = [4, 5, 6, 8, 10, 12, 16, 18, 20, 24, 30, 36, 42, 48];
const poolishShares = [20, 25, 30, 35, 40, 45, 50, 60, 70, 80, 90, 100];
const poolishHydrations = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130, 150, 175, 200];
const totalHydrations = [50, 55, 60, 65, 70, 75, 80, 85, 90];
const yeastTypes = ['fresh', 'activeDry', 'dry'];
const flourSamples = [250, 250.49, 250.5, 250.51, 333.33, 1000, 2499.51, 5000];
const saltPct = 2.8;
const oilPct = 0;
const standardFinal = { roomHours: 2, roomTemp: 22, fridgeHours: 24, fridgeTemp: 4, roomAfterFridgeHours: 2 };
const round = (value, places) => Math.round(value * (10 ** places)) / (10 ** places);
const poolishRate = (temperature) => temperature <= 10
  ? 0.12 * (1 + 0.05 * (temperature - 4))
  : 1 + 0.08 * (temperature - 20);

const shareValidatorSource = calculatorUiSource.match(/const isValidProPrefermentShare = \(value: unknown\): value is number =>[\s\S]*?;/)?.[0];
assert.ok(shareValidatorSource, 'the shared Biga/Poolish share validator must exist');
const shareValidatorModule = { exports: {} };
vm.runInNewContext(ts.transpileModule(
  `${shareValidatorSource}\nmodule.exports = isValidProPrefermentShare;`,
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } },
).outputText, {
  module: shareValidatorModule,
  exports: shareValidatorModule.exports,
});
const isValidProPrefermentShare = shareValidatorModule.exports;
assert.equal(isValidProPrefermentShare(0), true, 'combined preferment allocation permits a zero share');
assert.equal(isValidProPrefermentShare(20), true);
assert.equal(isValidProPrefermentShare(100), true);
assert.equal(isValidProPrefermentShare(100.01), false);
assert.equal(isValidProPrefermentShare(Number.NaN), false);
assert.match(calculatorUiSource, /isValidProPrefermentShare\(savedBigaPct\) && isValidProPrefermentShare\(savedPoolishPct\)/,
  'restored Biga and Poolish shares use the shared validator');
assert.match(calculatorUiSource,
  /typeof saved\.poolishHours === 'number' && Number\.isFinite\(saved\.poolishHours\) && saved\.poolishHours >= 4 && saved\.poolishHours <= 48/,
  'restored Poolish duration must stay within 4–48 hours');
assert.match(calculatorUiSource,
  /typeof savedBigaPct === 'number' && typeof savedPoolishPct === 'number'/,
  'loaded Biga and Poolish shares must both be numeric');
assert.match(calculatorUiSource,
  /typeof settings\.poolishHours === 'number' && Number\.isFinite\(settings\.poolishHours\) && settings\.poolishHours >= 4 && settings\.poolishHours <= 48/,
  'loaded Poolish duration must stay within 4–48 hours');
assert.match(calculatorUiSource, /const maxProPoolishPct = combinedPrefermentsActive\s*\?\s*80\s*:\s*Math\.min\(100, Math\.max\(20, Math\.floor\(hydration \* 100 \/ poolishHydrationPct\)\)\)/,
  'Poolish share ceiling follows total hydration');
assert.match(calculatorUiSource, /const poolishHydrationPct = 100;/,
  'Poolish hydration remains fixed at 100%');
assert.match(calculatorUiSource, /customBallWeight, method, bigaEnabled, poolishEnabled, bigaPct, poolishPct, bigaHours, poolishHours,/);
assert.match(calculatorUiSource, /poolishFermentationMode, poolishRtHours, poolishCtHours, poolishRtTemperatureC, poolishCtTemperatureC/,
  'saved recipe settings include Poolish share, hydration, and temperature');
assert.match(calculatorUiSource, /quantityGrams: activeYeastQuantity/,
  'Calculator yeast summary stores grams separately from baker percentage');
assert.match(calculatorUiSource, /activeYeastQuantity = method === 'sponge'[^\n]*dough\.total\.yeast/,
  'Calculator total-yeast quantity comes from the result grams field');
assert.ok(calculatorUiSource.includes('value={weight(dough.total.yeast, true)}'),
  'Calculator renders the total yeast quantity using gram formatting');
assert.match(plannerUiSource, /format\(activeYeastSummary\.quantityGrams\)/,
  'Planner displays the gram quantity separately from baker percentage');
assert.match(plannerUiSource, /format\(activeYeastSummary\.bakerPercentage\)/,
  'Planner displays baker percentage as a separate value');

function scheduleFor(temperature, hours, final = standardFinal) {
  return getFermentationSchedule({
    method: 'poolish',
    prefermentHours: hours,
    prefermentTempC: temperature,
    ...final,
  });
}

function resultFor({ temperature, hours, poolishPct, poolishHydrationPct, hydration, yeastType, flourGrams }) {
  const schedule = scheduleFor(temperature, hours);
  const exposure = schedule.phases.reduce((total, phase) => total + phase.hours * poolishRate(phase.temperature), 0);
  const yeastPct = 0.5 / exposure * YEAST_MASS_FACTORS[yeastType];
  const ballWeight = flourGrams * (100 + hydration + saltPct + oilPct + yeastPct) / 100;
  const calculatedFlour = (ballWeight / (100 + hydration + saltPct + oilPct + yeastPct)) * 100;
  const result = doughCalc({
    pizzas: 1,
    ballWeight,
    hydration,
    saltPct,
    oilPct,
    method: 'poolish',
    poolishPct,
    poolishHydrationPct,
    poolishFermentationTempC: temperature,
    prefermentHours: hours,
    yeastType,
    roomHours: standardFinal.roomHours,
    roomTemp: standardFinal.roomTemp,
    fridgeHours: standardFinal.fridgeHours,
    fridgeTemp: standardFinal.fridgeTemp,
    fermentationSchedule: schedule,
  });
  return { result, schedule, exposure, calculatedFlour };
}

function assertYeastAndFlour(result, exposure, poolishPct, yeastType, flourGrams, label) {
  const rawYeastPct = (0.5 / exposure) * YEAST_MASS_FACTORS[yeastType];
  const expectedYeastPct = round(rawYeastPct, 2);
  assert.equal(result.yeastPct, expectedYeastPct, `${label}: displayed baker's percentage`);
  assert.equal(result.total.flour, Math.round(flourGrams), `${label}: displayed total flour`);
  assert.ok(Number.isFinite(result.eTotal) && result.eTotal >= 0, `${label}: finite nonnegative exposure`);
  assert.ok(Number.isFinite(result.total.yeast) && result.total.yeast >= 0, `${label}: finite nonnegative total yeast`);
  assert.ok(result.preferment.yeast >= 0 && result.main.yeast >= 0, `${label}: no negative phase yeast`);
  assert.equal(round(result.preferment.yeast + result.main.yeast, 2), result.total.yeast,
    `${label}: phase yeast adds to total after display rounding`);
  assert.equal(result.total.yeast, round(flourGrams * (rawYeastPct / 100), 2),
    `${label}: total grams use the unrounded internal baker percentage`);

  const roundedPrefermentFlour = Math.round(result.total.flour * poolishPct / 100);
  const expectedPrefermentYeast = round(result.total.yeast * roundedPrefermentFlour / result.total.flour, 2);
  assert.equal(result.preferment.yeast, expectedPrefermentYeast, `${label}: yeast follows the configured flour-share allocation`);
  assert.equal(result.main.yeast, round(result.total.yeast - expectedPrefermentYeast, 2),
    `${label}: final dough receives the remaining yeast`);
}

let yeastCases = 0;
let temperatureDurationPairs = 0;
for (const temperature of temperatures) {
  const rate = poolishRate(temperature);
  assert.ok(Number.isFinite(rate) && rate > 0, `${temperature}°C: activity rate is positive and finite`);
  const environment = temperature <= 10 ? 'fridge' : 'room';
  for (const hours of durations) {
    const schedule = scheduleFor(temperature, hours);
    const preferment = schedule.phases.filter((phase) => phase.kind === 'preferment');
    assert.equal(preferment.length, 1, `${temperature}°C/${hours}h: one positive-duration preferment phase`);
    assert.equal(preferment[0].environment, environment, `${temperature}°C: expected regime`);
    assert.equal(preferment[0].temperature, temperature, `${temperature}°C: selected temperature is retained`);
    assert.equal(preferment[0].hours, hours, `${temperature}°C: selected duration is retained`);
    const expectedExposure = hours * rate
      + standardFinal.roomHours * poolishRate(standardFinal.roomTemp)
      + standardFinal.fridgeHours * poolishRate(standardFinal.fridgeTemp)
      + standardFinal.roomAfterFridgeHours * poolishRate(standardFinal.roomTemp);
    assert.ok(expectedExposure > 0.5, `${temperature}°C/${hours}h: minimum exposure clamp is not binding`);

    let previousDose = Number.POSITIVE_INFINITY;
    for (const yeastType of yeastTypes) {
      const { result, exposure, calculatedFlour } = resultFor({
        temperature, hours, poolishPct: 35, poolishHydrationPct: 100,
        hydration: 62, yeastType, flourGrams: 1000,
      });
      assert.equal(exposure, expectedExposure, `${temperature}°C/${hours}h/${yeastType}: exposure formula`);
      assert.equal(result.eTotal, round(expectedExposure, 1), `${temperature}°C/${hours}h: exposure display rounding`);
      assertYeastAndFlour(result, exposure, 35, yeastType, calculatedFlour, `${temperature}°C/${hours}h/${yeastType}`);
      assert.ok(result.total.yeast <= previousDose + 0.01, `${temperature}°C/${yeastType}: dose must not increase with duration`);
      previousDose = result.total.yeast;
      yeastCases += 1;
    }
    temperatureDurationPairs += 1;
  }
}

assert.ok(poolishRate(11) > poolishRate(10), '10→11°C crosses the current piecewise-rate discontinuity');
assert.equal(poolishRate(10), 0.156);
assert.equal(poolishRate(11), 0.28);

const noFinalPhases = { roomHours: 0, roomTemp: 22, fridgeHours: 0, fridgeTemp: 4, roomAfterFridgeHours: 0 };
const shortColdSchedule = scheduleFor(4, 4, noFinalPhases);
const shortColdExposure = 4 * poolishRate(4);
const shortColdFlour = 1000;
const shortColdYeastPct = 0.5 / shortColdExposure;
const shortColdWeight = shortColdFlour * (100 + 62 + saltPct + shortColdYeastPct) / 100;
const shortColdResult = doughCalc({
  pizzas: 1, ballWeight: shortColdWeight, hydration: 62, saltPct, oilPct, method: 'poolish',
  poolishPct: 35, poolishHydrationPct: 100, poolishFermentationTempC: 4, prefermentHours: 4,
  roomHours: 0, roomTemp: 22, fridgeHours: 0, fridgeTemp: 4, fermentationSchedule: shortColdSchedule,
});
assert.equal(shortColdExposure, 0.48);
assert.equal(shortColdResult.total.flour, 1000);
assert.equal(shortColdResult.yeastPct, 1.04, '4°C/4h displays 1.04% baker percentage');
assert.equal(shortColdResult.total.yeast, 10.42, '4°C/4h produces 10.42 g fresh yeast per 1 kg flour, not 1.04 g');
assert.equal(shortColdResult.preferment.yeast, 3.65, '35% share assigns the proportional Poolish yeast in grams');
assert.equal(shortColdResult.main.yeast, 6.77, '35% share assigns the remaining yeast to final dough in grams');

const yeastGramExposures = [0.48, 0.5, 1, 2, 5, 10.4, 35.36];
let yeastGramCases = 0;
for (const exposureTarget of yeastGramExposures) {
  const useWarmPreferment = exposureTarget > 27.84;
  const prefermentTempC = useWarmPreferment ? 22 : 4;
  const prefermentHours = useWarmPreferment ? 24 : 4;
  const prefermentExposure = prefermentHours * poolishRate(prefermentTempC);
  const roomHours = (exposureTarget - prefermentExposure) / poolishRate(22);
  assert.ok(roomHours >= 0, `${exposureTarget}: test schedule has nonnegative final room time`);
  const schedule = getFermentationSchedule({
    method: 'poolish', prefermentHours, prefermentTempC,
    roomHours, roomTemp: 22, fridgeHours: 0, fridgeTemp: 4, roomAfterFridgeHours: 0,
  });
  const actualExposure = schedule.phases.reduce((total, phase) => total + phase.hours * poolishRate(phase.temperature), 0);
  assert.ok(Math.abs(actualExposure - exposureTarget) < 1e-10, `${exposureTarget}: test schedule hits the requested exposure`);

  for (const yeastType of yeastTypes) {
    const rawYeastPct = (0.5 / exposureTarget) * YEAST_MASS_FACTORS[yeastType];
    const expectedGramsPerKg = 1000 * rawYeastPct / 100;
    const ballWeight = 1000 * (100 + 62 + saltPct + rawYeastPct) / 100;
    const result = doughCalc({
      pizzas: 1, ballWeight, hydration: 62, saltPct, oilPct, method: 'poolish',
      poolishPct: 35, poolishHydrationPct: 100, poolishFermentationTempC: prefermentTempC,
      prefermentHours, yeastType, roomHours, roomTemp: 22, fridgeHours: 0, fridgeTemp: 4,
      fermentationSchedule: schedule,
    });
    assert.equal(result.total.flour, 1000, `${exposureTarget}/${yeastType}: exactly 1 kg displayed flour`);
    assert.equal(result.yeastPct, round(rawYeastPct, 2), `${exposureTarget}/${yeastType}: displayed percent`);
    assert.equal(result.total.yeast, round(expectedGramsPerKg, 2),
      `${exposureTarget}/${yeastType}: actual total grams per 1 kg flour`);
    assert.ok(Math.abs(result.total.yeast - expectedGramsPerKg) <= 0.005,
      `${exposureTarget}/${yeastType}: grams match the unrounded calculation within display rounding`);

    if (exposureTarget === 0.48) {
      for (const poolishPct of [20, 35, 50, 70, 100]) {
        const allocationBallWeight = 1000 * (100 + 100 + saltPct + rawYeastPct) / 100;
        const allocation = doughCalc({
          pizzas: 1, ballWeight: allocationBallWeight, hydration: 100, saltPct, oilPct, method: 'poolish',
          poolishPct, poolishHydrationPct: 100, poolishFermentationTempC: 4, prefermentHours: 4,
          yeastType, roomHours: 0, roomTemp: 22, fridgeHours: 0, fridgeTemp: 4,
          fermentationSchedule: shortColdSchedule,
        });
        const expectedPoolishGrams = round(allocation.total.yeast * poolishPct / 100, 2);
        const expectedFinalGrams = round(allocation.total.yeast - expectedPoolishGrams, 2);
        assert.equal(allocation.total.flour, 1000, `${yeastType}/${poolishPct}%: exactly 1 kg flour`);
        assert.equal(allocation.total.yeast, round(expectedGramsPerKg, 2), `${yeastType}/${poolishPct}%: total grams are not double-counted`);
        assert.equal(allocation.preferment.yeast, expectedPoolishGrams, `${yeastType}/${poolishPct}%: Poolish yeast grams`);
        assert.equal(allocation.main.yeast, expectedFinalGrams, `${yeastType}/${poolishPct}%: final-dough yeast grams`);
        assert.equal(round(allocation.preferment.yeast + allocation.main.yeast, 2), allocation.total.yeast,
          `${yeastType}/${poolishPct}%: phase grams sum to total grams`);
      }
    }
    yeastGramCases += 1;
  }
}
assert.throws(() => doughCalc({
  pizzas: 1, ballWeight: 1000, hydration: 62, saltPct, oilPct, method: 'poolish',
  poolishPct: 35, poolishHydrationPct: 100, poolishFermentationTempC: 4, prefermentHours: 0,
  roomHours: 0, roomTemp: 22, fridgeHours: 0, fridgeTemp: 4,
  fermentationSchedule: scheduleFor(4, 0, noFinalPhases),
}), /positive finite schedule exposure/, 'zero-exposure Poolish is rejected instead of receiving an artificial yeast dose');

let feasibleHydrationCases = 0;
let infeasibleHydrationCases = 0;
for (const hydration of totalHydrations) {
  for (const poolishPct of poolishShares) {
    for (const poolishHydrationPct of poolishHydrations) {
      const feasible = poolishPct * poolishHydrationPct <= hydration * 100;
      const maxPct = Math.min(100, Math.max(20, Math.floor(hydration * 100 / poolishHydrationPct)));
      const maxHydration = Math.min(200, Math.floor(hydration * 100 / poolishPct));
      assert.ok(poolishPct <= maxPct || !feasible, `${hydration}/${poolishPct}/${poolishHydrationPct}: UI share bound`);
      assert.ok(poolishHydrationPct <= maxHydration || !feasible,
        `${hydration}/${poolishPct}/${poolishHydrationPct}: UI hydration bound`);
      if (!feasible) {
        infeasibleHydrationCases += 1;
        continue;
      }

      for (const yeastType of yeastTypes) {
        const { result, exposure, calculatedFlour } = resultFor({
          temperature: 22, hours: 24, poolishPct, poolishHydrationPct,
          hydration, yeastType, flourGrams: 1000,
        });
        const totalWater = Math.round(result.total.flour * hydration / 100);
        const prefermentFlour = Math.round(result.total.flour * poolishPct / 100);
        const prefermentWater = Math.round(result.total.flour * poolishPct / 100 * poolishHydrationPct / 100);
        assert.equal(result.preferment.flour, prefermentFlour, `${hydration}/${poolishPct}/${poolishHydrationPct}: Poolish flour`);
        assert.equal(result.main.flour, result.total.flour - prefermentFlour, `${hydration}/${poolishPct}/${poolishHydrationPct}: remaining flour`);
        assert.equal(result.total.water, totalWater, `${hydration}/${poolishPct}/${poolishHydrationPct}: total water`);
        assert.equal(result.preferment.water, prefermentWater, `${hydration}/${poolishPct}/${poolishHydrationPct}: Poolish water`);
        assert.equal(result.main.water, totalWater - prefermentWater, `${hydration}/${poolishPct}/${poolishHydrationPct}: remaining water`);
        assert.ok(result.main.water >= 0, `${hydration}/${poolishPct}/${poolishHydrationPct}: remaining water is nonnegative`);
        assert.equal(result.preferment.flour + result.main.flour, result.total.flour);
        assert.equal(result.preferment.water + result.main.water, result.total.water);
        assertYeastAndFlour(result, exposure, poolishPct, yeastType, calculatedFlour,
          `${hydration}/${poolishPct}/${poolishHydrationPct}/${yeastType}`);
        feasibleHydrationCases += 1;
      }
    }
  }
}

let fractionalWaterBoundaryCases = 0;
for (const [hydration, poolishPct, poolishHydrationPct] of [
  [50, 25, 200],
  [50, 100, 50],
  [70, 35, 200],
  [75, 60, 125],
  [90, 90, 100],
  [90, 100, 90],
]) {
  assert.ok(poolishPct * poolishHydrationPct <= hydration * 100, 'boundary fixture must be feasible');
  for (const flourGrams of flourSamples) {
    const { result, calculatedFlour } = resultFor({
      temperature: 22, hours: 24, poolishPct, poolishHydrationPct,
      hydration, yeastType: 'fresh', flourGrams,
    });
    const expectedTotalWater = Math.round(calculatedFlour * hydration / 100);
    const expectedPrefermentWater = Math.round(calculatedFlour * poolishPct / 100 * poolishHydrationPct / 100);
    assert.equal(result.total.water, expectedTotalWater, `${hydration}/${poolishPct}/${poolishHydrationPct}/${flourGrams}g: total water rounding`);
    assert.equal(result.preferment.water, expectedPrefermentWater, `${hydration}/${poolishPct}/${poolishHydrationPct}/${flourGrams}g: preferment water rounding`);
    assert.equal(result.main.water, expectedTotalWater - expectedPrefermentWater,
      `${hydration}/${poolishPct}/${poolishHydrationPct}/${flourGrams}g: remaining water`);
    assert.ok(result.main.water >= 0, `${hydration}/${poolishPct}/${poolishHydrationPct}/${flourGrams}g: no negative remaining water`);
    fractionalWaterBoundaryCases += 1;
  }
}

let allocationCases = 0;
for (const temperature of Array.from({ length: 32 }, (_, index) => index + 4)) {
  for (let hours = 4; hours <= 48; hours += 1) {
    for (let poolishPct = 20; poolishPct <= 100; poolishPct += 5) {
      for (const yeastType of yeastTypes) {
        for (const flourGrams of flourSamples) {
          const { result, exposure, calculatedFlour } = resultFor({
            temperature, hours, poolishPct, poolishHydrationPct: 100,
            hydration: 70, yeastType, flourGrams,
          });
          assertYeastAndFlour(result, exposure, poolishPct, yeastType, calculatedFlour,
            `${temperature}°C/${hours}h/${poolishPct}%/${yeastType}/${flourGrams}g`);
          allocationCases += 1;
        }
      }
    }
  }
}

let scheduleCases = 0;
for (let temperature = 4; temperature <= 35; temperature += 1) {
  for (const prefermentHours of [0, 4, 48]) {
    for (const roomHours of [0, 2, 24]) {
      for (const fridgeHours of [0, 2, 72]) {
        for (const roomAfterFridgeHours of [0, 2, 24]) {
          const schedule = scheduleFor(temperature, prefermentHours, {
            roomHours, roomTemp: 22, fridgeHours, fridgeTemp: 4, roomAfterFridgeHours,
          });
          const sum = schedule.phases.reduce((total, phase) => total + phase.hours, 0);
          assert.ok(schedule.phases.every((phase) => Number.isFinite(phase.hours) && phase.hours > 0),
            `${temperature}°C: no zero, negative, or non-finite schedule phase`);
          assert.equal(sum, prefermentHours + roomHours + fridgeHours + roomAfterFridgeHours,
            `${temperature}°C: schedule sum`);
          const kinds = schedule.phases.map((phase) => phase.kind);
          const prefermentIndex = kinds.indexOf('preferment');
          const finalIndex = kinds.indexOf('final');
          const finalRestIndex = kinds.indexOf('final-rest');
          assert.ok(prefermentIndex < 0 || finalIndex < 0 || prefermentIndex < finalIndex,
            `${temperature}°C: preferment precedes final fermentation`);
          assert.ok(finalIndex < 0 || finalRestIndex < 0 || finalIndex < finalRestIndex,
            `${temperature}°C: final fermentation precedes final rest`);
          scheduleCases += 1;
        }
      }
    }
  }
}

for (const invalidTemperature of [3, 36, Number.NaN, Number.POSITIVE_INFINITY]) {
  assert.throws(() => scheduleFor(invalidTemperature, 24), /Poolish fermentation temperature must be between 4°C and 35°C/,
    `${invalidTemperature}: unsupported temperature rejected`);
}
for (const invalidHours of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
  assert.throws(() => getFermentationSchedule({
    method: 'poolish', prefermentHours: invalidHours, prefermentTempC: 22,
    ...standardFinal,
  }), /Poolish fermentation schedule values must be finite/,
  `${invalidHours}: non-finite Poolish duration rejected`);
}
const validInvalidShareSchedule = scheduleFor(22, 24);
assert.throws(() => doughCalc({
  pizzas: 1, ballWeight: 1000, hydration: 62, saltPct, oilPct, method: 'poolish',
  poolishPct: Number.NaN, poolishHydrationPct: 100, poolishFermentationTempC: 22,
  prefermentHours: 24, roomHours: 2, roomTemp: 22, fridgeHours: 24, fridgeTemp: 4,
  fermentationSchedule: validInvalidShareSchedule,
}), /Poolish flour percentage must be finite/, 'non-finite Poolish share is rejected');
assert.equal(scheduleFor(22, -4).phases.some((phase) => phase.kind === 'preferment'), false,
  'negative preferment duration is clamped out of the schedule');

async function verifyPoolishRecipePersistence() {
  const values = new Map();
  const asyncStorage = {
    async getItem(key) { return values.get(key) ?? null; },
    async setItem(key, value) { values.set(key, value); },
  };
  const filePath = path.join(frontendRoot, 'src', 'proSavedRecipes.ts');
  const source = fs.readFileSync(filePath, 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText;
  const loadStorageModule = () => {
    const module = { exports: {} };
    const mockRequire = (request) => {
      assert.equal(request, '@react-native-async-storage/async-storage');
      return { __esModule: true, default: asyncStorage };
    };
    new Function('require', 'module', 'exports', compiled)(mockRequire, module, module.exports);
    return module.exports;
  };

  const savedSettings = {
    pizzaStyle: 'romana', romanFormat: 'tonda', flour: 'caputo00', method: 'poolish',
    poolishPct: 70, poolishHydrationPct: 120, poolishHours: 36, poolishFermentationTempC: 8,
    hydration: 85, roomHours: 2, roomTemp: 22, fridgeHours: 18, fridgeTemp: 4,
    proMode: true, preferredYeastType: 'activeDry',
  };
  const before = getFermentationSchedule({
    method: 'poolish', prefermentHours: savedSettings.poolishHours,
    prefermentTempC: savedSettings.poolishFermentationTempC,
    roomHours: savedSettings.roomHours, roomTemp: savedSettings.roomTemp,
    fridgeHours: savedSettings.fridgeHours, fridgeTemp: savedSettings.fridgeTemp,
    roomAfterFridgeHours: 2,
  });
  let recipeStore = loadStorageModule();
  const saved = await recipeStore.saveProRecipe('Poolish QA', { settings: savedSettings, style_id: savedSettings.pizzaStyle });
  recipeStore = loadStorageModule();
  let recipes = await recipeStore.getProSavedRecipes();
  assert.equal(recipes.length, 1, 'Poolish recipe survives a simulated module restart');
  assert.deepEqual(recipes[0].recipe.settings, savedSettings, 'Poolish inputs and yeast preference survive persistence');
  const restored = recipes[0].recipe.settings;
  const after = getFermentationSchedule({
    method: restored.method, prefermentHours: restored.poolishHours,
    prefermentTempC: restored.poolishFermentationTempC,
    roomHours: restored.roomHours, roomTemp: restored.roomTemp,
    fridgeHours: restored.fridgeHours, fridgeTemp: restored.fridgeTemp,
    roomAfterFridgeHours: 2,
  });
  assert.deepEqual(after.phases, before.phases, 'Poolish fermentation phases regenerate identically from saved settings');
  const duplicate = await recipeStore.saveProRecipe('Poolish copy', recipes[0].recipe);
  assert.notEqual(duplicate.recipe_id, saved.recipe_id, 'duplicating a Poolish recipe creates a distinct record');
  await recipeStore.saveProRecipe('Edited Poolish', { ...recipes[0].recipe, hydration: 80 }, saved.recipe_id);
  recipeStore = loadStorageModule();
  recipes = await recipeStore.getProSavedRecipes();
  assert.equal(recipes.length, 2, 'editing updates the existing Poolish record');
  assert.equal(recipes.find((item) => item.recipe_id === saved.recipe_id).recipe.hydration, 80);
  await recipeStore.deleteProRecipe(duplicate.recipe_id);
  assert.equal((await recipeStore.getProSavedRecipes()).length, 1, 'deleting the duplicate preserves the edited Poolish recipe');
}

verifyPoolishRecipePersistence()
  .then(() => console.log(`Poolish exhaustive QA passed: ${temperatureDurationPairs} temperature-duration pairs; ${yeastCases} yeast cases; ${yeastGramCases} explicit gram cases; ${feasibleHydrationCases} feasible and ${infeasibleHydrationCases} infeasible hydration combinations; ${fractionalWaterBoundaryCases} fractional water-boundary cases; ${allocationCases} yeast-allocation cases; ${scheduleCases} schedule combinations; saved-recipe CRUD/restart passed.`))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });