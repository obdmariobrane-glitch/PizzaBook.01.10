#!/usr/bin/env node

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'app', '(tabs)', 'index.tsx'), 'utf8');

assert.match(source, /const hasWaterInfo = .*Sieben und wiegen Sie\.\*Wasser\|Wiegen Sie \.\*Wasser/);
assert.match(source, /waterInfoStepIndex !== undefined \? i === waterInfoStepIndex/);
assert.match(source, /!beginnerMode && isGlutenFree/);
assert.match(source, /Wassertemperatur/);
assert.match(source, /Water temperature/);
assert.match(source, /Temperatura vode/);

console.log('F34 PRO German GF water INFO regression passed.');
