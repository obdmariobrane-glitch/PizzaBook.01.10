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
const plannerSource = fs.readFileSync(path.join(__dirname, '..', 'app', '(tabs)', 'planner.tsx'), 'utf8');
const sourceFile = ts.createSourceFile('index.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const normalizerDeclaration = sourceFile.statements.find((statement) =>
  ts.isFunctionDeclaration(statement) && statement.name?.text === 'normalizeProRomanMethodSelection');
assert.ok(normalizerDeclaration, 'PRO Romana method-state normalizer must be defined');
const normalizerCompiled = ts.transpileModule(
  `${normalizerDeclaration.getText(sourceFile)}\nmodule.exports = normalizeProRomanMethodSelection;`,
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } },
).outputText;
const normalizerModule = { exports: {} };
vm.runInNewContext(normalizerCompiled, { module: normalizerModule, exports: normalizerModule.exports });
const normalizeProRomanMethodSelection = normalizerModule.exports;

for (const romanFormat of ['tonda', 'teglia']) {
  const combinedSelection = { selectedMethod: 'biga', bigaEnabled: true, poolishEnabled: true };
  const gfSelection = normalizeProRomanMethodSelection(combinedSelection, false, 'romana', false);
  assert.deepEqual({ ...gfSelection }, { selectedMethod: 'direct', bigaEnabled: false, poolishEnabled: false }, `GF disables both preferments and selects Direct in PRO Romana ${romanFormat}`);
  const glutenReturnSelection = normalizeProRomanMethodSelection(gfSelection, false, 'romana', true);
  assert.deepEqual({ ...glutenReturnSelection }, { selectedMethod: 'direct', bigaEnabled: false, poolishEnabled: false }, `returning to gluten flour does not reactivate preferments in PRO Romana ${romanFormat}`);
}
const combinedSelection = { selectedMethod: 'biga', bigaEnabled: true, poolishEnabled: true };
assert.equal(normalizeProRomanMethodSelection(combinedSelection, false, 'neapolitan', false), combinedSelection, 'other pizza styles are not normalized by the Romana-only reset');
assert.equal(normalizeProRomanMethodSelection(combinedSelection, true, 'romana', false), combinedSelection, 'Beginner state is not changed by the PRO Romana reset');
assert.equal((source.match(/normalizeProRomanMethodSelection\(/g) || []).length, 4, 'the Romana normalizer is used by restore and both flour-change paths');
assert.match(source, /isProMethodAllowedForFlour\('biga', f, blendA, blendB, blendPctA\)/, 'flour selection uses the existing method-allowance rule');
assert.match(source, /isProMethodAllowedForFlour\('biga', flour, a, b, p\)/, 'blend selection uses the existing method-allowance rule');
assert.match(source, /const method: Method = isBeginner[\s\S]*?isProMethodAllowedForFlour\(selectedMethod, flour, blendA, blendB, blendPctA\)[\s\S]*?: 'direct';/, 'disallowed selected methods resolve to Direct');
assert.match(source, /const combinedPrefermentsActive = !isBeginner && bigaEnabled && poolishEnabled/);
assert.match(source, /bigaEnabled: !isBeginner && bigaEnabled,[\s\S]*poolishEnabled: !isBeginner && poolishEnabled/);
assert.match(source, /setSharedCalculatorPlanSettings\(\{[\s\S]*?method,[\s\S]*?bigaEnabled,[\s\S]*?poolishEnabled,/);
assert.match(plannerSource, /sharedCalculatorPlanSettings\s*\?\s*sharedCalculatorPlanSettings\.method\s*:\s*selectedMethod/, 'Planner uses the synchronized shared Direct method');

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

if (missingMarkers.length > 0 || missingPhaseMarkers.length > 0 || forbiddenCombinedPhase) {
  console.error('Romana workflow check failed. Missing required app behavior:');
  for (const marker of missingMarkers) console.error(`- ${marker}`);
  for (const marker of missingPhaseMarkers) console.error(`- ${marker}`);
  if (forbiddenCombinedPhase) console.error('- Combined fermentation and balling phase is still present.');
  process.exit(1);
}

console.log('Romana Tonda/Teglia workflow check passed.');