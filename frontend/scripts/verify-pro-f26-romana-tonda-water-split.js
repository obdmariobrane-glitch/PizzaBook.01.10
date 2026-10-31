#!/usr/bin/env node

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'app', '(tabs)', 'index.tsx'), 'utf8');
const waterSplitSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'i18n', 'proIceWaterInstructions.ts'), 'utf8');

assert.match(source, /const proRomanTondaSplit = !beginnerMode && isRomanTonda/);
assert.match(source, /const directInitialWaterPct = isRomanTeglia \|\| proRomanTondaSplit \? 80 : 90/);
assert.match(source, /directInitialWaterPct: 80 \| 90 = isRomanTeglia \|\| \(!isBeginner && pizzaStyle === 'romana' && romanFormat === 'tonda'\) \? 80 : 90/);
assert.match(source, /directRemainingWaterPct = 100 - directInitialWaterPct/);
assert.match(waterSplitSource, /Math\.round\(liquidWaterGrams \* \(initialWaterPct \/ 100\)\)/);

for (const water of [100, 163, 248, 401]) {
  const initial = Math.round(water * 0.8);
  const remaining = Math.max(0, water - initial);
  assert.equal(initial + remaining, water);
  assert.equal(Math.round((initial / water) * 100), 80);
}

assert.match(source, /const directInitialWaterPct = isRomanTeglia \|\| proRomanTondaSplit \? 80 : 90/);
assert.match(source, /const directInitialWater = isRomanTeglia \|\| proRomanTondaSplit \? tegliaInitialWater : initialWater/);
assert.match(source, /const directRemainingWater = isRomanTeglia \|\| proRomanTondaSplit \? tegliaRemainingWater : remainingWater/);

console.log('F26 Romana Tonda PRO 80/20 water split regression passed.');
