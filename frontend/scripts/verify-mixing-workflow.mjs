import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  createDirectHomePizzaPlan,
  doughCalc,
  getFermentationSchedule,
  getSharedCalculatorPlanSettings,
  parseMixingSelection,
  reversePlan,
  setSharedCalculatorPlanSettings,
  subscribeSharedCalculatorPlanSettings,
  toCalculatorMixing,
  toBeginnerDirectMixing,
} from '../src/calculator.ts';
import { getSpiralMixingSteps, getSpiralMixingTitle, getSpiralPlannerNote } from '../src/i18n/spiralMixing.ts';

const languages = ['hr', 'en', 'de', 'sl'];
const mixingSelections = ['hand', 'mixer', 'spiral'];
const beginnerMixingSelections = ['hand', 'mixer'];
const calculatorMixing = Object.fromEntries(mixingSelections.map((selection) => [
  selection,
  toCalculatorMixing(selection),
]));
const styles = [
  { key: 'neapolitan', directStyle: 'neapolitan' },
  { key: 'roman-tonda', directStyle: 'romanaTonda' },
  { key: 'teglia', directStyle: 'romanaTeglia' },
  { key: 'new-york', directStyle: 'newYork' },
];
const methods = ['direct', 'biga', 'poolish'];
const yeasts = ['fresh', 'activeDry', 'dry'];
const ingredientKeys = ['flour', 'water', 'salt', 'oil', 'yeast'];
let proCases = 0;

for (const style of styles) {
  for (const method of methods) {
    let baseline;
    for (const selection of mixingSelections) {
      const result = doughCalc({
        pizzas: 3,
        ballWeight: 280,
        hydration: 67,
        saltPct: 2.5,
        oilPct: 2,
        method,
        bigaPct: 50,
        poolishPct: 50,
        prefermentHours: 24,
        roomHours: 2,
        roomTemp: 22,
        fridgeHours: 24,
        fridgeTemp: 4,
        mixing: calculatorMixing[selection],
        beginnerDirectStyle: style.directStyle,
        yeastType: 'fresh',
      });
      const ingredients = {
        total: Object.fromEntries(ingredientKeys.map((key) => [key, result.total[key]])),
        preferment: result.preferment
          ? Object.fromEntries(ingredientKeys.map((key) => [key, result.preferment[key]]))
          : null,
        main: Object.fromEntries(ingredientKeys.map((key) => [key, result.main[key]])),
        totalDough: result.totalDough,
      };
      if (baseline) assert.deepEqual(ingredients, baseline, `${style.key}/${method}/${selection} must preserve ingredient amounts`);
      else baseline = ingredients;
      proCases += 1;
    }
  }
}
assert.equal(proCases, 36);

for (const style of styles) {
  let baseline;
  for (const selection of beginnerMixingSelections) {
    const result = doughCalc({
      pizzas: 3,
      ballWeight: 280,
      hydration: 67,
      saltPct: 2.5,
      oilPct: 2,
      method: 'direct',
      bigaPct: 50,
      poolishPct: 50,
      prefermentHours: 24,
      roomHours: 2,
      roomTemp: 22,
      fridgeHours: 24,
      fridgeTemp: 4,
      mixing: toCalculatorMixing(selection),
      beginnerDirectStyle: style.directStyle,
      beginnerDirectMixing: toBeginnerDirectMixing(selection),
      yeastType: 'fresh',
    });
    const ingredients = {
      total: Object.fromEntries(ingredientKeys.map((key) => [key, result.total[key]])),
      main: Object.fromEntries(ingredientKeys.map((key) => [key, result.main[key]])),
      totalDough: result.totalDough,
    };
    if (baseline) assert.deepEqual(ingredients, baseline, `${style.key}/${selection} Beginner ingredient amounts must stay unchanged between hand and home mixer`);
    else baseline = ingredients;
  }
}

for (const lang of languages) {
  for (const yeast of yeasts) {
    const directSteps = getSpiralMixingSteps(lang, yeast, { method: 'direct', hasOil: true });
    assert.equal(directSteps.length, 8);
    assert.ok(directSteps.some((step) => /manufacturer|proizvođa|Hersteller|proizvajal/i.test(step)));
    assert.ok(getSpiralMixingTitle(lang, 'direct').length > 0);
    assert.ok(getSpiralPlannerNote(lang).length > 0);
    for (const method of ['biga', 'poolish']) {
      const prefermentSteps = getSpiralMixingSteps(lang, yeast, { method, hasOil: false });
      assert.equal(prefermentSteps.length, 7);
      assert.match(prefermentSteps[1], /fresh|active[- ]dry|instant|Svjež|svjež|Aktiv|instant|Frisch|Aktiv|Instant|svež|aktivni/i);
    }
  }
}

assert.equal(parseMixingSelection('hand'), 'hand');
assert.equal(parseMixingSelection('mixer'), 'mixer', 'legacy saved mixer selection remains readable');
assert.equal(toCalculatorMixing(parseMixingSelection('mixer')), 'home', 'legacy mixer recipes keep ordinary-mixer semantics');
assert.equal(toBeginnerDirectMixing(parseMixingSelection('spiral')), 'home', 'legacy spiral selection uses the home mixer in Beginner');
const savedRecipe = JSON.parse(JSON.stringify({ settings: { mixing: 'spiral' } }));
assert.equal(parseMixingSelection(savedRecipe.settings.mixing), 'spiral', 'spiral survives recipe serialization and reload');

const now = new Date('2026-04-01T00:00:00.000Z');
const bakeAt = (hours) => new Date(now.getTime() + hours * 60 * 60_000);
let beginnerScheduleCases = 0;
for (const style of styles) {
  for (const [windowHours, expectedColdPhase] of [[2, false], [36, true]]) {
    const schedules = [];
    for (const selection of beginnerMixingSelections) {
      const plan = createDirectHomePizzaPlan({
        style: style.key === 'new-york' ? 'ny_style' : style.key.startsWith('roman') || style.key === 'teglia' ? 'romana' : 'neapolitan',
        romanFormat: style.key === 'teglia' ? 'teglia' : 'tonda',
        pizzas: 3,
        ballWeight: 280,
        method: 'direct',
        bakeAt: bakeAt(windowHours),
        roomTemp: 22,
        fridgeTemp: 4,
        ovenType: 'homeStone',
        flourType: 'caputo00',
        mixing: toBeginnerDirectMixing(selection),
      }, { source: 'w', w: 300 }, 65, 'fresh', now, true);
      assert.ok(plan, `${style.key}/${selection}/${windowHours}h should produce a Beginner schedule`);
      assert.equal(
        plan.schedule.fridgeHours > 0,
        expectedColdPhase,
        `${style.key}/${selection}/${windowHours}h must follow the expected room/cold path`,
      );
      beginnerScheduleCases += 1;
      schedules.push(plan.schedule);
    }
    assert.deepEqual(schedules[0], schedules[1], `${style.key}/${windowHours}h ordinary mixer schedule must match hand schedule`);
  }
}
assert.equal(beginnerScheduleCases, 16);

const scheduleCopy = {
  ovenTitle: 'Preheat',
  ovenDesc: 'Preheat the oven.',
  ovenRomanDesc: 'Preheat the oven.',
  ovenNyDesc: 'Preheat the oven.',
  warmTitle: 'Warm',
  warmDesc: 'Warm the dough for {TEMPERING}.',
  coldTitle: 'Cold fermentation',
  coldDesc: 'Keep cold for {HOURS} hours at {FRIDGE_TEMP}.',
  bulkTitle: 'Room fermentation',
  bulkDesc: 'Ferment for {HOURS} hours.',
  directMixTitle: 'Final mix',
  directRomanDesc: 'Mix the dough.',
  directNyDesc: 'Mix the dough.',
  directNyBakeDesc: 'Bake.',
  directTitle: 'Direct mix',
  directDesc: 'Mix the dough.',
  finalBulkTitle: 'Final bulk',
  finalBulkDesc: 'Ferment for {HOURS} hours.',
  finalMixTitle: 'Final mix {PREFERMENT}',
  bigaName: 'Biga',
  poolishName: 'Poolish',
  finalBigaDesc: 'Mix the Biga.',
  finalPoolishDesc: 'Mix the Poolish.',
  bigaTitle: 'Start Biga',
  bigaDesc: 'Prepare the Biga for {HOURS} hours.',
  poolishTitle: 'Start Poolish',
  poolishDesc: 'Prepare the Poolish for {HOURS} hours.',
  ballsTitle: 'Shape',
  ballsDesc: 'Shape the dough.',
  refreshTitle: 'Refresh',
  refreshDesc: 'Refresh the dough.',
  bigaMixTitle: 'Mix Biga',
  bigaMixDesc: 'Mix the Biga.',
  poolishMixTitle: 'Mix Poolish',
  poolishMixDesc: 'Mix the Poolish.',
};
const twoHoursPlusCold = getFermentationSchedule({
  method: 'direct',
  roomHours: 2,
  roomTemp: 22,
  fridgeHours: 24,
  fridgeTemp: 4,
});
assert.equal(twoHoursPlusCold.phases.find((phase) => phase.environment === 'room')?.hours, 2);
const coldPlan = reversePlan(bakeAt(36), 'direct', 'neapolitan', scheduleCopy, null, null, null, 'en', undefined, 22, twoHoursPlusCold);
assert.ok(coldPlan.some((step) => step.title === scheduleCopy.coldTitle));
const noColdSchedule = getFermentationSchedule({
  method: 'direct',
  roomHours: 2,
  roomTemp: 26,
  fridgeHours: 0,
  fridgeTemp: 4,
});
assert.equal(noColdSchedule.phases.some((phase) => phase.environment === 'fridge'), false);
assert.ok(noColdSchedule.phases.every((phase) => phase.temperature === 26));
const warmPlan = reversePlan(bakeAt(36), 'direct', 'neapolitan', scheduleCopy, null, null, null, 'en', undefined, 26, noColdSchedule);
assert.equal(warmPlan.some((step) => step.title === scheduleCopy.coldTitle), false, 'zero fridge hours removes the stale cold step');

let storeNotified = false;
const unsubscribe = subscribeSharedCalculatorPlanSettings(() => { storeNotified = true; });
setSharedCalculatorPlanSettings({
  pizzaStyle: 'neapolitan',
  romanFormat: 'tonda',
  method: 'direct',
  mixing: 'spiral',
  roomTemp: 26,
  roomHours: 2,
  fridgeTemp: 4,
  fridgeHours: 0,
  bigaHours: 24,
  poolishHours: 24,
  trayCount: 4,
  doughPerTray: 480,
  trayWidth: 30,
  trayLength: 40,
  proFermentationSchedule: noColdSchedule,
});
assert.equal(storeNotified, true);
assert.equal(getSharedCalculatorPlanSettings().mixing, 'spiral');
assert.deepEqual(getSharedCalculatorPlanSettings().proFermentationSchedule, noColdSchedule);
unsubscribe();

const calculatorSource = await readFile(new URL('../app/(tabs)/index.tsx', import.meta.url), 'utf8');
const plannerSource = await readFile(new URL('../app/(tabs)/planner.tsx', import.meta.url), 'utf8');
const translationsSource = await readFile(new URL('../src/i18n/translations.ts', import.meta.url), 'utf8');
const prefermentSource = await readFile(new URL('../src/i18n/prefermentSteps.ts', import.meta.url), 'utf8');
assert.equal((calculatorSource.match(/testID="mix-spiral"/g) ?? []).length, 1, 'only Pro exposes spiral selection');
assert.ok(
  calculatorSource.indexOf('testID="mix-spiral"') > calculatorSource.indexOf('testID="beginner-direct-schedule-mode"'),
  'the spiral control appears after the Beginner mixer selector',
);
assert.equal((calculatorSource.match(/hardware-chip-outline\.png/g) ?? []).length, 3, 'Beginner home and Pro home/spiral controls use the same icon');
assert.match(calculatorSource, /getDetailedDirectSteps\(mixingForExperience/);
assert.match(calculatorSource, /mixingForExperience === 'spiral'/);
assert.doesNotMatch(calculatorSource, /name="sync-outline"/, 'the spiral option no longer uses the orange sync icon');
assert.doesNotMatch(calculatorSource, /<Text style=\{styles\.hint\}>\{mixingInfo\}<\/Text>/, 'mixer explanations remain in the detailed steps/info dialog, not below the selector');
assert.match(calculatorSource, /mixing,\s*preferredYeastType/);
assert.match(calculatorSource, /parseMixingSelection\(settings\.mixing\)/);
assert.match(prefermentSource, /mixing === 'spiral'/);
assert.match(prefermentSource, /p2\.steps = getSpiralMixingSteps\(lang, yeastType, \{ method, hasOil \}\)/);
assert.match(plannerSource, /activeMixing === 'spiral'/);
assert.equal((translationsSource.match(/spiralMixer:/g) ?? []).length, 4, 'all four localized mixer labels exist');

console.log('Mixing workflow regression passed: 36 Pro combinations, 16 Beginner hand/home style/room-cold schedules, matching Beginner ingredient amounts, HR/EN/DE/SL steps, saved selections, schedule changes, and Planner synchronization.');
