#!/usr/bin/env node

/* global __dirname */
const assert = require('node:assert/strict');
process.env.TZ = 'Europe/Vienna';
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'guidedRecipe.ts'), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const moduleRef = { exports: {} };
vm.runInNewContext(compiled, { module: moduleRef, exports: moduleRef.exports }, { filename: 'guidedRecipe.ts' });

const {
  createGuidedPlanId,
  getGuidedCountdown,
  getGuidedProgress,
  getLocalDayOffset,
  getNighttimeActiveEvents,
  getNextGuidedEvent,
  groupGuidedEventsByLocalDate,
  planGuidedNotifications,
} = moduleRef.exports;

const firstDay = new Date(2027, 3, 12, 23, 30);
const nextDay = new Date(2027, 3, 13, 0, 30);
const events = [
  { id: 'bake', at: new Date(2027, 3, 13, 18), label: 'Bake', actionable: true },
  { id: 'doughRest', at: new Date(2027, 3, 13, 8), label: 'Rest dough', actionable: false },
  { id: 'mix', at: firstDay, label: 'Mix', actionable: true },
  { id: 'fridgeOut', at: nextDay, label: 'Remove from fridge', actionable: true },
];
const groups = groupGuidedEventsByLocalDate(events);
assert.equal(groups.length, 2, 'events should be grouped by local calendar date');
assert.equal(
  Array.from(groups, (group) => Array.from(group.events, (event) => event.id).join(',')).join('|'),
  'mix|fridgeOut,doughRest,bake',
  'events and groups should be ordered chronologically',
);

const completedAt = { mix: Date.now() };
assert.equal(getNextGuidedEvent(events, completedAt).id, 'fridgeOut', 'passive waits and completed steps must not be next');
const progress = getGuidedProgress(events, completedAt);
assert.equal(progress.completed, 1);
assert.equal(progress.total, 3, 'passive waits should not count toward progress');
assert.equal(getNextGuidedEvent(events, { mix: 1, fridgeOut: 1, bake: 1 }), null);

const now = Date.now();
assert.equal(getGuidedCountdown(new Date(now + 120_000), now).status, 'upcoming');
assert.equal(getGuidedCountdown(new Date(now + 30_000), now).status, 'due');
assert.equal(getGuidedCountdown(new Date(now - 120_000), now).status, 'overdue');
assert.equal(getGuidedCountdown(new Date(now - 30_000), now).milliseconds, 0);

const identity = [firstDay.getTime(), nextDay.getTime(), 'neapolitan'];
assert.equal(createGuidedPlanId(identity), createGuidedPlanId([...identity]), 'equal plan inputs should have a stable identity');
assert.notEqual(createGuidedPlanId(identity), createGuidedPlanId([...identity, 'changed']), 'material plan changes should create a new identity');
assert.equal(getLocalDayOffset(firstDay, nextDay), 1, 'day offsets should use local calendar days');

{
  const localDate = (hour, minute = 0) => new Date(2027, 3, 13, hour, minute);
  const event = (id, at, activeUntil) => ({ id, at, activeUntil, label: id, actionable: true });
  const nighttimeBoundaryEvents = [
    event('midnight', localDate(0)),
    event('fivePastMidnight', localDate(0, 5)),
    event('one', localDate(1)),
    event('twoThirty', localDate(2, 30)),
    event('four', localDate(4)),
    event('five', localDate(5)),
    event('fiveFiftyNine', localDate(5, 59)),
    event('six', localDate(6)),
  ];
  assert.deepEqual(
    getNighttimeActiveEvents([
      ...nighttimeBoundaryEvents,
      event('day', localDate(12)),
      event('preheat', localDate(5, 30), localDate(6, 30)),
      { id: 'passive', at: localDate(2), label: 'passive', actionable: false },
    ]).map((item) => item.id),
    ['midnight', 'fivePastMidnight', 'one', 'twoThirty', 'four', 'five', 'fiveFiftyNine', 'preheat'],
    'nighttime detection must include every specified 00:00–05:59 boundary, cross-midnight intervals, and exclude 06:00 and passive waits',
  );
}

{
  const t0 = now + 3_600_000;
  const ev = (id, offset, actionable = true) => ({ id, at: new Date(t0 + offset), label: id, actionable });
  const ids = (items) => items.map((item) => item.combinedWith ? `${item.event.id}+${item.combinedWith.id}` : item.event.id).join(',');
  const base = [ev('mix', -600_000), ev('balling', -300_000), ev('shape', 900_000), ev('bake', 1_000_000)];

  // Same timestamp: one combined notification, both logical events remain in the input.
  const same = [...base, ev('roomFermentationEnd', 0), ev('preheat', 0), ev('fold1', 0)];
  assert.equal(ids(planGuidedNotifications(same, {}, now)), 'mix,balling,shape,bake,roomFermentationEnd+preheat,fold1');
  assert.equal(same.length, 7);
  // Regeneration with identical input is deterministic: no extra items.
  assert.equal(ids(planGuidedNotifications(same, {}, now)), ids(planGuidedNotifications([...same], {}, now)));

  // Different timestamps: two notifications.
  const diff = [...base, ev('roomFermentationEnd', 0), ev('preheat', 60_000)];
  assert.equal(ids(planGuidedNotifications(diff, {}, now)), 'mix,balling,shape,bake,roomFermentationEnd,preheat');

  // Unrelated event at the same time is preserved.
  assert.ok(ids(planGuidedNotifications(same, {}, now)).includes('fold1'));

  // Completed or past halves are not merged and not scheduled.
  assert.equal(ids(planGuidedNotifications(same, { roomFermentationEnd: 1 }, now)), 'mix,balling,shape,bake,preheat,fold1');
  assert.equal(ids(planGuidedNotifications(same, { preheat: 1 }, now)), 'mix,balling,shape,bake,roomFermentationEnd,fold1');
  assert.equal(ids(planGuidedNotifications(same, {}, t0 + 1)), 'shape,bake');

  // Fridge mode has no roomFermentationEnd: preheat stays single.
  const fridge = [...base, ev('fridgeOut', 0), ev('preheat', 0)];
  assert.equal(ids(planGuidedNotifications(fridge, {}, now)), 'mix,balling,shape,bake,fridgeOut,preheat');

  const teglia = [
    ev('trayTop', 0),
    ev('bake', 0),
  ];
  assert.equal(ids(planGuidedNotifications(teglia, {}, now)), 'bake+trayTop',
    'same-time Teglia topping and baking must produce one actionable reminder');
  assert.equal(ids(planGuidedNotifications([
    ev('trayTop', 0),
    ev('bake', 60_000),
  ], {}, now)), 'trayTop,bake',
  'Teglia topping and baking remain separate when their schedule times differ');
}

console.log('Guided recipe verification passed: local grouping, event order, progress, countdown, and plan identity.');
