#!/usr/bin/env node

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'app', '(tabs)', 'index.tsx'), 'utf8');
const beginnerSource = source.slice(source.indexOf('function getDetailedDirectSteps('));
const localizedSource = source.slice(source.indexOf('function getDetailedDirectStepsLocalized('));

assert.match(source, /const isTegliaGlutenFreeBeginnerHand = beginnerMode && isRomanTeglia && hand && flourType === 'glutenFree';/);
assert.match(source, /const isTegliaGlutenFreeBeginnerMixer = beginnerMode && isRomanTeglia && !hand && flourType === 'glutenFree';/);
assert.match(source, /Teglia Romana – Bez glutena – Ručni zamjes/);
assert.match(source, /Teglia Romana – Bez glutena – Zamjes mikserom/);
assert.match(source, /isTegliaGlutenFreeBeginnerMixer \|\| isNeapolitanGlutenFreeBeginnerMixer/);
assert.match(source, /isTegliaGlutenFreeBeginnerHand \|\| isNeapolitanGlutenFreeBeginnerHand/);
assert.match(source, /isTargetTegliaGlutenFreeHandPhaseA/);
assert.match(source, /isTargetTegliaGlutenFreeMixerPhaseA/);
assert.match(source, /Ulijte svu vodu, odnosno \$\{ingredients\.water\} g/);
assert.match(source, /homogenu, ljepljivu masu/);
assert.match(source, /5 minuta kako bi psyllium/);
assert.doesNotMatch(source, /TegliaGlutenFreeBeginner[\s\S]{0,1200}90%/);
assert.doesNotMatch(source, /TegliaGlutenFreeBeginner[\s\S]{0,1200}80%/);
assert.match(localizedSource, /all the water|gesamte Wasser|vso vodo/);

const hand = beginnerSource.match(/\(isTegliaGlutenFreeBeginnerHand \|\| isNeapolitanGlutenFreeBeginnerHand\) \? \[([\s\S]*?)\] : isGlutenFree/);
const mixer = beginnerSource.match(/\(isTegliaGlutenFreeBeginnerMixer \|\| isNeapolitanGlutenFreeBeginnerMixer\) \? \[([\s\S]*?)\] : \(isTegliaGlutenFreeBeginnerHand/);
assert.ok(hand && mixer);
assert.equal((hand[1].match(/\n\s*(?:'|`)/g) ?? []).length, 9);
assert.equal((mixer[1].match(/\n\s*(?:'|`)/g) ?? []).length, 9);
for (const steps of [hand[1], mixer[1]]) {
  assert.match(steps, /ingredients\.water/);
  assert.match(steps, /ingredients\.oil/);
  assert.match(steps, /psyllium/);
  assert.doesNotMatch(steps, /remainingWater|tegliaInitialWater|tegliaRemainingWater|90%|80%|10%|20%|Stretch & Fold|elastič/);
}

console.log('Teglia Gluten Free Beginner Direct Phase A checks passed.');
