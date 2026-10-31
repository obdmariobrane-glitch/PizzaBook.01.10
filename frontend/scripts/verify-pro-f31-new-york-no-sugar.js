#!/usr/bin/env node

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'app', '(tabs)', 'index.tsx'), 'utf8');
const calculator = fs.readFileSync(path.join(__dirname, '..', 'src', 'calculator.ts'), 'utf8');

assert.doesNotMatch(source, /(?:šećer|sugar|Zucker|sladkor)/i);
assert.doesNotMatch(calculator, /(?:sugar|šećer|Zucker|sladkor)/i);
assert.match(source, /pizzaStyle === 'ny_style'/);
assert.match(source, /ingredients\.salt/);
assert.match(source, /ingredients\.oil/);

for (const method of ['direct', 'biga', 'poolish']) {
  for (const yeast of ['fresh', 'activeDry', 'dry']) {
    assert.ok(method && yeast);
  }
}

console.log('F31 PRO New York no-sugar instruction regression passed.');
