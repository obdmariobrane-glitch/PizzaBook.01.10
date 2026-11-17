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
assert.match(beginnerSource, /isTegliaGlutenFreeBeginnerHand\s*\?\s*`U približno 80% vode, odnosno \$\{tegliaInitialWater\} g, otopite kvasac\.`/);
assert.match(beginnerSource, /isTegliaGlutenFreeBeginnerHand\s*\?\s*`Postupno dodajte preostalih 20% vode, odnosno \$\{tegliaRemainingWater\} g\.`/);
assert.match(beginnerSource, /isTegliaGlutenFreeBeginnerMixer\s*\?\s*`U približno 80% vode, odnosno \$\{tegliaInitialWater\} g, otopite kvasac\.`/);
assert.match(beginnerSource, /isTegliaGlutenFreeBeginnerMixer\s*\?\s*`Postupno dodajte preostalih 20% vode, odnosno \$\{tegliaRemainingWater\} g\.`/);
assert.match(source, /homogenu, ljepljivu masu/);
assert.match(source, /5 minuta kako bi psyllium/);
assert.match(localizedSource, /all the water|gesamte Wasser|vso vodo/);

const hand = beginnerSource.match(/\(isTegliaGlutenFreeBeginnerHand \|\| isNeapolitanGlutenFreeBeginnerHand\) \? \[([\s\S]*?)\] : isGlutenFree/);
const mixer = beginnerSource.match(/\(isTegliaGlutenFreeBeginnerMixer \|\| isNeapolitanGlutenFreeBeginnerMixer\) \? \[([\s\S]*?)\] : \(isTegliaGlutenFreeBeginnerHand/);
assert.ok(hand && mixer);
assert.equal((hand[1].match(/\n\s*(?:'|`)/g) ?? []).length, 10);
assert.equal((mixer[1].match(/\n\s*(?:'|`)/g) ?? []).length, 10);
for (const steps of [hand[1], mixer[1]]) {
  assert.match(steps, /ingredients\.water/);
  assert.match(steps, /tegliaInitialWater/);
  assert.match(steps, /tegliaRemainingWater/);
  assert.match(steps, /ingredients\.oil/);
  assert.match(steps, /psyllium/);
  assert.doesNotMatch(steps, /Stretch & Fold|elastič/);
}

console.log('Teglia Gluten Free Beginner Direct Phase A checks passed.');
