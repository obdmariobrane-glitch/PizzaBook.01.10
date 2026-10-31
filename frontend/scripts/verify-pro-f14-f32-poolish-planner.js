#!/usr/bin/env node

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const frontendRoot = path.join(__dirname, '..');

function loadTypeScriptModule(filePath) {
  const source = fs.readFileSync(filePath, 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const loadedModule = { exports: {} };
  new Function('module', 'exports', 'require', `${compiled}\nreturn module.exports;`)(
    loadedModule,
    loadedModule.exports,
    require,
  );
  return loadedModule.exports;
}

const calculator = loadTypeScriptModule(path.join(frontendRoot, 'src', 'calculator.ts'));
const { translations } = loadTypeScriptModule(path.join(frontendRoot, 'src', 'i18n', 'translations.ts'));
const languages = ['hr', 'en', 'de', 'sl'];
const styles = [
  { style: 'neapolitan', romanFormat: 'tonda' },
  { style: 'romana', romanFormat: 'tonda' },
  { style: 'romana', romanFormat: 'teglia' },
  { style: 'ny_style', romanFormat: 'tonda' },
];
const ovens = [
  { type: 'homePan', temperature: 250, displayTemperature: '250°C', preheatMinutes: 20 },
  { type: 'homeStone', temperature: 250, displayTemperature: '250°C', preheatMinutes: 45 },
  { type: 'ooni', temperature: 450, displayTemperature: '450°C', preheatMinutes: 15 },
];
const mixingMethods = ['hand', 'home', 'spiral'];
const fermentationVariants = [
  { prefermentHours: 24, roomHours: 2, fridgeHours: 24 },
  { prefermentHours: 12, roomHours: 1.5, fridgeHours: 16 },
];
const bakeAt = new Date('2026-10-18T19:00:00.000Z');
let checks = 0;

function titleForMix(copy) {
  return copy.finalMixTitle.replace('{PREFERMENT}', copy.poolishName);
}

for (const lang of languages) {
  const copy = translations[lang].planner.stepCopy;
  assert.ok(copy.poolishBakeTitle, `${lang}: Poolish has a localized bake title`);
  assert.ok(copy.poolishBakeDesc, `${lang}: Poolish has a localized oven-specific bake instruction`);
  assert.match(copy.finalPoolishDesc, /10-12/);
  assert.match(copy.finalPoolishDesc, /7-9/);
  assert.equal(calculator.getPoolishFinalMixDurationMinutes('hand'), 12);
  assert.equal(calculator.getPoolishFinalMixDurationMinutes('home'), 9);
  assert.equal(calculator.getPoolishFinalMixDurationMinutes('spiral'), 9);

  for (const { style, romanFormat } of styles) {
    for (const oven of ovens) {
      for (const mixing of mixingMethods) {
        for (const fermentation of fermentationVariants) {
          const schedule = calculator.getFermentationSchedule({
            method: 'poolish',
            prefermentHours: fermentation.prefermentHours,
            roomHours: fermentation.roomHours,
            roomTemp: 22,
            fridgeHours: fermentation.fridgeHours,
            fridgeTemp: 4,
            roomAfterFridgeHours: 2,
          });
        const steps = calculator.reversePlan(
          bakeAt,
          'poolish',
          style,
          copy,
          null,
          null,
          null,
          lang,
          oven.displayTemperature,
          22,
          schedule,
          { romanFormat, trayCount: 4, doughPerTray: 480, trayWidth: 30, trayLength: 40 },
          oven.type,
          oven.temperature,
          oven.preheatMinutes,
          mixing,
        );
        const poolish = steps.find((step) => step.title === copy.poolishTitle);
        const finalMix = steps.find((step) => step.title === titleForMix(copy));
        const bulk = steps.find((step) => step.title === copy.finalBulkTitle);
        const cold = steps.find((step) => step.title === (
          style === 'romana' && romanFormat === 'teglia'
            ? copy.directHomeTegliaCopy.coldMassTitle
            : copy.coldTitle
        ));
        const bakeSteps = steps.filter((step) => step.phaseId === 'poolish.bake');

        assert.ok(poolish && finalMix && bulk && cold, `${lang}/${style}/${romanFormat}/${mixing}: fermentation events exist`);
        assert.equal(bakeSteps.length, 1, `${lang}/${style}/${romanFormat}/${mixing}: exactly one Poolish bake event`);
        assert.equal(bakeSteps[0].title, copy.poolishBakeTitle);
        assert.equal(bakeSteps[0].at.getTime(), bakeAt.getTime(), 'the bake event stays at the exact selected target');
        assert.ok(bakeSteps[0].desc.includes(oven.displayTemperature), 'bake instruction uses the selected oven temperature');
        assert.ok(!bakeSteps[0].desc.includes('{BAKE_TIME}'), 'bake-time placeholder is resolved');
        assert.ok(poolish.at < finalMix.at, 'Poolish preparation precedes the final mix');
        assert.equal(finalMix.at.getTime() - poolish.at.getTime(), fermentation.prefermentHours * 60 * 60 * 1000,
          'the selected Poolish fermentation duration is preserved');
        assert.equal(
          bulk.at.getTime() - finalMix.at.getTime(),
          calculator.getPoolishFinalMixDurationMinutes(mixing) * 60 * 1000,
          'bulk starts only after the existing equipment-specific mixing window',
        );
        assert.equal(cold.at.getTime() - bulk.at.getTime(), fermentation.roomHours * 60 * 60 * 1000,
          'bulk fermentation retains its selected duration');

        if (style === 'romana' && romanFormat === 'teglia') {
          const removal = steps.find((step) => step.title === copy.directHomeTegliaCopy.finalRoomTitle);
          const trayPrepare = steps.find((step) => step.title === copy.directHomeTegliaCopy.trayPrepareTitle);
          const finalProof = steps.find((step) => step.title === copy.directHomeTegliaCopy.finalProofTitle);
          assert.ok(removal && trayPrepare && finalProof, 'Teglia final handling events remain present');
          assert.equal(removal.at.getTime(), bakeAt.getTime() - 2 * 60 * 60 * 1000,
            'the full selected two-hour final window is preserved');
          assert.equal(finalProof.at.getTime(), bakeAt.getTime() - 105 * 60 * 1000,
            'the 1 h 45 min Teglia final rise is unchanged');
        }

        for (let index = 1; index < steps.length; index += 1) {
          assert.ok(steps[index - 1].at.getTime() <= steps[index].at.getTime(),
            `${lang}/${style}/${romanFormat}/${mixing}: events are chronologically sorted`);
        }
        checks += 1;
        }
      }
    }
  }
}

for (const lang of languages) {
  for (const method of ['direct', 'biga']) {
    for (const { style, romanFormat } of styles) {
      for (const oven of ovens) {
        const copy = translations[lang].planner.stepCopy;
        const schedule = calculator.getFermentationSchedule({
          method,
          ...(method === 'biga' ? { prefermentHours: 24 } : {}),
          roomHours: 2,
          roomTemp: 22,
          fridgeHours: 24,
          fridgeTemp: 4,
          roomAfterFridgeHours: 2,
        });
        const steps = calculator.reversePlan(bakeAt, method, style, copy, null, null, null, lang,
          oven.displayTemperature, 22, schedule,
          { romanFormat, trayCount: 4, doughPerTray: 480, trayWidth: 30, trayLength: 40 },
          oven.type, oven.temperature, oven.preheatMinutes, 'spiral');
        assert.equal(steps.filter((step) => step.phaseId === 'poolish.bake').length, 0,
          `${method}/${style}/${lang}: no Poolish bake event leaks into another method`);
        for (let index = 1; index < steps.length; index += 1) {
          assert.ok(steps[index - 1].at.getTime() <= steps[index].at.getTime(),
            `${method}/${style}/${lang}: existing method events remain chronological`);
        }
        checks += 1;
      }
    }
  }
}

console.log(`F14/F32 Poolish Planner regression passed (${checks} cases).`);
