#!/usr/bin/env node

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'calculator.ts'), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const moduleRef = { exports: {} };
vm.runInNewContext(compiled, { module: moduleRef, exports: moduleRef.exports });
const calculator = moduleRef.exports;
const now = new Date('2026-10-08T08:00:00.000Z');

for (const hours of [1, 2, 3, 4, 6, 9, 12, 24, 48]) {
  for (const roomTemp of [18, 22, 26]) {
    for (const mixing of ['hand', 'home']) {
      const bakeAt = new Date(now.getTime() + hours * 3600000);
      const candidates = calculator.generateBeginnerDirectScheduleCandidates(hours, roomTemp, bakeAt);
      assert.equal(candidates.length, 2);
      const roomOnly = candidates.find((candidate) => candidate.mode === 'roomOnly');
      const fridgeRoom = candidates.find((candidate) => candidate.mode === 'fridgeRoom');
      assert.ok(roomOnly && fridgeRoom);

      for (const candidate of candidates) {
        assert.ok([0, 60, 90].includes(candidate.phaseBMinutes));
        assert.ok(candidate.phaseAMinutes > 0 && candidate.phaseCMinutes > 0);
        assert.ok(candidate.roomBeforeFridgeHours >= (20 + candidate.phaseBMinutes + 5) / 60);
        assert.ok(candidate.fridgeHours >= 0);
        assert.ok(candidate.roomAfterFridgeHours >= 0);
        assert.equal(candidate.startAt.getTime() + (candidate.roomBeforeFridgeHours + candidate.fridgeHours + candidate.roomAfterFridgeHours) * 3600000, bakeAt.getTime());
        assert.ok(candidate.startAt <= candidate.ballingAt);
        assert.ok(candidate.ballingAt < candidate.fridgeAt);
        assert.ok(candidate.fridgeAt <= candidate.doughReadyAt);
        assert.ok(candidate.warnings.every((warning) => !/\b0 minutes?\b/i.test(warning)));
      }

      assert.equal(roomOnly.fridgeHours, 0);
      assert.ok(roomOnly.roomAfterFridgeHours >= 0);
      if (fridgeRoom.status !== 'unsupported') {
        assert.ok(fridgeRoom.fridgeHours >= 3);
        assert.equal(fridgeRoom.phaseCMinutes, 5);
        assert.ok(fridgeRoom.thermalUncertainty);
      }

      for (const mode of ['roomOnly', 'fridgeRoom']) {
        const plan = calculator.createDirectHomePizzaPlan({
          style: 'neapolitan',
          pizzas: 1,
          ballWeight: 250,
          method: 'direct',
          bakeAt,
          roomTemp,
          fridgeTemp: 4,
          ovenType: 'homeStone',
          ovenTemp: 260,
          flourType: 'caputo00',
          mixing,
          beginnerScheduleMode: mode,
        }, { source: 'w', w: 280 }, 62, 'dry', now, true);
        assert.ok(plan, `${hours}h ${roomTemp}C ${mixing} ${mode} should return a plan`);
        assert.ok(plan.candidateEvaluations.length === 2);
        assert.equal(plan.schedule.bakeAt.getTime(), bakeAt.getTime());
        assert.ok(plan.schedule.phaseAMinutes === 20);
        assert.ok(plan.schedule.phaseCMinutes === 5);
      }
    }
  }
}

const sixHour = calculator.createDirectHomePizzaPlan({
  style: 'neapolitan', pizzas: 1, ballWeight: 250, method: 'direct',
  bakeAt: new Date(now.getTime() + 6 * 3600000), roomTemp: 22, fridgeTemp: 4,
  ovenType: 'homeStone', ovenTemp: 260, flourType: 'caputo00', mixing: 'hand',
}, { source: 'w', w: 280 }, 62, 'dry', now, true);
const nineHour = calculator.createDirectHomePizzaPlan({
  style: 'neapolitan', pizzas: 1, ballWeight: 250, method: 'direct',
  bakeAt: new Date(now.getTime() + 9 * 3600000), roomTemp: 22, fridgeTemp: 4,
  ovenType: 'homeStone', ovenTemp: 260, flourType: 'caputo00', mixing: 'home',
}, { source: 'w', w: 280 }, 62, 'dry', now, true);
assert.ok(sixHour.schedule.fridgeHours >= 3);
assert.equal(sixHour.schedule.phaseBMinutes, 0);
assert.equal(sixHour.schedule.roomAfterFridgeHours, 2);
assert.equal(nineHour.schedule.phaseBMinutes, 90);
assert.equal(nineHour.schedule.roomAfterFridgeHours, 2);
assert.ok(nineHour.schedule.fridgeHours >= 3);

const exposure = { roomBeforeExposure: 1, fridgeExposure: 2, roomAfterExposure: 3, roomExposure: 4, totalExposure: 6 };
const yeast = calculator.calculateDirectHomeYeastRequirement(exposure);
assert.equal(yeast.freshYeastPct, 0.5 / 6);
assert.equal(yeast.dryYeastPct, (0.5 / 6) / 3);

const outsideScope = calculator.createDirectHomePizzaPlan({
  style: 'ny_style', pizzas: 1, ballWeight: 375, method: 'direct',
  bakeAt: new Date(now.getTime() + 9 * 3600000), roomTemp: 22, fridgeTemp: 4,
  ovenType: 'homeStone', flourType: 'manitoba', mixing: 'home',
}, { source: 'w', w: 350 }, 64, 'dry', now, false);
assert.ok(outsideScope);
assert.equal(outsideScope.schedule.phaseAMinutes, undefined);

const beginnerStyles = [
  ['neapolitan', undefined],
  ['romana', 'tonda'],
  ['romana', 'teglia'],
  ['ny_style', undefined],
];
const beginnerFlours = ['caputo00', 'manitoba', 'spelt', 'wholeWheat', 'glutenFree', 'custom'];
for (const [style, romanFormat] of beginnerStyles) {
  for (const flourType of beginnerFlours) {
    for (const mixing of ['hand', 'home']) {
      for (const mode of ['roomOnly', 'fridgeRoom']) {
      const bakeAt = new Date(now.getTime() + 10 * 3600000);
      const plan = calculator.createDirectHomePizzaPlan({
        style,
        romanFormat,
        pizzas: 1,
        ballWeight: 250,
        method: 'direct',
        bakeAt,
        roomTemp: 22,
        fridgeTemp: 4,
        ovenType: 'homeStone',
        ovenTemp: 260,
        flourType,
        mixing,
        beginnerScheduleMode: mode,
      }, { source: 'w', w: flourType === 'glutenFree' ? 0 : 280 }, 62, 'dry', now, true);
      assert.ok(plan, `${style}/${romanFormat ?? ''}/${flourType}/${mode} should produce a plan`);
      assert.equal(plan.input.beginnerScheduleMode, mode);
      assert.equal(plan.selectedEvaluation.candidate.mode, mode);
      assert.equal(plan.schedule.bakeAt.getTime(), bakeAt.getTime());
      assert.equal(plan.candidateEvaluations.length, 2);
      if (mode === 'roomOnly') {
        assert.equal(plan.schedule.fridgeHours, 0);
      } else if (plan.selectedEvaluation.selectable) {
        assert.ok(plan.schedule.fridgeHours >= 3);
      }
      }
    }
  }
}

const unavailableFridgePlan = calculator.createDirectHomePizzaPlan({
  style: 'romana',
  romanFormat: 'teglia',
  pizzas: 1,
  ballWeight: 250,
  method: 'direct',
  bakeAt: new Date(now.getTime() + 2 * 3600000),
  roomTemp: 22,
  fridgeTemp: 4,
  ovenType: 'homeStone',
  ovenTemp: 260,
  flourType: 'custom',
  mixing: 'home',
  beginnerScheduleMode: 'fridgeRoom',
}, { source: 'w', w: 280 }, 62, 'dry', now, true);
assert.ok(unavailableFridgePlan);
assert.equal(unavailableFridgePlan.selectedEvaluation.candidate.mode, 'fridgeRoom');
assert.equal(unavailableFridgePlan.selectedEvaluation.selectable, false);
assert.ok(unavailableFridgePlan.selectedEvaluation.rejectionReasons.length > 0);

console.log('Beginner Direct V1 schedule regression checks passed.');
