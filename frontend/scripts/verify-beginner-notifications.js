#!/usr/bin/env node

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const appSource = fs.readFileSync(path.join(__dirname, '..', 'app', '(tabs)', 'index.tsx'), 'utf8');
const translations = fs.readFileSync(path.join(__dirname, '..', 'src', 'i18n', 'translations.ts'), 'utf8');

const eventIds = ['mix', 'fold1', 'fold1Gentle', 'fold2', 'fold2Gentle', 'fridgeIn', 'fridgeInCombined', 'balling', 'portioning', 'trayPrepare', 'fridgeOut', 'roomFermentationEnd', 'preheat', 'shape', 'bake'];
for (const id of eventIds) {
  assert.ok(
    (translations.match(new RegExp(`\\b${id}:\\s*\\{`, 'g')) || []).length >= 4,
    `missing localized notification copy for ${id}`,
  );
}

assert.match(appSource, /t\.beginnerCalc\.guidedNotificationCopy\[event\.id\]/);
assert.match(appSource, /scheduleLocalAt\(copy\.title, notificationBody, event\.at/);
assert.match(appSource, /if \(beginnerPhaseBPlan\) \{\s*for \(const fold of beginnerPhaseBPlan\.folds\)/);
assert.match(appSource, /const phaseBStart = new Date\(\s*startAt\.getTime\(\) \+ \(directHomeSchedule\.phaseAMinutes \?\? 0\) \* 60000/);
assert.match(appSource, /at: new Date\(phaseBStart\.getTime\(\) \+ fold\.offsetMinutes \* 60000\)/);
assert.match(appSource, /if \(fridgeHours > 0\) \{\s*steps\.push\(\{/);
assert.match(appSource, /id: isRomanTeglia \? 'trayPrepare' : isGlutenFree \? 'portioning' : 'balling'/);
assert.match(appSource, /if \(roomAfterFridgeHours > 0\) \{\s*steps\.push\(\{\s*id: 'fridgeOut'/);
assert.match(appSource, /id: 'preheat'/);
assert.equal((appSource.match(/id: 'roomFermentationEnd'/g) || []).length, 1);
assert.match(appSource, /getBeginnerRoomOnlyEnd\(directHomeSchedule, preheatAt\)/);
assert.equal((translations.match(/timelineRoomFermentationEnd:/g) || []).length, 4);
assert.match(appSource, /id: 'shape'/);
assert.match(appSource, /id: 'bake'/);

assert.match(appSource, /if \(beginnerPhaseBPlan\) \{\s*for \(const fold of beginnerPhaseBPlan\.folds\)/);
assert.match(appSource, /const isGlutenFree = flour === 'glutenFree'/);
assert.match(appSource, /const isRomanTeglia =/);
assert.match(appSource, /id: fold\.index === 1 \? 'fold1' : 'fold2'/);
assert.match(appSource, /id: isGlutenFree\s*\n\s*\? 'portioning'\s*\n\s*: isRomanTeglia \|\| isTargetBeginnerSchedule\s*\n\s*\? 'fridgeIn'\s*\n\s*: 'fridgeInCombined'/);
assert.match(appSource, /id: isRomanTeglia \? 'trayPrepare' : isGlutenFree \? 'portioning' : 'balling'/);
assert.match(appSource, /const useGentleFoldCopy = flour !== 'custom'/);
assert.match(appSource, /guidedNotificationCopy\.fold1Gentle/);
assert.match(appSource, /guidedNotificationCopy\.fold2Gentle/);
assert.equal((appSource.match(/for \(const fold of beginnerPhaseBPlan\.folds\)/g) || []).length, 1);

console.log('Beginner notification completeness and workflow exclusions passed.');
