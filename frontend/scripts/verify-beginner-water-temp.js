#!/usr/bin/env node

const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const ts = require('typescript');
const vm = require('vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'calculator.ts'), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const moduleRef = { exports: {} };
vm.runInNewContext(compiled, { module: moduleRef, exports: moduleRef.exports }, { filename: 'calculator.ts' });

const {
  BEGINNER_DIRECT_MIXING_FRICTION_C,
  BEGINNER_DIRECT_TARGET_DOUGH_TEMP_C,
  BEGINNER_DIRECT_WATER_TEMP_LIMITS_C,
  calculateBeginnerDirectWaterTemperature,
  doughCalc,
} = moduleRef.exports;

assert.equal(JSON.stringify(BEGINNER_DIRECT_TARGET_DOUGH_TEMP_C), JSON.stringify({
  neapolitan: 24,
  newYork: 24,
  romanaTonda: 22,
  romanaTeglia: 22,
}));
assert.equal(JSON.stringify(BEGINNER_DIRECT_MIXING_FRICTION_C), JSON.stringify({ hand: 2, home: 10 }));
assert.equal(JSON.stringify(BEGINNER_DIRECT_WATER_TEMP_LIMITS_C), JSON.stringify({ min: 2, max: 35 }));

const styles = ['neapolitan', 'newYork', 'romanaTonda', 'romanaTeglia'];
const expectedSweep = {
  neapolitan: {
    15: { hand: [35, true], home: [32, false] },
    18: { hand: [34, false], home: [26, false] },
    22: { hand: [26, false], home: [18, false] },
    25: { hand: [20, false], home: [12, false] },
    30: { hand: [10, false], home: [2, false] },
  },
  newYork: {
    15: { hand: [35, true], home: [32, false] },
    18: { hand: [34, false], home: [26, false] },
    22: { hand: [26, false], home: [18, false] },
    25: { hand: [20, false], home: [12, false] },
    30: { hand: [10, false], home: [2, false] },
  },
  romanaTonda: {
    15: { hand: [34, false], home: [26, false] },
    18: { hand: [28, false], home: [20, false] },
    22: { hand: [20, false], home: [12, false] },
    25: { hand: [14, false], home: [6, false] },
    30: { hand: [4, false], home: [2, true] },
  },
  romanaTeglia: {
    15: { hand: [34, false], home: [26, false] },
    18: { hand: [28, false], home: [20, false] },
    22: { hand: [20, false], home: [12, false] },
    25: { hand: [14, false], home: [6, false] },
    30: { hand: [4, false], home: [2, true] },
  },
};
for (const style of styles) {
  for (const roomTemp of [15, 18, 22, 25, 30]) {
    const hand = calculateBeginnerDirectWaterTemperature({ style, roomTemp, mixing: 'hand' });
    const mixer = calculateBeginnerDirectWaterTemperature({ style, roomTemp, mixing: 'home' });
    for (const [mixing, result] of [['hand', hand], ['home', mixer]]) {
      assert.equal(
        result.calculatedWaterTemp,
        (BEGINNER_DIRECT_TARGET_DOUGH_TEMP_C[style] * 3) - (roomTemp * 2) - BEGINNER_DIRECT_MIXING_FRICTION_C[result.mixing],
      );
      assert.equal(result.flourTemp, roomTemp);
      assert.equal(Number.isFinite(result.calculatedWaterTemp), true);
      assert.equal(Number.isInteger(result.recommendedWaterTemp), true);
      assert.ok(result.recommendedWaterTemp >= result.minimumWaterTemp && result.recommendedWaterTemp <= result.maximumWaterTemp);
      assert.equal(result.recommendedWaterTemp, Math.round(Math.max(result.minimumWaterTemp, Math.min(result.maximumWaterTemp, result.calculatedWaterTemp))));
      assert.equal(result.wasClamped, result.appliedLimit !== null);
      const [expectedTemperature, expectedClamped] = expectedSweep[style][roomTemp][mixing];
      assert.equal(result.recommendedWaterTemp, expectedTemperature, `${style} ${roomTemp}°C ${mixing} recommendation`);
      assert.equal(result.wasClamped, expectedClamped, `${style} ${roomTemp}°C ${mixing} clamp state`);
    }
    if (!hand.wasClamped && !mixer.wasClamped) {
      assert.notEqual(hand.recommendedWaterTemp, mixer.recommendedWaterTemp);
    }
  }
}

const hotRoomClamp = calculateBeginnerDirectWaterTemperature({ style: 'neapolitan', roomTemp: 10, mixing: 'hand' });
assert.equal(hotRoomClamp.calculatedWaterTemp, 50);
assert.equal(hotRoomClamp.recommendedWaterTemp, 35);
assert.equal(hotRoomClamp.appliedLimit, 'maximum');

const shared = {
  pizzas: 4,
  ballWeight: 250,
  hydration: 62,
  saltPct: 2.9,
  oilPct: 0,
  roomHours: 2,
  roomTemp: 22,
  fridgeHours: 6,
  fridgeTemp: 4,
  mixing: 'spiral',
  flourType: 'caputo00',
};
const beginnerDough = (mixing) => doughCalc({
  ...shared,
  method: 'direct',
  beginnerDirectStyle: 'neapolitan',
  beginnerDirectMixing: mixing,
});

const mixerResult = beginnerDough('home');
const handResult = beginnerDough('hand');
assert.equal(mixerResult.waterTemp, 18);
assert.equal(handResult.waterTemp, 26);
assert.equal(mixerResult.waterTemperature.calculatedWaterTemp, 18);
assert.equal(handResult.waterTemperature.calculatedWaterTemp, 26);
assert.equal(mixerResult.waterTemperature.targetFinalDoughTemp, 24);
assert.equal(mixerResult.waterTemperature.roomTemp, 22);
assert.equal(mixerResult.waterTemperature.flourTemp, 22);
assert.equal(mixerResult.waterTemperature.frictionFactor, 10);
assert.equal(handResult.waterTemperature.frictionFactor, 2);

for (const style of styles) {
  for (const flourType of ['caputo00', 'spelt', 'wholeWheat', 'custom']) {
    const result = doughCalc({
      ...shared,
      method: 'direct',
      flourType,
      beginnerDirectStyle: style,
      beginnerDirectMixing: 'home',
    });
    assert.equal(result.waterTemperature.targetFinalDoughTemp, BEGINNER_DIRECT_TARGET_DOUGH_TEMP_C[style]);
    assert.equal(result.waterTemp, result.waterTemperature.recommendedWaterTemp);
  }
}

const expectedLegacyTemp = 10;
for (const method of ['direct', 'biga', 'poolish']) {
  const options = {
    ...shared,
    method,
    fridgeHours: 24,
    beginnerDirectStyle: 'neapolitan',
    beginnerDirectMixing: 'home',
    flourType: method === 'direct' ? 'glutenFree' : 'caputo00',
  };
  const result = doughCalc(options);
  assert.equal(result.waterTemp, expectedLegacyTemp, `${method} legacy calculation changed`);
  assert.equal(result.waterTemperature, undefined, `${method} should not use Beginner DDT metadata`);
}

assert.throws(
  () => calculateBeginnerDirectWaterTemperature({ style: 'neapolitan', roomTemp: Number.NaN, mixing: 'home' }),
  (error) => error.name === 'RangeError',
);

console.log('Beginner direct-dough water-temperature checks passed.');
