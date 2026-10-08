#!/usr/bin/env node

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'app', '(tabs)', 'index.tsx'), 'utf8');
const beginnerSource = source.slice(source.indexOf('function getDetailedDirectSteps('));
const localizedSource = source.slice(source.indexOf('function getDetailedDirectStepsLocalized('));

assert.match(source, /const isTegliaSpeltBeginnerHand = beginnerMode && isRomanTeglia && hand && flourType === 'spelt';/g);
assert.match(source, /const isTegliaSpeltBeginnerMixer = beginnerMode && isRomanTeglia && !hand && flourType === 'spelt';/g);
assert.match(source, /Teglia Romana – Pir – Ručni zamjes/);
assert.match(source, /Teglia Romana – Pir – Zamjes mikserom/);
assert.match(source, /approvedSpeltTegliaHandPhaseAInfo/);
assert.match(source, /approvedSpeltTegliaMixerPhaseAInfo/);
assert.match(source, /6–8 minuta/);
assert.match(source, /5–7 minuta/);
assert.match(source, /oko 15 minuta/);
assert.match(source, /oko 10 minuta/);
assert.match(source, /tegliaInitialWater/);
assert.match(source, /tegliaRemainingWater/);
assert.match(source, /isTargetTegliaSpeltHandPhaseA \|\| isTargetTegliaSpeltMixerPhaseA/);
assert.match(source, /isTargetTegliaSpeltHandPhaseA \|\| isTargetTegliaSpeltMixerPhaseA \|\| isTargetTegliaWholeWheatHandPhaseA \|\| isTargetTegliaWholeWheatMixerPhaseA \|\| isTargetTegliaCustomHandPhaseA \|\| isTargetTegliaCustomMixerPhaseA\) && index === 0 \? 2/);
assert.match(source, /isTargetTegliaSpeltHandPhaseA \|\| isTargetTegliaSpeltMixerPhaseA \|\| isTargetTegliaWholeWheatHandPhaseA \|\| isTargetTegliaWholeWheatMixerPhaseA \|\| isTargetTegliaCustomHandPhaseA \|\| isTargetTegliaCustomMixerPhaseA\) && index === 0 \? 7/);

const hand = beginnerSource.match(/isTegliaSpeltBeginnerHand \? \[([\s\S]*?)\]       : isTegliaManitobaBeginnerHand/);
const mixer = beginnerSource.match(/isTegliaSpeltBeginnerMixer \? \[([\s\S]*?)\] : isTegliaManitobaBeginnerMixer/);
assert.ok(hand && mixer);
assert.equal((hand[1].match(/\n\s*(?:'|`)/g) ?? []).length, 10);
assert.equal((mixer[1].match(/\n\s*(?:'|`)/g) ?? []).length, 10);
assert.match(localizedSource, /isTegliaSpeltBeginnerHand/);
assert.match(localizedSource, /isTegliaSpeltBeginnerMixer/);

console.log('Teglia Spelt Beginner Direct Phase A checks passed.');
