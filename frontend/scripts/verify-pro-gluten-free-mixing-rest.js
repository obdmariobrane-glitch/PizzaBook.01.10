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

const { adaptProGlutenFreeMixingPhaseA } = require('../src/i18n/proGlutenFreeBulk.ts');
const source = fs.readFileSync(path.join(__dirname, '..', 'app', '(tabs)', 'index.tsx'), 'utf8');
assert.match(source, /const proDirectDisplaySteps = !isBeginner && method === 'direct' && isProDirectGlutenFree/);
assert.match(source, /adaptProGlutenFreeMixingPhaseA\(phase, mixingForExperience\)/);

const phase = {
  title: 'Phase A',
  steps: ['Mix the dough', 'Rest for 5 minutes'],
  timers: [
    { id: 'mixing', seconds: 600, kind: 'rest' },
    { id: 'post-mix-rest', seconds: 300, kind: 'rest' },
  ],
};
const hand = adaptProGlutenFreeMixingPhaseA(phase, 'hand');
assert.deepEqual(hand.steps, ['Mix the dough']);
assert.deepEqual(hand.timers.map((timer) => timer.id), ['mixing']);

for (const mixing of ['mixer', 'spiral']) {
  const adapted = adaptProGlutenFreeMixingPhaseA(phase, mixing);
  assert.deepEqual(adapted.steps, phase.steps);
  assert.deepEqual(adapted.timers, phase.timers);
}

assert.throws(
  () => adaptProGlutenFreeMixingPhaseA({ steps: ['Mix'] }, 'hand'),
  /missing its post-mix rest timer/,
);

console.log('PRO gluten-free mixing rest instructions and timer verified.');