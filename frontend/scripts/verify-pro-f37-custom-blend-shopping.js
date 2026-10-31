#!/usr/bin/env node

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ui = fs.readFileSync(path.join(__dirname, '..', 'app', '(tabs)', 'index.tsx'), 'utf8');

assert.match(ui, /const isCustomBlend = recipe\.proMode && recipe\.settings\?\.flour === 'custom'/);
assert.match(ui, /blendPctA/);
assert.match(ui, /Math\.round\(recipe\.flour \* blendPctA \/ 100\)/);
assert.match(ui, /recipe\.flour - blendFlourA/);
assert.match(ui, /flourName\(lang, recipe\.settings\.blendA\)/);
assert.match(ui, /flourName\(lang, recipe\.settings\.blendB\)/);
assert.match(ui, /\.\.\.flourItems/);
assert.match(ui, /formatWeight\(recipe\.flour, measurementSystem\)/);

console.log('F37 PRO custom flour-blend shopping regression passed.');
