#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const calculatorScreen = path.join(__dirname, '..', 'app', '(tabs)', 'index.tsx');
const source = fs.readFileSync(calculatorScreen, 'utf8');

const requiredMarkers = [
  "romanFormat: 'tonda' | 'teglia'",
  'const isRomanTeglia = pizzaStyle === \'romana\' && romanFormat === \'teglia\';',
  'const trayDoughWeight = Math.round(trayWidth * trayLength * 0.4);',
  'testID="romana-tonda"',
  'Romana Tonda',
  'testID="romana-teglia"',
  'Romana Teglia',
  "setOven('homePan')",
  'romanFormat, trayWidth, trayLength',
];

const missingMarkers = requiredMarkers.filter((marker) => !source.includes(marker));

if (missingMarkers.length > 0) {
  console.error('Romana workflow check failed. Missing required app behavior:');
  for (const marker of missingMarkers) console.error(`- ${marker}`);
  process.exit(1);
}

console.log('Romana Tonda/Teglia workflow check passed.');