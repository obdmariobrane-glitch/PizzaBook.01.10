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
};
const startAt = new Date('2026-10-08T11:00:00');
const bakeAt = new Date('2026-10-08T14:00:00');
const makeSchedule = (phaseBMinutes) => ({
  bakeAt, startAt, roomBeforeFridgeHours: 0, fridgeHours: 0, roomAfterFridgeHours: 2,
  phaseAMinutes: 20, phaseBMinutes,
  ballingAt: new Date(startAt.getTime() + (20 + phaseBMinutes) * 60000),
  preheatAt: new Date(bakeAt.getTime() - 60 * 60000),
  strategy: 'beginner',
});
const oneFoldSteps = reversePlan(bakeAt, 'direct', 'neapolitan', plannerCopy, makeSchedule(60));
assert.equal(oneFoldSteps.find((step) => step.title === 'First Stretch & Fold').at.getTime(), startAt.getTime() + 40 * 60000);
assert.equal(oneFoldSteps.find((step) => step.title === 'Balls').at.getTime(), startAt.getTime() + 80 * 60000);
const twoFoldSteps = reversePlan(bakeAt, 'direct', 'neapolitan', plannerCopy, makeSchedule(90));
assert.equal(twoFoldSteps.find((step) => step.title === 'First Stretch & Fold').at.getTime(), startAt.getTime() + 40 * 60000);
assert.equal(twoFoldSteps.find((step) => step.title === 'Second Stretch & Fold').at.getTime(), startAt.getTime() + 70 * 60000);
assert.equal(twoFoldSteps.find((step) => step.title === 'Balls').at.getTime(), startAt.getTime() + 110 * 60000);
assert.equal(reversePlan(bakeAt, 'direct', 'neapolitan', plannerCopy, makeSchedule(30)).filter((step) => step.title.includes('Stretch')).length, 0);

assert.match(calculator, /phaseBStart[\s\S]*fold\.offsetMinutes/);
assert.match(calculator, /durationMinutes: homeSchedule!\.phaseBMinutes/);
assert.match(calculatorUi, /setCustomBallWeight\(nextBallWeight\)/);
assert.doesNotMatch(calculatorUi, /setCustomBallWeight\(canonicalBallWeight\)/);
assert.match(planner, /d\.getTime\(\) - Date\.now\(\) < 60 \* 60 \* 1000/);
assert.equal((translations.match(/shortTimeTitle:/g) || []).length, 4);
assert.equal((translations.match(/shortTimeMessage:/g) || []).length, 4);
assert.equal((translations.match(/understand:/g) || []).length, 4);

console.log('Beginner Planner fold, ball-weight, and short-time warning checks passed.');
