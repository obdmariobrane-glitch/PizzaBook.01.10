#!/usr/bin/env node

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'app', '(tabs)', 'index.tsx'), 'utf8');

assert.match(source, /function PhaseBlock\(/);
assert.match(source, /showInfo\(infoTitles\.room/);
assert.match(source, /showInfo\(infoTitles\.baking/);
assert.match(source, /ProWebInfoContext\.Provider value=\{!isBeginner && Platform\.OS === 'web'\}/);
assert.match(source, /<Modal visible=\{proWebInfo && !!webInfo\}/);
assert.match(source, /onPress=\{\(\) => setStyleInfo\(key\)\}/);
assert.match(source, /<Modal visible=\{!!styleInfo\}/);

console.log('F33 PRO web contextual-help regression passed.');
