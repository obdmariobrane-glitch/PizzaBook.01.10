#!/usr/bin/env node

const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const ts = require('typescript');
const vm = require('vm');

const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const calculator = read('src/calculator.ts');
const calculatorUi = read('app/(tabs)/index.tsx');
const planner = read('app/(tabs)/planner.tsx');
const translations = read('src/i18n/translations.ts');

const compiled = ts.transpileModule(calculator, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const moduleRef = { exports: {} };
vm.runInNewContext(compiled, { module: moduleRef, exports: moduleRef.exports }, { filename: 'calculator.ts' });
const { reversePlan } = moduleRef.exports;

const plannerCopy = {
  fold1Title: 'First Stretch & Fold',
  fold2Title: 'Second Stretch & Fold',
  ovenTitle: 'Oven', ovenDesc: 'Oven', ovenRomanDesc: 'Oven', ovenNyDesc: 'Oven',
  bakeTitle: 'Bake', bakeDesc: 'Bake', warmTitle: 'Warm', warmDesc: 'Warm',
  coldTitle: 'Cold', coldDesc: 'Cold', bulkTitle: 'Bulk', bulkDesc: 'Bulk',
  directMixTitle: 'Mix', directRomanDesc: 'Mix', directNyDesc: 'Mix',
  directNyBakeDesc: 'Bake', finalBulkTitle: 'Bulk', finalBulkDesc: 'Bulk',
  finalMixTitle: 'Mix', bigaName: 'Biga', poolishName: 'Poolish',
  finalBigaDesc: 'Biga', finalPoolishDesc: 'Poolish', bigaTitle: 'Biga',
  bigaDesc: 'Biga', poolishTitle: 'Poolish', poolishDesc: 'Poolish',
  ballsTitle: 'Balls', ballsDesc: 'Balls', refreshTitle: 'Refresh', refreshDesc: 'Refresh',
  bigaMixTitle: 'Biga', bigaMixDesc: 'Biga', poolishMixTitle: 'Poolish', poolishMixDesc: 'Poolish',
  directTitle: 'Mix', directDesc: 'Mix',
  directHomeCopy: {
    start: 'Mix', ballingFridge: 'Ball', roomOnlyBalling: 'Ball', finalRoom: 'Warm',
    preheat: 'Preheat', shapingTitle: 'Shape', shaping: 'Shape', bake: 'Bake',
  },
  directHomeTegliaCopy: {
    start: 'Mix', ballingFridge: 'Tray', roomOnlyBalling: 'Tray', finalRoom: 'Warm',
    preheat: 'Preheat', shapingTitle: 'Shape', shaping: 'Shape', bake: 'Bake',
  },
};
const startAt = new Date('2026-10-08T11:00:00');
const bakeAt = new Date('2026-10-08T14:00:00');
const makeSchedule = (phaseBMinutes, fridgeHours = 0, glutenFree = false, romanFormat) => ({
  bakeAt, startAt, roomBeforeFridgeHours: phaseBMinutes / 60, fridgeHours, roomAfterFridgeHours: 2,
  phaseAMinutes: 20, phaseBMinutes,
  ballingAt: new Date(startAt.getTime() + (20 + phaseBMinutes) * 60000),
  preheatAt: new Date(bakeAt.getTime() - 60 * 60000),
  strategy: 'beginner',
  glutenFree,
  romanFormat,
});
for (const [style, romanFormat] of [
  ['neapolitan'],
  ['romana', 'tonda'],
  ['romana', 'teglia'],
  ['ny_style'],
]) {
  for (const fridgeHours of [0, 8]) {
    for (const [phaseBMinutes, expectedFoldOffsets] of [[30, []], [60, [20]], [90, [20, 50]]]) {
      const steps = reversePlan(
        bakeAt,
        'direct',
        style,
        plannerCopy,
        makeSchedule(phaseBMinutes, fridgeHours, false, romanFormat),
      );
      const foldSteps = steps.filter((step) => step.title.includes('Stretch'));
      assert.deepEqual(
        [...foldSteps].map((step) => step.at.getTime()),
        expectedFoldOffsets.map((offset) => startAt.getTime() + (20 + offset) * 60000),
        `${style}/${romanFormat ?? ''} ${fridgeHours}h fold timestamps`,
      );
    }
  }
}
const glutenFreeSteps = reversePlan(
  bakeAt,
  'direct',
  'romana',
  plannerCopy,
  makeSchedule(90, 8, true, 'teglia'),
);
assert.equal(glutenFreeSteps.filter((step) => step.title.includes('Stretch')).length, 0);
assert.equal(
  reversePlan(bakeAt, 'direct', 'neapolitan', plannerCopy, makeSchedule(60)).find((step) => step.title === 'Balls').at.getTime(),
  startAt.getTime() + 80 * 60000,
);
const midnightBakeAt = new Date('2026-10-09T02:00:00');
const midnightStartAt = new Date('2026-10-08T23:00:00');
const midnightSchedule = { ...makeSchedule(90), startAt: midnightStartAt, bakeAt: midnightBakeAt };
const midnightFold = reversePlan(midnightBakeAt, 'direct', 'ny_style', plannerCopy, midnightSchedule)
  .find((step) => step.title === 'Second Stretch & Fold');
assert.equal(midnightFold.at.getTime(), new Date('2026-10-09T00:10:00').getTime());

assert.match(calculator, /phaseBStart[\s\S]*fold\.offsetMinutes/);
assert.match(calculator, /durationMinutes: homeSchedule!\.phaseBMinutes/);
assert.match(calculator, /flourBehavior: homeSchedule!\.glutenFree \? 'glutenFree' : 'standard'/);
assert.match(calculatorUi, /setCustomBallWeight\(nextBallWeight\)/);
assert.doesNotMatch(calculatorUi, /setCustomBallWeight\(canonicalBallWeight\)/);
assert.match(planner, /BEGINNER_DIRECT_MIN_WINDOW_HOURS/);
assert.match(planner, /BEGINNER_DIRECT_MAX_WINDOW_HOURS/);
assert.equal((translations.match(/shortTimeTitle:/g) || []).length, 4);
assert.equal((translations.match(/shortTimeMessage:/g) || []).length, 4);
assert.equal((translations.match(/beginnerWindowTitle:/g) || []).length, 4);
assert.equal((translations.match(/beginnerWindowMessage:/g) || []).length, 4);
assert.equal((translations.match(/understand:/g) || []).length, 4);

console.log('Beginner Planner fold, ball-weight, and short-time warning checks passed.');
