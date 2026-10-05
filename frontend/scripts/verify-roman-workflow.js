#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const calculatorScreen = path.join(__dirname, '..', 'app', '(tabs)', 'index.tsx');
const source = fs.readFileSync(calculatorScreen, 'utf8');
const styleSteps = fs.readFileSync(path.join(__dirname, '..', 'src', 'i18n', 'styleSteps.ts'), 'utf8');

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

const requiredPhaseMarkers = [
  'Faza B: Prva fermentacija (Bulking)',
  'Faza C: Prva fermentacija (Bulking)',
  'Faza C: Podjela i oblikovanje loptica (Bulice)',
  'Faza D: Podjela i oblikovanje loptica (Bulice)',
  'Faza C: Masa za tepsiju',
  'Faza E: Utiskivanje u tepsiju i pečenje',
];

const missingPhaseMarkers = requiredPhaseMarkers.filter((marker) => !source.includes(marker) && !styleSteps.includes(marker));
const forbiddenCombinedPhase = /Fermentacija i oblikovanje (?:kugli|loptica)/i.test(source) || /Fermentacija i oblikovanje (?:kugli|loptica)/i.test(styleSteps);

if (missingMarkers.length > 0 || missingPhaseMarkers.length > 0 || forbiddenCombinedPhase) {
  console.error('Romana workflow check failed. Missing required app behavior:');
  for (const marker of missingMarkers) console.error(`- ${marker}`);
  for (const marker of missingPhaseMarkers) console.error(`- ${marker}`);
  if (forbiddenCombinedPhase) console.error('- Combined fermentation and balling phase is still present.');
  process.exit(1);
}

console.log('Romana Tonda/Teglia workflow check passed.');