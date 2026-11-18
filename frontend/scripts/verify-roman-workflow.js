#!/usr/bin/env node

const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const ts = require('typescript');
const vm = require('vm');

const calculatorScreen = path.join(__dirname, '..', 'app', '(tabs)', 'index.tsx');
const source = fs.readFileSync(calculatorScreen, 'utf8');
const calculatorSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'calculator.ts'), 'utf8');
const styleSteps = fs.readFileSync(path.join(__dirname, '..', 'src', 'i18n', 'styleSteps.ts'), 'utf8');
const functionSource = (name) => {
  const start = source.indexOf(`function ${name}(`);
  const end = source.indexOf('\nfunction ', start + 1);
  return source.slice(start, end === -1 ? undefined : end);
};
const directStepsSource = functionSource('getDetailedDirectSteps');
const localizedStepsSource = functionSource('getDetailedDirectStepsLocalized');
const calculatorCompiled = ts.transpileModule(calculatorSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const calculatorModule = { exports: {} };
vm.runInNewContext(calculatorCompiled, {
  module: calculatorModule,
  exports: calculatorModule.exports,
  require: () => ({ calculateBigaPoolishIngredients: () => ({}) }),
});

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
  'romanFormat: input.romanFormat',
  'if (!isBeginner) setStyleExpanded(false);',
  'styleExpanded && !isBeginner && pizzaStyle === \'romana\'',
];

const missingMarkers = requiredMarkers.filter((marker) => !source.includes(marker) && !calculatorSource.includes(marker));

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
assert.deepEqual({ ...calculatorModule.exports.getProTegliaToppingAmounts(30, 40) }, { sauce: 85, cheese: 90 });
assert.deepEqual({ ...calculatorModule.exports.getProTegliaToppingAmounts(60, 40) }, { sauce: 170, cheese: 180 });
assert.match(source, /!isBeginner && isRomanTeglia\s*\? \{ \.\.\.amounts, \.\.\.getProTegliaToppingAmounts\(trayWidth, trayLength\) \}/);
assert.deepEqual({ ...calculatorModule.exports.getTegliaFinalProofPlan(240) }, {
  totalMinutes: 135,
  pressRelaxationMinutes: 15,
  proofMinutes: 120,
});
assert.deepEqual({ ...calculatorModule.exports.getTegliaFinalProofPlan(74) }, {
  totalMinutes: 0,
  pressRelaxationMinutes: 0,
  proofMinutes: 0,
});
assert.match(directStepsSource, /\]\s*:\s*oven === 'homePan' \? \[\s*\.\.\.\(!beginnerMode && finalRestStep \? \[finalRestStep\] : \[\]\),\s*`Uključite pećnicu/);
assert.match(directStepsSource, /\]\s*:\s*\[\s*\.\.\.\(!beginnerMode && finalRestStep \? \[finalRestStep\] : \[\]\),\s*ovenSteps\[0\]/);
assert.match(localizedStepsSource, /\]\s*:\s*\[\s*\.\.\.\(!beginnerMode && ballTemperingStep \? \[ballTemperingStep\] : \[\]\),\s*ovenSteps\[0\]/);
const localizedHomePanStart = localizedStepsSource.indexOf("pick('Schieben Sie die Pizza in den vorgeheizten Ofen.'");
const localizedHomePanEnd = localizedStepsSource.indexOf("pick('Wenn ein Pizza-Programm vorhanden ist", localizedHomePanStart);
const localizedHomePanSteps = localizedStepsSource.slice(localizedHomePanStart, localizedHomePanEnd);
const pizzaInsertSteps = [...localizedHomePanSteps.matchAll(/pick\('Schieben Sie die Pizza in den vorgeheizten Ofen\.'/g)].map((match) => match.index);
const ovenPreheatSteps = [...localizedHomePanSteps.matchAll(/pick\('Heizen Sie den Ofen gründlich auf die maximale Temperatur vor\.'/g)].map((match) => match.index);
assert.equal(pizzaInsertSteps.length, 2);
assert.equal(ovenPreheatSteps.length, 2);
assert.ok(pizzaInsertSteps[0] < ovenPreheatSteps[0]);
assert.ok(ovenPreheatSteps[1] < pizzaInsertSteps[1]);
assert.match(source, /tempering: \{ hr: 'Temperiranje', en: 'Tempering'/);
assert.match(source, /ovenTiming: \{ hr: 'Prethodno zagrijavanje', en: 'Preheating', de: 'Vorheizen', sl: 'Predhodno segrevanje'/);

if (missingMarkers.length > 0 || missingPhaseMarkers.length > 0 || forbiddenCombinedPhase) {
  console.error('Romana workflow check failed. Missing required app behavior:');
  for (const marker of missingMarkers) console.error(`- ${marker}`);
  for (const marker of missingPhaseMarkers) console.error(`- ${marker}`);
  if (forbiddenCombinedPhase) console.error('- Combined fermentation and balling phase is still present.');
  process.exit(1);
}

console.log('Romana Tonda/Teglia workflow check passed.');