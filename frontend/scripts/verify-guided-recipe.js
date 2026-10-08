#!/usr/bin/env node

/* global __dirname */
const assert = require('node:assert/strict');
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
  getNextGuidedEvent,
  groupGuidedEventsByLocalDate,
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

console.log('Guided recipe verification passed: local grouping, event order, progress, countdown, and plan identity.');
