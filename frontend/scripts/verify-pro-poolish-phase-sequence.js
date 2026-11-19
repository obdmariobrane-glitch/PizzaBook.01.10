#!/usr/bin/env node

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const frontendRoot = path.join(__dirname, '..');
const indexPath = path.join(frontendRoot, 'app', '(tabs)', 'index.tsx');
const indexSource = fs.readFileSync(indexPath, 'utf8');
const indexFile = ts.createSourceFile(indexPath, indexSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

function findInitializer(sourceFile, name) {
  let initializer;
  const visit = (node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === name) {
      initializer = node.initializer;
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  assert.ok(initializer, `expected ${name} to have an initializer`);
  return initializer;
}

function evaluate(source, context = {}) {
  const module = { exports: {} };
  const compiled = ts.transpileModule(`module.exports = (${source});`, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  vm.runInNewContext(compiled, {
    module,
    exports: module.exports,
    poolishFinalMixYeastType: context.preferredYeastType,
    ...context,
  });
  return module.exports;
}

function loadTypeScriptModule(filePath) {
  const source = fs.readFileSync(filePath, 'utf8');
  const compiled = ts.transpileModule(source, {
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
    if (request === './proMethods/bigaPoolish') {
      return loadTypeScriptModule(path.join(frontendRoot, 'src', 'proMethods', 'bigaPoolish.ts'));
    }
    throw new Error(`Unexpected runtime import in ${filePath}: ${request}`);
  };
  vm.runInNewContext(compiled, { module, exports: module.exports, require: localRequire });
  return module.exports;
}

function findPoolishP1Guard(sourceFile) {
  let guard;
  const visit = (node) => {
    if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(sourceFile) === 'PhaseBlock') {
      const title = node.attributes.properties.find(
        (attribute) => ts.isJsxAttribute(attribute) && attribute.name.getText(sourceFile) === 'title',
      );
      if (title?.initializer && ts.isJsxExpression(title.initializer)
        && title.initializer.expression?.getText(sourceFile) === 'path.p1.title') {
        let branch = node;
        while (branch.parent && !ts.isConditionalExpression(branch.parent)) branch = branch.parent;
        if (ts.isConditionalExpression(branch.parent)) guard = branch.parent.condition.getText(sourceFile);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  assert.ok(guard, 'expected the detailed Poolish P1 phase to have a render guard');
  return guard;
}

const poolishPreparationInitializer = findInitializer(indexFile, 'poolishPreparation');
const poolishMixStepsInitializer = findInitializer(indexFile, 'poolishMixSteps');
const poolishPreparationSource = poolishPreparationInitializer.getText(indexFile);
const poolishMixStepsSource = poolishMixStepsInitializer.getText(indexFile);
const detailedP1Guard = findPoolishP1Guard(indexFile);
assert.equal(detailedP1Guard, '!isSponge && (isBeginner || !poolishPreparation)');
assert.match(indexSource, /poolishPreparation && !poolishHomeSchedule/);
assert.match(indexSource, /const poolishHomeSchedule = isBeginner && method === 'poolish'/);
assert.equal((indexSource.match(/steps=\{withProIceWaterInstruction\(displayedFinalMixSteps\)\}/g) ?? []).length, 1);

const { doughCalc, getFermentationSchedule } = loadTypeScriptModule(path.join(frontendRoot, 'src', 'calculator.ts'));
const { getYeastAwarePrefermentSteps } = loadTypeScriptModule(
  path.join(frontendRoot, 'src', 'i18n', 'prefermentSteps.ts'),
);

const languages = ['hr', 'en', 'de', 'sl'];
const styles = [
  { id: 'neapolitan', teglia: false },
  { id: 'romanaTonda', teglia: false },
  { id: 'romanaTeglia', teglia: true },
  { id: 'newYork', teglia: false },
];
const flourPaths = [
  { flour: 'caputo00', glutenFreeBlend: false },
  { flour: 'manitoba', glutenFreeBlend: false },
  { flour: 'spelt', glutenFreeBlend: false },
  { flour: 'wholeWheat', glutenFreeBlend: false },
  { flour: 'custom', glutenFreeBlend: false },
  { flour: 'custom', glutenFreeBlend: true },
];
const mixingMethods = ['hand', 'mixer', 'spiral'];
const fermentationModes = [
  { id: 'room-only', prefermentHours: 1, roomHours: 6, fridgeHours: 0 },
  { id: 'cold', prefermentHours: 24, roomHours: 2, fridgeHours: 18 },
];
const yeastTypes = ['fresh', 'activeDry', 'dry'];
const standardPoolishTiming = { roomHours: 2, roomTemp: 22, fridgeHours: 24, fridgeTemp: 4 };
const standardPoolishOptions = {
  pizzas: 1,
  ballWeight: 1000,
  hydration: 62,
  saltPct: 2.8,
  oilPct: 0,
  method: 'poolish',
  poolishPct: 35,
  poolishHydrationPct: 100,
  ...standardPoolishTiming,
};

function assertPoolishIngredientTotals(result, label) {
  assert.ok(result.eTotal >= 0, `${label}: fermentation exposure cannot be negative`);
  assert.ok(result.yeastPct >= 0 && result.total.yeast >= 0, `${label}: yeast cannot be negative`);
  assert.ok(result.preferment.yeast >= 0 && result.main.yeast >= 0, `${label}: phase yeast cannot be negative`);
  assert.equal(result.preferment.flour + result.main.flour, result.total.flour, `${label}: flour total is preserved`);
  assert.equal(result.preferment.water + result.main.water, result.total.water, `${label}: water total is preserved`);
  assert.ok(result.preferment.flour >= 0 && result.preferment.water >= 0, `${label}: preferment ingredients are nonnegative`);
  assert.ok(result.main.flour >= 0 && result.main.water >= 0, `${label}: final dough ingredients are nonnegative`);
}

let temperatureDoseChecks = 0;
for (let temperature = 4; temperature <= 35; temperature += 1) {
  const expectedEnvironment = temperature <= 10 ? 'fridge' : 'room';
  const poolishRate = temperature <= 10
    ? 0.12 * (1 + 0.05 * (temperature - 4))
    : 1 + 0.08 * (temperature - 20);
  for (const yeastType of yeastTypes) {
    let previousYeastPct = Number.POSITIVE_INFINITY;
    for (let hours = 4; hours <= 48; hours += 1) {
      const schedule = getFermentationSchedule({
        method: 'poolish',
        prefermentHours: hours,
        prefermentTempC: temperature,
        ...standardPoolishTiming,
        roomAfterFridgeHours: 2,
      });
      const prefermentPhases = schedule.phases.filter((phase) => phase.kind === 'preferment');
      assert.equal(prefermentPhases.length, 1, `${temperature}°C/${hours}h: one Poolish phase`);
      assert.equal(prefermentPhases[0].environment, expectedEnvironment, `${temperature}°C: correct temperature regime`);
      assert.equal(prefermentPhases[0].hours, hours, `${temperature}°C: selected duration is retained`);
      assert.equal(schedule.prefermentRoomHours + schedule.prefermentFridgeHours, hours);

      const result = doughCalc({
        ...standardPoolishOptions,
        prefermentHours: hours,
        poolishFermentationTempC: temperature,
        yeastType,
        fermentationSchedule: schedule,
      });
      const expectedExposure = hours * poolishRate
        + 2 * (1 + 0.08 * (standardPoolishTiming.roomTemp - 20))
        + standardPoolishTiming.fridgeHours * 0.12 * (1 + 0.05 * (standardPoolishTiming.fridgeTemp - 4))
        + 2 * (1 + 0.08 * (standardPoolishTiming.roomTemp - 20));
      assert.equal(result.eTotal, Math.round(expectedExposure * 10) / 10,
        `${temperature}°C/${hours}h/${yeastType}: exposure follows the existing temperature curves`);
      assert.ok(result.yeastPct <= previousYeastPct + 1e-9,
        `${temperature}°C/${yeastType}: longer fermentation cannot increase yeast dose`);
      previousYeastPct = result.yeastPct;
      assertPoolishIngredientTotals(result, `${temperature}°C/${hours}h/${yeastType}`);
      temperatureDoseChecks += 1;
    }
  }
}

for (let roomTemp = 10; roomTemp <= 35; roomTemp += 1) {
  for (let fridgeTemp = 2; fridgeTemp <= 10; fridgeTemp += 1) {
    const schedule = getFermentationSchedule({
      method: 'poolish', prefermentHours: 24, prefermentTempC: 22,
      ...standardPoolishTiming, roomTemp, fridgeTemp, roomAfterFridgeHours: 2,
    });
    const result = doughCalc({
      ...standardPoolishOptions, roomTemp, fridgeTemp,
      prefermentHours: 24, poolishFermentationTempC: 22, fermentationSchedule: schedule,
    });
    assertPoolishIngredientTotals(result, `room ${roomTemp}°C/fridge ${fridgeTemp}°C`);
  }
}

let hydrationChecks = 0;
for (const overallHydration of [50, 62, 70, 80, 100, 150, 200]) {
  for (let poolishPct = 20; poolishPct <= 100; poolishPct += 5) {
    for (let poolishHydrationPct = 10; poolishHydrationPct <= 200; poolishHydrationPct += 10) {
      if (poolishPct * poolishHydrationPct / 100 > overallHydration) continue;
      for (const yeastType of yeastTypes) {
        const schedule = getFermentationSchedule({
          method: 'poolish', prefermentHours: 24, prefermentTempC: 22,
          ...standardPoolishTiming, roomAfterFridgeHours: 2,
        });
        const result = doughCalc({
          ...standardPoolishOptions,
          hydration: overallHydration,
          poolishPct,
          poolishHydrationPct,
          prefermentHours: 24,
          poolishFermentationTempC: 22,
          yeastType,
          fermentationSchedule: schedule,
        });
        assertPoolishIngredientTotals(result,
          `${overallHydration}% overall/${poolishPct}% Poolish/${poolishHydrationPct}% hydration/${yeastType}`);
        hydrationChecks += 1;
      }
    }
  }
}

const durationRegressionSchedule = getFermentationSchedule({
  method: 'poolish', prefermentHours: 24, prefermentTempC: 22,
  ...standardPoolishTiming, roomAfterFridgeHours: 2,
});
assert.equal(durationRegressionSchedule.phases.reduce((total, phase) => total + phase.hours, 0), 52,
  '24h Poolish + 2h final room + 24h fridge + 2h final rest totals 52h');
assert.equal(durationRegressionSchedule.phases.filter((phase) => phase.kind === 'final').reduce((total, phase) => total + phase.hours, 0), 26);
assert.equal(durationRegressionSchedule.phases.filter((phase) => phase.kind === 'final-rest').reduce((total, phase) => total + phase.hours, 0), 2);

const coldLabels = { hr: 'hladnjak', en: 'refrigerator', de: 'Kühlschrank', sl: 'hladilnik' };
const zeroHourPhrases = { hr: '0 sati', en: '0 hours', de: '0 Stunden', sl: '0 ur' };
const finalIngredientWords = {
  hr: { flour: /brašn/i, water: /vod/i, salt: /sol/i, oil: /ulj/i, yeast: /kvas/i },
  en: { flour: /flour/i, water: /water/i, salt: /salt/i, oil: /oil/i, yeast: /yeast/i },
  de: { flour: /mehl/i, water: /wasser/i, salt: /salz/i, oil: /öl/i, yeast: /hefe/i },
  sl: { flour: /mok/i, water: /vod/i, salt: /sol/i, oil: /olj/i, yeast: /kvas/i },
};
const shouldRenderDetailedP1 = (isBeginner, preparation) => isBeginner || !preparation;
const dough = {
  preferment: { flour: 175, water: 175, yeast: 0.1 },
  main: { flour: 325, water: 205, yeast: 0.2 },
  total: { salt: 14, oil: 12 },
};

for (const lang of languages) {
  for (const temperature of [4, 11]) {
    const schedule = getFermentationSchedule({
      method: 'poolish', prefermentHours: 24, prefermentTempC: temperature,
      ...standardPoolishTiming, roomAfterFridgeHours: 2,
    });
    const preparation = evaluate(poolishPreparationSource, {
      method: 'poolish', lang, poolishPct: 35, poolishHydrationPct: 100,
      dough, yeastShortLabel: 'fresh', preferredYeastType: 'fresh', mixing: 'hand',
      isRomanTeglia: false, prefermentRoomHours: schedule.prefermentRoomHours,
      prefermentRoomTemperature: `${temperature} °C`, isBeginner: false,
      prefermentFridgeHours: schedule.prefermentFridgeHours,
      prefermentFridgeTemperature: `${temperature} °C`, poolishHours: 24,
      croatianHours: (hours) => `${hours} sati`,
      fermentationSchedule: schedule, selectedPrefermentHours: schedule.prefermentHours,
      formatDuration: (seconds) => `${seconds / 3600} h`,
      formatTemperature: (value) => `${value} °C`, temperatureUnit: 'celsius',
    });
    const preparationText = preparation.steps.join(' ');
    if (temperature <= 10) {
      assert.equal(schedule.prefermentRoomHours, 0);
      assert.ok(!preparationText.includes(zeroHourPhrases[lang]), `${lang}: cold Poolish omits the zero-hour room step`);
      assert.ok(preparationText.toLowerCase().includes(coldLabels[lang].toLowerCase()), `${lang}: cold Poolish instructions retain the refrigerator step`);
    } else {
      assert.equal(schedule.prefermentRoomHours, 24);
      assert.ok(preparationText.includes('24'), `${lang}: room-temperature Poolish retains its room step`);
      assert.ok(!preparationText.toLowerCase().includes(coldLabels[lang].toLowerCase()), `${lang}: room Poolish omits the refrigerator step`);
    }
  }
}

let checked = 0;
for (const lang of languages) {
  for (const style of styles) {
    for (const flourPath of flourPaths) {
      for (const mixing of mixingMethods) {
        for (const fermentation of fermentationModes) {
          for (const yeastType of yeastTypes) {
            const schedule = getFermentationSchedule({
              method: 'poolish',
              prefermentHours: fermentation.prefermentHours,
              roomHours: fermentation.roomHours,
              roomTemp: 22,
              fridgeHours: fermentation.fridgeHours,
              fridgeTemp: 4,
            });
            const preparation = evaluate(poolishPreparationSource, {
              method: 'poolish',
              lang,
              poolishPct: 35,
              poolishHydrationPct: 100,
              dough,
              yeastShortLabel: yeastType,
              preferredYeastType: yeastType,
              mixing,
              isRomanTeglia: style.teglia,
              prefermentRoomHours: schedule.prefermentRoomHours,
              prefermentRoomTemperature: '22 °C',
              isBeginner: false,
              prefermentFridgeHours: schedule.prefermentFridgeHours,
              prefermentFridgeTemperature: '4 °C',
              poolishHours: fermentation.prefermentHours,
              croatianHours: (hours) => `${hours} sati`,
              fermentationSchedule: schedule,
              selectedPrefermentHours: schedule.prefermentHours,
              formatDuration: (seconds) => `${seconds / 3600} h`,
              formatTemperature: (value) => `${value} °C`,
              temperatureUnit: 'celsius',
            });
            const detailedPath = getYeastAwarePrefermentSteps(
              lang,
              'poolish',
              mixing,
              yeastType,
              '0.2 g',
              style.teglia,
              true,
              flourPath.flour,
              flourPath.glutenFreeBlend,
            );
            const finalMixSteps = evaluate(poolishMixStepsSource, {
              method: 'poolish',
              lang,
              preferredYeastType: yeastType,
              mixingForExperience: mixing,
              dough,
              weight: (amount) => String(amount),
            }) ?? detailedPath.p2.steps;

            assert.equal(preparation.timers.length, 1);
            assert.equal(preparation.timers[0].id, 'poolish-fermentation');
            assert.equal(preparation.timers[0].seconds, fermentation.prefermentHours * 3600);
            assert.ok(preparation.steps.some((step) => step.includes('175')));
            assert.ok(preparation.steps.some((step) => step.toLowerCase().includes('poolish')));
            const preparationText = preparation.steps.join(' ').toLowerCase();
            assert.equal(preparationText.includes(coldLabels[lang].toLowerCase()), schedule.prefermentFridgeHours > 0);
            if (schedule.prefermentFridgeHours > 0) {
              assert.ok(preparationText.includes(String(schedule.prefermentFridgeHours)));
            }
            assert.ok(finalMixSteps.some((step) => step.includes('Poolish')));
            const mixingTitle = detailedPath.p2.title.toLowerCase();
            if (mixing === 'hand') {
              assert.equal(evaluate(poolishMixStepsSource, {
                method: 'poolish', lang, preferredYeastType: yeastType, mixingForExperience: mixing,
                dough, weight: (amount) => String(amount),
              }) !== null, true);
            } else {
              assert.equal(evaluate(poolishMixStepsSource, {
                method: 'poolish', lang, preferredYeastType: yeastType, mixingForExperience: mixing,
                dough, weight: (amount) => String(amount),
              }), null);
              assert.ok(mixingTitle.includes(mixing === 'mixer' ? ({
                hr: 'mikser', en: 'mixer', de: 'maschine', sl: 'mešalnik',
              }[lang]) : ({
                hr: 'spiral', en: 'spiral', de: 'spiral', sl: 'spiral',
              }[lang])), `${lang}/${mixing} must retain its equipment-specific title`);
            }
            const finalMixText = finalMixSteps.join(' ');
            if (mixing === 'hand') {
              for (const amount of ['325', '185', '20', '0.2', '14', '12']) {
                assert.ok(finalMixText.includes(amount), `${lang}/${style.id}/${flourPath.flour}/${mixing}/${fermentation.id}/${yeastType} must include ${amount}`);
              }
            } else {
              for (const ingredient of ['flour', 'water', 'salt', 'oil', 'yeast']) {
                assert.ok(finalIngredientWords[lang][ingredient].test(finalMixText), `${lang}/${style.id}/${flourPath.flour}/${mixing}/${fermentation.id}/${yeastType} must include ${ingredient}`);
              }
            }

            const prefermentPhases = schedule.phases.filter((phase) => phase.kind === 'preferment');
            const finalFermentationPhases = schedule.phases.filter((phase) => phase.kind === 'final');
            assert.ok(prefermentPhases.length > 0);
            assert.ok(finalFermentationPhases.length > 0);
            assert.ok(schedule.phases.findIndex((phase) => phase.kind === 'preferment')
              < schedule.phases.findIndex((phase) => phase.kind === 'final'));

            const isBeginner = false;
            const poolishHomeSchedule = false;
            const renderedPhases = [
              ...(preparation && !poolishHomeSchedule ? [{ kind: 'poolish-preparation', value: preparation }] : []),
              ...(shouldRenderDetailedP1(isBeginner, preparation) ? [{ kind: 'detailed-poolish-P1', value: detailedPath.p1 }] : []),
              { kind: 'final-dough-mix', value: { title: detailedPath.p2.title, steps: finalMixSteps } },
              { kind: 'final-dough-fermentation', value: detailedPath.p3 },
            ];
            assert.equal(renderedPhases.filter((phase) => phase.kind === 'poolish-preparation' || phase.kind === 'detailed-poolish-P1').length, 1);
            assert.equal(renderedPhases.filter((phase) => phase.kind === 'final-dough-mix').length, 1);
            assert.deepEqual(renderedPhases.map((phase) => phase.kind), [
              'poolish-preparation',
              'final-dough-mix',
              'final-dough-fermentation',
            ]);
            assert.equal(shouldRenderDetailedP1(true, preparation), true, 'Beginner keeps its existing detailed P1 render path');
            checked += 1;
          }
        }
      }
    }
  }
}

console.log(`F16 Poolish phase sequence passed: ${checked} generated combinations across HR/EN/DE/SL; ${temperatureDoseChecks} temperature-duration-yeast cases and ${hydrationChecks} feasible hydration cases.`);
