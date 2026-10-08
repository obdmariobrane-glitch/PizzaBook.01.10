#!/usr/bin/env node

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const appSource = fs.readFileSync(path.join(__dirname, '..', 'app', '(tabs)', 'index.tsx'), 'utf8');
const translations = fs.readFileSync(path.join(__dirname, '..', 'src', 'i18n', 'translations.ts'), 'utf8');

const eventIds = ['mix', 'fold1', 'fold2', 'fridgeIn', 'balling', 'portioning', 'trayPrepare', 'fridgeOut', 'preheat', 'shape', 'bake'];
for (const id of eventIds) {
  assert.ok(
    (translations.match(new RegExp(`\\b${id}:\\s*\\{`, 'g')) || []).length >= 4,
    `missing localized notification copy for ${id}`,
  );
}

assert.match(appSource, /const copy = t\.beginnerCalc\.guidedNotificationCopy\[event\.id\]/);
assert.match(appSource, /scheduleLocalAt\(copy\.title, notificationBody, event\.at/);
assert.match(appSource, /if \(beginnerPhaseBPlan\) \{\s*for \(const fold of beginnerPhaseBPlan\.folds\)/);
assert.match(appSource, /if \(fridgeHours > 0\) \{\s*steps\.push\(\{\s*id: isGlutenFree \? 'portioning' : 'fridgeIn'/);
assert.match(appSource, /id: isRomanTeglia \? 'trayPrepare' : isGlutenFree \? 'portioning' : 'balling'/);
assert.match(appSource, /if \(roomAfterFridgeHours > 0\) \{\s*steps\.push\(\{\s*id: 'fridgeOut'/);
assert.match(appSource, /id: 'preheat'/);
assert.match(appSource, /id: 'shape'/);
assert.match(appSource, /id: 'bake'/);

assert.match(appSource, /if \(beginnerPhaseBPlan\) \{\s*for \(const fold of beginnerPhaseBPlan\.folds\)/);
assert.match(appSource, /const isGlutenFree = flour === 'glutenFree'/);
assert.match(appSource, /const isRomanTeglia =/);
assert.match(appSource, /id: fold\.index === 1 \? 'fold1' : 'fold2'/);
assert.match(appSource, /id: isRomanTeglia \? 'trayPrepare' : isGlutenFree \? 'portioning' : 'balling'/);

console.log('Beginner notification completeness and workflow exclusions passed.');
