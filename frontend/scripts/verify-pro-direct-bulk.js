#!/usr/bin/env node

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

require.extensions['.ts'] = (module, filename) => {
  const source = fs.readFileSync(filename, 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  module._compile(output, filename);
};

const {
  adaptProDirectBulkPhase,
  adaptProRomanDirectBulkPhase,
  getProNapolitanaBulkRestSeconds,
} = require('../src/i18n/proDirectBulk.ts');
const source = fs.readFileSync(path.join(__dirname, '..', 'app', '(tabs)', 'index.tsx'), 'utf8');

assert.match(source, /const isProDirectGlutenFree = flour === 'glutenFree'/);
assert.match(source, /const proDirectRoomDurationSteps = !isBeginner && method === 'direct' && !isProDirectGlutenFree/);
assert.match(source, /adaptProDirectBulkPhase\(phase, lang, totalSeconds, getProNapolitanaBulkRestSeconds\(roomTemp\)\)/);
assert.equal(getProNapolitanaBulkRestSeconds(22), 30 * 60);

const phase = { title: 'Bulk', steps: ['old instruction'], timers: [{ id: 'old', seconds: 1, kind: 'rt' }] };
const adapted = adaptProDirectBulkPhase(phase, 'en', 100 * 60, 30 * 60);
assert.deepEqual(adapted.timers.map((timer) => timer.seconds), [30 * 60, 30 * 60, 40 * 60]);
assert.equal(adapted.timers.reduce((sum, timer) => sum + timer.seconds, 0), 100 * 60);
assert.match(adapted.steps[1], /30 min/);
assert.match(adapted.steps[3], /30 min/);
assert.match(adapted.steps[5], /40 min/);

const noRoom = adaptProDirectBulkPhase(phase, 'hr', 0, 30 * 60);
assert.deepEqual(noRoom.timers, []);
assert.match(noRoom.steps[1], /nemojte dodavati vrijeme/);

const romana = adaptProRomanDirectBulkPhase({ ...phase, steps: ['Stretch & Fold', 'Stretch & Fold'] }, 'de');
assert.deepEqual(romana.timers, []);
assert.equal(romana.steps.filter((step) => /Stretch & Fold/.test(step)).length, 2);

console.log('PRO direct bulk instructions and timers verified.');