#!/usr/bin/env node

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'app', '(tabs)', 'index.tsx'), 'utf8');
const beginnerSource = source.slice(source.indexOf('function getDetailedDirectSteps('));
const localizedSource = source.slice(source.indexOf('function getDetailedDirectStepsLocalized('));

assert.match(source, /const isTegliaWholeWheatBeginnerHand = beginnerMode && isRomanTeglia && hand && flourType === 'wholeWheat';/g);
assert.match(source, /const isTegliaWholeWheatBeginnerMixer = beginnerMode && isRomanTeglia && !hand && flourType === 'wholeWheat';/g);
assert.match(source, /Teglia Romana – Integralno brašno – Ručni zamjes/);
assert.match(source, /Teglia Romana – Integralno brašno – Zamjes mikserom/);
assert.match(source, /approvedWholeWheatTegliaHandPhaseAInfo/);
assert.match(source, /approvedWholeWheatTegliaMixerPhaseAInfo/);
assert.match(source, /8–10 minuta/);
assert.match(source, /7–10 minuta/);
assert.match(source, /10–15 minuta/);
assert.match(source, /tegliaInitialWater/);
assert.match(source, /tegliaRemainingWater/);
assert.match(source, /isTargetTegliaWholeWheatHandPhaseA \|\| isTargetTegliaWholeWheatMixerPhaseA/);
assert.match(source, /isTargetTegliaWholeWheatHandPhaseA \|\| isTargetTegliaWholeWheatMixerPhaseA \|\| isTargetTegliaCustomHandPhaseA \|\| isTargetTegliaCustomMixerPhaseA\) && index === 0 \? 2/);
assert.match(source, /isTargetTegliaWholeWheatHandPhaseA \|\| isTargetTegliaWholeWheatMixerPhaseA \|\| isTargetTegliaCustomHandPhaseA \|\| isTargetTegliaCustomMixerPhaseA\) && index === 0 \? 7/);

const hand = beginnerSource.match(/isTegliaWholeWheatBeginnerHand \? \[([\s\S]*?)\]       : isTegliaTipo00BeginnerHand/);
const mixer = beginnerSource.match(/isTegliaWholeWheatBeginnerMixer \? \[([\s\S]*?)\]\s*:\s*isTegliaSpeltBeginnerMixer/);
assert.ok(hand && mixer);
assert.match(hand[1], /tegliaInitialWater/);
assert.match(hand[1], /tegliaRemainingWater/);
assert.match(mixer[1], /tegliaInitialWater/);
assert.match(mixer[1], /tegliaRemainingWater/);
assert.match(localizedSource, /isTegliaWholeWheatBeginnerHand/);
assert.match(localizedSource, /isTegliaWholeWheatBeginnerMixer/);

console.log('Teglia Whole Wheat Beginner Direct Phase A checks passed.');
