#!/usr/bin/env node

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ui = fs.readFileSync(path.join(__dirname, '..', 'app', '(tabs)', 'index.tsx'), 'utf8');

assert.match(ui, /recipe\.proMode && recipe\.style_id === 'romana' && recipe\.settings\?\.romanFormat === 'teglia'/);
assert.match(ui, /hr: recipe\.pizzas === 1 \? 'tepsija' : 'tepsije'/);
assert.match(ui, /en: recipe\.pizzas === 1 \? 'tray' : 'trays'/);
assert.match(ui, /de: recipe\.pizzas === 1 \? 'Blech' : 'Bleche'/);
assert.match(ui, /sl: recipe\.pizzas === 1 \? 'pekač' : 'pekače'/);
assert.match(ui, /Pizzabook - Recept za \{N\} \$\{trayUnit\}/);
assert.match(ui, /Pizzabook - Recipe for \{N\} \$\{trayUnit\}/);
assert.match(ui, /Pizzabook - Rezept für \{N\} \$\{trayUnit\}/);
assert.match(ui, /Pizzabook - Recept za \{N\} \$\{trayUnit\}/);
assert.match(ui, /t\.shopping\.headerFmt/);

console.log('F36 PRO Romana Teglia shopping-unit regression passed.');
