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
  createDirectHomePizzaPlan,
  calculateBeginnerPhaseBPlan,
  evaluateDirectHomeCandidate,
  getBeginnerFlourGuidanceKind,
  getBeginnerPreheatMinutes,
  MAX_BEGINNER_DIRECT_COLD_HOURS,
} = moduleRef.exports;
const now = new Date('2026-10-06T12:00:00.000Z');
const styles = [
  ['neapolitan', undefined],
  ['ny_style', undefined],
  ['romana', 'tonda'],
  ['romana', 'teglia'],
];

function createPlan(hours, style, romanFormat, beginner = false) {
  const bakeAt = new Date(now.getTime() + hours * 3600000);
  return createDirectHomePizzaPlan({
    style,
    romanFormat,
    pizzas: 1,
    ballWeight: 250,
    method: 'direct',
    mixing: beginner ? 'hand' : undefined,
    bakeAt,
    roomTemp: 22,
    fridgeTemp: 4,
    ovenType: 'homeStone',
    ovenTemp: 260,
  }, { source: 'unknown' }, 65, 'dry', now, true);
}

assert.equal(createPlan(0.99, 'neapolitan', undefined, true), null);
assert.ok(createPlan(1, 'neapolitan', undefined, true));
assert.ok(createPlan(48, 'neapolitan', undefined, true));
const farBeginnerPlan = createPlan(48.01, 'neapolitan', undefined, true);
assert.ok(farBeginnerPlan);
assert.ok(farBeginnerPlan.schedule.startAt.getTime() > now.getTime());
assert.ok(farBeginnerPlan.schedule.bakeAt.getTime() - farBeginnerPlan.schedule.startAt.getTime() <= 48 * 3600000);
assert.notEqual(farBeginnerPlan.schedule.startAt.getTime(), farBeginnerPlan.schedule.bakeAt.getTime() - 48.01 * 3600000);

const guidanceCandidate = {
  strategy: 'roomOnly',
  roomBeforeFridgeHours: 1,
  fridgeHours: 0,
  roomAfterFridgeHours: 2,
  status: 'acceptable',
  warnings: [],
};
const unknownEvaluation = evaluateDirectHomeCandidate(guidanceCandidate, {
  flour: { source: 'unknown' },
  hydrationPct: 65,
  roomTemp: 22,
  fridgeTemp: 4,
  roomBeforeFridgeHours: 0,
  fridgeHours: 0,
  roomAfterFridgeHours: 0,
}, 'dry', true);
assert.equal(getBeginnerFlourGuidanceKind(unknownEvaluation, false), 'unknown');
assert.equal(getBeginnerFlourGuidanceKind(unknownEvaluation, true), 'glutenFree');
const knownEvaluation = evaluateDirectHomeCandidate(guidanceCandidate, {
  flour: { source: 'w', w: 180 },
  hydrationPct: 70,
  roomTemp: 22,
  fridgeTemp: 4,
  roomBeforeFridgeHours: 0,
  fridgeHours: 0,
  roomAfterFridgeHours: 0,
}, 'dry');
assert.equal(getBeginnerFlourGuidanceKind(knownEvaluation, false), 'strongerFlourMayHelp');

for (const ovenType of ['homeStone', 'homePan', 'ooni']) {
  const bakeAt = new Date('2026-10-07T00:15:00.000Z');
  const result = createDirectHomePizzaPlan({
    style: 'neapolitan',
    pizzas: 1,
    ballWeight: 250,
    method: 'direct',
    bakeAt,
    roomTemp: 22,
    fridgeTemp: 4,
    ovenType,
    ovenTemp: ovenType === 'ooni' ? 450 : 260,
  }, { source: 'unknown' }, 65, 'dry', new Date('2026-10-06T12:00:00.000Z'), true);
  assert.ok(result);
  assert.equal(
    result.schedule.preheatAt.getTime(),
    bakeAt.getTime() - getBeginnerPreheatMinutes(ovenType) * 60000,
  );
}

for (const [style, romanFormat] of styles) {
  for (const hours of [4, 10, 24, 28, 48]) {
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

for (const hours of [48]) {
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
for (const hours of [72, 168]) {
  const farPlan = createPlan(hours, 'neapolitan', undefined, true);
  assert.ok(farPlan);
  assert.ok(farPlan.schedule.bakeAt.getTime() - farPlan.schedule.startAt.getTime() <= 48 * 3600000);
}

console.log('Beginner Direct cold cap and delayed-start checks passed.');
