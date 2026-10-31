import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  formatBakingTimeRange,
  getFermentationSchedule,
  getSharedCalculatorPlanSettings,
  reversePlan,
  setSharedCalculatorPlanSettings,
} from '../src/calculator.ts';
import { formatTemperature } from '../src/units.ts';

const copy = {
  yeastHandling: { fresh: '', dry: '' },
  ovenTitle: 'Preheat',
  ovenDesc: 'Preheat the oven.',
  ovenRomanDesc: 'Preheat for Romana.',
  ovenNyDesc: 'Preheat for New York.',
  bakeTitle: 'Bake pizza',
  bakeDesc: 'Bake.',
  warmTitle: 'Warm',
  warmDesc: 'Warm {STYLE} for {TEMPERING}.',
  coldTitle: 'Cold',
  coldDesc: 'Cold ferment {HOURS} hours at {FRIDGE_TEMP}.',
  bulkTitle: 'Bulk',
  bulkDesc: 'Bulk for {HOURS}.',
  directMixTitle: 'Direct mix',
  directRomanDesc: 'Mix Romana.',
  directNyDesc: 'Mix New York.',
  directNyBakeDesc: 'Bake for {BAKE_TIME} at {OVEN_TEMP_DISPLAY}.',
  finalBulkTitle: 'Final bulk',
  finalBulkDesc: 'Final bulk for {HOURS}.',
  finalMixTitle: 'Mix with {PREFERMENT}',
  bigaName: 'Biga',
  poolishName: 'Poolish',
  finalBigaDesc: 'Mix Biga.',
  finalPoolishDesc: 'Mix Poolish.',
  bigaTitle: 'Start Biga',
  bigaDesc: 'Ferment Biga for {HOURS}.',
  poolishTitle: 'Start Poolish',
  poolishDesc: 'Ferment Poolish for {HOURS}.',
  ballsTitle: 'Shape balls',
  ballsDesc: 'Shape the dough.',
  refreshTitle: 'Refresh',
  refreshDesc: 'Refresh the preferment.',
  bigaMixTitle: 'Mix Biga',
  bigaMixDesc: 'Mix Biga.',
  poolishMixTitle: 'Mix Poolish',
  poolishMixDesc: 'Mix Poolish.',
  directTitle: 'Direct dough',
  directDesc: 'Mix the dough.',
};

const fermentationSchedule = getFermentationSchedule({
  method: 'direct',
  roomHours: 2,
  roomTemp: 22,
  fridgeHours: 24,
  fridgeTemp: 4,
  roomAfterFridgeHours: 2,
});
const sharedSettings = {
  pizzaStyle: 'ny_style',
  romanFormat: 'tonda',
  method: 'direct',
  mixing: 'hand',
  oven: 'homeStone',
  ovenTemp: 280,
  roomTemp: 22,
  roomHours: 2,
  fridgeTemp: 4,
  fridgeHours: 24,
  bigaHours: 24,
  poolishHours: 24,
  trayCount: 1,
  doughPerTray: 480,
  trayWidth: 30,
  trayLength: 40,
  proFermentationSchedule: fermentationSchedule,
};
setSharedCalculatorPlanSettings(sharedSettings);
assert.equal(getSharedCalculatorPlanSettings().oven, 'homeStone');
assert.equal(getSharedCalculatorPlanSettings().ovenTemp, 280);

for (const lang of ['hr', 'en', 'de', 'sl']) {
  for (const ovenType of ['ooni', 'homeStone', 'homePan']) {
    for (const ovenTemp of [250, 280, 450]) {
      for (const unit of ['celsius', 'fahrenheit']) {
        for (const method of ['direct', 'biga', 'poolish']) {
          const temperatureLabel = formatTemperature(ovenTemp, unit);
          const steps = reversePlan(
            new Date('2026-10-14T18:00:00.000Z'),
            method,
            'ny_style',
            copy,
            null,
            null,
            null,
            lang,
            temperatureLabel,
            22,
            fermentationSchedule,
            null,
            ovenType,
            ovenTemp,
          );
          const bakeStep = steps.find((step) => step.title === copy.bakeTitle);
          assert.ok(bakeStep, `${lang}/${ovenType}/${ovenTemp}/${unit}/${method}: bake step must exist`);
          assert.ok(bakeStep.desc.includes(temperatureLabel), `${lang}/${ovenType}/${ovenTemp}/${unit}/${method}: temperature must match`);
          assert.ok(
            bakeStep.desc.includes(formatBakingTimeRange(ovenType, ovenTemp, lang)),
            `${lang}/${ovenType}/${ovenTemp}/${unit}/${method}: bake range must use the selected oven and temperature`,
          );
        }
      }
    }
  }
}

const staleHomeSchedule = {
  startAt: new Date('2026-10-14T15:00:00.000Z'),
  bakeAt: new Date('2026-10-14T18:00:00.000Z'),
  roomBeforeFridgeHours: 2,
  fridgeHours: 0,
  roomAfterFridgeHours: 0,
  prefermentHours: 0,
  ovenType: 'homeStone',
  ovenTemp: 250,
};
const updatedHomeScheduleSteps = reversePlan(
  staleHomeSchedule.bakeAt,
  'direct',
  'ny_style',
  copy,
  staleHomeSchedule,
  null,
  null,
  'en',
  '280°C',
  22,
  undefined,
  null,
  'homePan',
  280,
);
const updatedHomeBakeStep = updatedHomeScheduleSteps.find((step) => step.title === copy.bakeTitle);
assert.ok(updatedHomeBakeStep);
assert.ok(updatedHomeBakeStep.desc.includes('280°C'), 'current Calculator value must override a stale schedule value');
assert.ok(
  updatedHomeBakeStep.desc.includes(formatBakingTimeRange('homePan', 280, 'en')),
  'current oven selection must drive the bake range when the home schedule is stale',
);

assert.equal(formatTemperature(280, 'celsius'), '280°C');
assert.equal(formatTemperature(280, 'fahrenheit'), '536°F');

const calculatorSource = await readFile(new URL('../app/(tabs)/index.tsx', import.meta.url), 'utf8');
const plannerSource = await readFile(new URL('../app/(tabs)/planner.tsx', import.meta.url), 'utf8');
const calculatorModule = await readFile(new URL('../src/calculator.ts', import.meta.url), 'utf8');
assert.match(calculatorSource, /mixing: toCalculatorMixing\(mixingForExperience\),\s*oven,\s*ovenTemp,/);
assert.match(plannerSource, /sharedCalculatorPlanSettings\?\.ovenTemp/);
assert.match(plannerSource, /sharedCalculatorPlanSettings\?\.oven/);
assert.match(plannerSource, /savedOvenTemp\s*=\s*settings\.ovenTemp/);
assert.match(plannerSource, /savedOven\s*=\s*settings\.oven/);
assert.match(plannerSource, /const plannerOvenType = isBeginner\s*\? plannerDirectHomeSchedule\?\.ovenType \?\? 'homeStone'/);
assert.match(plannerSource, /const plannerOvenTemp = isBeginner\s*\? plannerDirectHomeSchedule\?\.ovenTemp \?\? 250/);
assert.match(calculatorModule, /formatBakingTimeRange\(ovenType, ovenTemp, bakingLanguage\)/);

console.log('PRO Planner oven temperature checks passed for HR/EN/DE/SL, all oven types, selected temperatures, and Direct/Biga/Poolish.');
