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

const { createDirectHomePizzaPlan, calculateBeginnerPhaseBPlan, MAX_BEGINNER_DIRECT_COLD_HOURS } = moduleRef.exports;
const now = new Date('2026-10-06T12:00:00.000Z');
const styles = [
  ['neapolitan', undefined],
  ['ny_style', undefined],
  ['romana', 'tonda'],
  ['romana', 'teglia'],
];

function createPlan(hours, style, romanFormat) {
  const bakeAt = new Date(now.getTime() + hours * 3600000);
  return createDirectHomePizzaPlan({
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
  }, { source: 'unknown' }, 65, 'dry', now, true);
}

for (const [style, romanFormat] of styles) {
  for (const hours of [4, 10, 24, 28, 48, 72, 96]) {
    const result = createPlan(hours, style, romanFormat);
    assert.ok(result, `${style}/${romanFormat ?? ''} ${hours}h should produce a schedule`);
    const { schedule } = result;
    const workflowHours = schedule.roomBeforeFridgeHours + schedule.fridgeHours + schedule.roomAfterFridgeHours;
    const expectedWorkflowHours = Math.min(hours, 28);
    const expectedStart = new Date(schedule.bakeAt.getTime() - expectedWorkflowHours * 3600000);

    assert.equal(schedule.bakeAt.getTime(), now.getTime() + hours * 3600000);
    assert.ok(schedule.fridgeHours >= 0);
    assert.ok(schedule.fridgeHours <= MAX_BEGINNER_DIRECT_COLD_HOURS);
    assert.equal(workflowHours, expectedWorkflowHours);
    assert.equal(schedule.startAt.getTime(), expectedStart.getTime());
    assert.equal(schedule.ballingAt.getTime(), schedule.startAt.getTime() + schedule.roomBeforeFridgeHours * 3600000);
    assert.ok(schedule.startAt.getTime() >= now.getTime());
    assert.ok(schedule.bakeAt.getTime() >= schedule.startAt.getTime());
    assert.equal(calculateBeginnerPhaseBPlan({
      durationMinutes: schedule.roomBeforeFridgeHours * 60,
      flourBehavior: 'standard',
      workflow: romanFormat === 'teglia' ? 'teglia' : 'round',
    }).durationMinutes, schedule.roomBeforeFridgeHours * 60);
  }
}

const roomOnly = createPlan(4, 'neapolitan');
assert.equal(roomOnly.schedule.strategy, 'roomOnly');
assert.deepEqual(
  [roomOnly.schedule.roomBeforeFridgeHours, roomOnly.schedule.fridgeHours, roomOnly.schedule.roomAfterFridgeHours],
  [1, 0, 3],
);

const hybrid = createPlan(10, 'neapolitan');
assert.equal(hybrid.schedule.strategy, 'hybrid');
assert.deepEqual(
  [hybrid.schedule.roomBeforeFridgeHours, hybrid.schedule.fridgeHours, hybrid.schedule.roomAfterFridgeHours],
  [2, 5, 3],
);

const coldDominant = createPlan(24, 'neapolitan');
assert.equal(coldDominant.schedule.strategy, 'coldDominant');
assert.deepEqual(
  [coldDominant.schedule.roomBeforeFridgeHours, coldDominant.schedule.fridgeHours, coldDominant.schedule.roomAfterFridgeHours],
  [1, 20, 3],
);

for (const hours of [48, 72, 96]) {
  const result = createPlan(hours, 'neapolitan');
  assert.equal(result.schedule.fridgeHours, 24);
  assert.equal(result.schedule.roomBeforeFridgeHours, 1);
  assert.equal(result.schedule.roomAfterFridgeHours, 3);
  assert.equal(result.schedule.startAt.getTime(), result.schedule.bakeAt.getTime() - 28 * 3600000);
  assert.ok(result.schedule.startAt.getTime() > now.getTime());
  assert.equal(calculateBeginnerPhaseBPlan({
    durationMinutes: 60,
    flourBehavior: 'standard',
    workflow: 'round',
  }).foldCount, 1);
}

console.log('Beginner Direct cold cap and delayed-start checks passed.');
