#!/usr/bin/env node

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const appPath = path.join(__dirname, '..', 'app', '(tabs)', 'index.tsx');
const source = fs.readFileSync(appPath, 'utf8');
const beginnerSource = source.slice(source.indexOf('function getDetailedDirectSteps('));
const localizedSource = source.slice(source.indexOf('function getDetailedDirectStepsLocalized('));

assert.match(source, /const isTegliaTipo00BeginnerHand = beginnerMode && isRomanTeglia && hand && flourType === 'caputo00';/);
assert.match(source, /const isTegliaTipo00BeginnerMixer = beginnerMode && isRomanTeglia && !hand && flourType === 'caputo00';/);
assert.match(source, /const isTegliaTipo00BeginnerHand = beginnerMode && isRomanTeglia && hand && flourType === 'caputo00';/g);
assert.match(source, /const isTegliaTipo00BeginnerMixer = beginnerMode && isRomanTeglia && !hand && flourType === 'caputo00';/g);
assert.doesNotMatch(source, /isTegliaTipo00BeginnerHand = .*flourType === '(?:manitoba|spelt|wholeWheat|glutenFree|custom)'/);
assert.doesNotMatch(source, /isTegliaTipo00BeginnerMixer = .*flourType === '(?:manitoba|spelt|wholeWheat|glutenFree|custom)'/);

const croatianHand = beginnerSource.match(/isTegliaTipo00BeginnerHand \? \[([\s\S]*?)\] : isTegliaTipo00BeginnerMixer/)[1];
const croatianMixer = beginnerSource.match(/isTegliaTipo00BeginnerMixer \? \[([\s\S]*?)\] : isNeapolitanTipo00BeginnerHand/)[1];
const localizedHand = localizedSource.match(/steps: \(?isTegliaCustomBeginnerHand \|\| isTegliaTipo00BeginnerHand(?: \|\| isTegliaManitobaBeginnerHand)?(?: \|\| isTegliaSpeltBeginnerHand)?(?: \|\| isTegliaWholeWheatBeginnerHand)?\)? \? \[([\s\S]*?)\] : \(?isTegliaCustomBeginnerMixer/)[1];
const localizedMixer = localizedSource.match(/steps:[\s\S]*?\(isTegliaTipo00BeginnerMixer(?: \|\| isTegliaManitobaBeginnerMixer)?(?: \|\| isTegliaSpeltBeginnerMixer)?(?: \|\| isTegliaWholeWheatBeginnerMixer)?\) \? \[([\s\S]*?)\] : isNeapolitanCustomBeginnerHand/)[1];

assert.equal((croatianHand.match(/\n\s*(?:'|`)/g) ?? []).length, 40);
assert.equal((croatianMixer.match(/\n\s*(?:'|`)/g) ?? []).length, 10);
assert.equal((localizedHand.match(/\n\s*pick\(/g) ?? []).length, 10);
assert.equal((localizedMixer.match(/\n\s*pick\(/g) ?? []).length, 10);

for (const steps of [croatianHand, croatianMixer, localizedHand, localizedMixer]) {
  assert.match(steps, /80%/);
  assert.match(steps, /20%/);
  assert.match(steps, /tegliaInitialWater/);
  assert.match(steps, /tegliaRemainingWater/);
  assert.match(steps, /ingredients\.water/);
  assert.match(steps, /ingredients\.oil/);
  assert.match(steps, /5 minuta|5 minutes|5 Minuten|5 minut/);
  assert.doesNotMatch(steps, /90%|90 %|10%|10 %/);
}

assert.match(source, /const tegliaInitialWater = Math\.round\(ingredients\.water \* 0\.8\);/);
assert.match(source, /const tegliaRemainingWater = Math\.max\(0, ingredients\.water - tegliaInitialWater\);/);
assert.match(source, /isTargetTegliaTipo00HandPhaseA \|\| isTargetTegliaTipo00MixerPhaseA \|\| isTargetTegliaManitobaHandPhaseA \|\| isTargetTegliaManitobaMixerPhaseA \|\| isTargetTegliaSpeltHandPhaseA \|\| isTargetTegliaSpeltMixerPhaseA \|\| isTargetTegliaWholeWheatHandPhaseA \|\| isTargetTegliaWholeWheatMixerPhaseA \|\| isTargetTegliaCustomHandPhaseA \|\| isTargetTegliaCustomMixerPhaseA\) && index === 0 \? 2/);
assert.match(source, /isTargetTegliaTipo00HandPhaseA \|\| isTargetTegliaTipo00MixerPhaseA \|\| isTargetTegliaManitobaHandPhaseA \|\| isTargetTegliaManitobaMixerPhaseA \|\| isTargetTegliaSpeltHandPhaseA \|\| isTargetTegliaSpeltMixerPhaseA \|\| isTargetTegliaWholeWheatHandPhaseA \|\| isTargetTegliaWholeWheatMixerPhaseA \|\| isTargetTegliaCustomHandPhaseA \|\| isTargetTegliaCustomMixerPhaseA\) && index === 0 \? 7/);
assert.match(source, /approvedTegliaHandPhaseAInfo/);
assert.match(source, /approvedTegliaMixerPhaseAInfo/);
assert.match(source, /timer\('post-mix-rest', Math\.round\(mixRestMinutes \* 60\), 'rest'\)/);
assert.match(source, /isTegliaTipo00BeginnerHand \|\| isTegliaTipo00BeginnerMixer/);
assert.doesNotMatch(source, /isTegliaTipo00BeginnerHand[\s\S]{0,1500}timer\(/);
assert.match(source, /pizzaStyle === 'romana'[\s\S]{0,80}romanFormat === 'teglia'/);
assert.doesNotMatch(source, /isTegliaTipo00BeginnerHand[\s\S]{0,120}romanFormat === 'tonda'/);

for (const oven of ['homeStone', 'ooni', 'homePan']) {
  assert.match(source, new RegExp(`oven === '${oven}'`));
}

console.log('Teglia Tipo 00 Beginner Direct Phase A checks passed.');
