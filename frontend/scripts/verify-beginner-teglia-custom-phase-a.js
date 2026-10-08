#!/usr/bin/env node

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'app', '(tabs)', 'index.tsx'), 'utf8');
const beginnerSource = source.slice(source.indexOf('function getDetailedDirectSteps('));
const localizedSource = source.slice(source.indexOf('function getDetailedDirectStepsLocalized('));

assert.match(source, /const isTegliaCustomBeginnerHand = beginnerMode && isRomanTeglia && hand && flourType === 'custom';/g);
assert.match(source, /const isTegliaCustomBeginnerMixer = beginnerMode && isRomanTeglia && !hand && flourType === 'custom';/g);
assert.match(source, /const isTargetTegliaCustomHandPhaseA/);
assert.match(source, /const isTargetTegliaCustomMixerPhaseA/);
assert.match(source, /Teglia Romana – Miješano brašno – Ručni zamjes/);
assert.match(source, /Teglia Romana – Miješano brašno – Zamjes mikserom/);
assert.match(source, /isTargetTegliaCustomHandPhaseA \|\| isTargetTegliaCustomMixerPhaseA\) && index === 0 \? 2/);
assert.match(source, /isTargetTegliaCustomHandPhaseA \|\| isTargetTegliaCustomMixerPhaseA\) && index === 0 \? 7/);

const hand = beginnerSource.match(/isTegliaCustomBeginnerHand \? \[([\s\S]*?)\] : isTegliaCustomBeginnerMixer/);
const mixer = beginnerSource.match(/isTegliaCustomBeginnerMixer \? \[([\s\S]*?)\]       : isTegliaSpeltBeginnerHand/);
assert.ok(hand && mixer);
assert.equal((hand[1].match(/\n\s*(?:'|`)/g) ?? []).length, 10);
assert.equal((mixer[1].match(/\n\s*(?:'|`)/g) ?? []).length, 10);
for (const steps of [hand[1], mixer[1]]) {
  assert.match(steps, /80%/);
  assert.match(steps, /20%/);
  assert.match(steps, /tegliaInitialWater/);
  assert.match(steps, /tegliaRemainingWater/);
  assert.match(steps, /5 minuta/);
}
assert.match(localizedSource, /isTegliaCustomBeginnerHand/);
assert.match(localizedSource, /isTegliaCustomBeginnerMixer/);

console.log('Teglia Custom/Blend Beginner Direct Phase A checks passed.');
