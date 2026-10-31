#!/usr/bin/env node

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const calculator = fs.readFileSync(path.join(__dirname, '..', 'src', 'calculator.ts'), 'utf8');
const ui = fs.readFileSync(path.join(__dirname, '..', 'app', '(tabs)', 'index.tsx'), 'utf8');
const translations = fs.readFileSync(path.join(__dirname, '..', 'src', 'i18n', 'translations.ts'), 'utf8');

assert.match(calculator, /total: \{[^}]*psyllium: number/);
assert.match(ui, /psyllium: dough\.total\.psyllium \?\? 0/);
assert.match(ui, /recipe\.proMode && recipe\.psyllium > 0/);
assert.match(ui, /name: ing\.psyllium/);
assert.match(translations, /psyllium: 'Psyllium ljuskice'/);
assert.match(translations, /psyllium: 'Psyllium husk'/);
assert.match(translations, /psyllium: 'Flohsamenschalen'/);
assert.match(translations, /psyllium: 'Psiliumove luščine'/);
console.log('F35 PRO psyllium shopping-list regression passed.');
