#!/usr/bin/env node

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const vm = require('node:vm');

process.env.TZ = 'Europe/Vienna';

function loadTypeScript(relativePath) {
  const source = fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const moduleRef = { exports: {} };
  vm.runInNewContext(compiled, { module: moduleRef, exports: moduleRef.exports }, { filename: relativePath });
  return moduleRef.exports;
}

const calculator = loadTypeScript('src/calculator.ts');
const { getNighttimeActiveEvents } = loadTypeScript('src/guidedRecipe.ts');
const now = new Date(2026, 9, 12, 0, 0, 0);

function actualPreparationEvents(schedule) {
  const events = [{ id: 'mix', at: schedule.startAt }];
  const phaseBStart = new Date(schedule.startAt.getTime() + (schedule.phaseAMinutes ?? 0) * 60000);
  for (const [id, offsetMinutes] of [['fold1', 20], ['fold2', 50]]) {
    if ((schedule.phaseBMinutes ?? 0) >= offsetMinutes) {
      events.push({ id, at: new Date(phaseBStart.getTime() + offsetMinutes * 60000) });
    }
  }
  events.push({ id: 'balling', at: schedule.ballingAt });
  if (schedule.fridgeHours > 0) {
    events.push({ id: 'fridgeIn', at: schedule.fridgeAt });
    events.push({
      id: 'fridgeOut',
      at: new Date(schedule.startAt.getTime() + (schedule.roomBeforeFridgeHours + schedule.fridgeHours) * 3600000),
    });
  }
  events.push({ id: 'preheat', at: schedule.preheatAt });
  events.push({ id: 'bake', at: schedule.bakeAt });
  return events
    .filter((event) => event.at && typeof event.at.getTime === 'function' && !Number.isNaN(event.at.getTime()))
    .sort((left, right) => left.at.getTime() - right.at.getTime());
}

function createPlan(bakeAt) {
  const plan = calculator.createDirectHomePizzaPlan({
    style: 'neapolitan',
    pizzas: 1,
    ballWeight: 250,
    method: 'direct',
    mixing: 'hand',
    bakeAt,
    roomTemp: 22,
    fridgeTemp: 4,
    ovenType: 'homeStone',
    ovenTemp: 260,
  }, { source: 'unknown' }, 62, 'dry', now, true);
  assert.ok(plan, `a Beginner plan should exist for ${bakeAt.toISOString()}`);
  return plan.schedule;
}

for (const hour of [5, 6, 7, 8]) {
  const schedule = createPlan(new Date(2026, 9, 13, hour, 0, 0));
  const events = actualPreparationEvents(schedule);
  assert.deepEqual(events.map((event) => event.id),
    schedule.fridgeHours > 0
      ? ['mix', 'fold1', 'fold2', 'balling', 'fridgeIn', 'fridgeOut', 'preheat', 'bake'].filter((id) =>
        id !== 'fold1' || schedule.phaseBMinutes >= 20).filter((id) => id !== 'fold2' || schedule.phaseBMinutes >= 50)
      : ['mix', 'fold1', 'fold2', 'balling', 'preheat', 'bake'].filter((id) =>
        id !== 'fold1' || schedule.phaseBMinutes >= 20).filter((id) => id !== 'fold2' || schedule.phaseBMinutes >= 50),
    `${String(hour).padStart(2, '0')}:00 actionable preparation events must be chronological`);
  for (let index = 1; index < events.length; index += 1) {
    assert.ok(events[index - 1].at.getTime() <= events[index].at.getTime());
  }
  const guidedEvents = events.map((event) => ({ ...event, label: event.id, actionable: true }));
  const nighttimeIds = getNighttimeActiveEvents(guidedEvents).map((event) => event.id);
  assert.deepEqual(nighttimeIds, events
    .filter((event) => event.at.getHours() < 6)
    .map((event) => event.id),
    `${String(hour).padStart(2, '0')}:00 warning detection must use actual preparation events`);
}

const reported = createPlan(new Date(2026, 9, 13, 7, 0, 0));
assert.equal(reported.startAt.toISOString(), '2026-10-12T01:05:00.000Z');
assert.equal(reported.ballingAt.toISOString(), '2026-10-12T02:55:00.000Z');
assert.equal(reported.fridgeAt.toISOString(), '2026-10-12T03:00:00.000Z');
assert.equal(reported.preheatAt.toISOString(), '2026-10-13T04:00:00.000Z');
assert.equal(reported.bakeAt.toISOString(), '2026-10-13T05:00:00.000Z');
assert.equal(reported.roomAfterFridgeHours, 2);
assert.equal(reported.fridgeHours, 24);
const reportedPhaseCStart = reported.ballingAt;
const reportedPhaseCEnd = reported.fridgeAt;
const reportedPhaseDStart = reported.fridgeAt;
const reportedPhaseDEnd = new Date(reported.startAt.getTime()
  + (reported.roomBeforeFridgeHours + reported.fridgeHours) * 3600000);
const reportedFinalRoomStart = reportedPhaseDEnd;
const reportedFinalRoomEnd = new Date(reportedFinalRoomStart.getTime() + reported.roomAfterFridgeHours * 3600000);
assert.equal(reportedPhaseCStart.toISOString(), '2026-10-12T02:55:00.000Z');
assert.equal(reportedPhaseCEnd.toISOString(), '2026-10-12T03:00:00.000Z');
assert.equal(reportedPhaseDStart.toISOString(), '2026-10-12T03:00:00.000Z');
assert.equal(reportedPhaseDEnd.toISOString(), '2026-10-13T03:00:00.000Z');
assert.equal(reportedFinalRoomEnd.toISOString(), '2026-10-13T05:00:00.000Z');
assert.equal(reportedFinalRoomStart.getTime(), reported.bakeAt.getTime() - 2 * 3600000,
  'the 2-hour final room rest is total time before baking, not an additional interval');
assert.equal(reportedFinalRoomEnd.getTime(), reported.bakeAt.getTime());

const reportedEvents = actualPreparationEvents(reported);
assert.deepEqual(reportedEvents.map((event) => `${event.id}@${event.at.toISOString()}`), [
  'mix@2026-10-12T01:05:00.000Z',
  'fold1@2026-10-12T01:45:00.000Z',
  'fold2@2026-10-12T02:15:00.000Z',
  'balling@2026-10-12T02:55:00.000Z',
  'fridgeIn@2026-10-12T03:00:00.000Z',
  'fridgeOut@2026-10-13T03:00:00.000Z',
  'preheat@2026-10-13T04:00:00.000Z',
  'bake@2026-10-13T05:00:00.000Z',
]);

console.log('Beginner nighttime schedule checks passed for 05:00, 06:00, 07:00, 08:00, and the reported midnight-crossing plan.');