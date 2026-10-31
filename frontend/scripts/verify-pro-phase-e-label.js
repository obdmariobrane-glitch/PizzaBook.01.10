#!/usr/bin/env node

const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const ts = require('typescript');
const vm = require('vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'app', '(tabs)', 'index.tsx'), 'utf8');
const sourceFile = ts.createSourceFile('index.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let functionNode;
const findReplaceProPhaseE = (node) => {
  if (ts.isFunctionDeclaration(node) && node.name?.text === 'replaceProPhaseE') functionNode = node;
  ts.forEachChild(node, findReplaceProPhaseE);
};
findReplaceProPhaseE(sourceFile);
assert.ok(functionNode, 'PRO final phase replacement function must exist');

const compiledFunction = ts.transpileModule(
  `${functionNode.getText(sourceFile)}\nmodule.exports = replaceProPhaseE;`,
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } },
).outputText;
const moduleRef = { exports: {} };
vm.runInNewContext(compiledFunction, {
  module: moduleRef,
  formatDuration: (seconds) => `${Math.round(seconds / 60)} min`,
  getBeginnerPreheatMinutes: () => 20,
  formatTemperature: (temperature) => `${temperature} °C`,
  getTegliaFinalProofPlan: () => ({ proofMinutes: 0, pressRelaxationMinutes: 0, totalMinutes: 0 }),
  usesPizzaOvenBehavior: (oven) => oven === 'ooni',
  getKamadoBakeBlockedText: () => 'Kamado bake settings are not defined.',
  timer: (id, seconds, kind) => ({ id, seconds, kind }),
});
const replaceProPhaseE = moduleRef.exports;

const prefixByLanguage = { hr: 'Faza', en: 'Phase', de: 'Phase', sl: 'Faza' };
const expectedTitle = {
  hr: (letter, tray) => `Faza ${letter}: ${tray ? 'Temperiranje, priprema tepsije i pečenje' : 'Temperiranje, oblikovanje i pečenje'}`,
  en: (letter, tray) => `Phase ${letter}: ${tray ? 'Tempering, tray preparation and baking' : 'Tempering, shaping and baking'}`,
  de: (letter, tray) => `Phase ${letter}: ${tray ? 'Temperieren, Blech vorbereiten und backen' : 'Temperieren, Formen und Backen'}`,
  sl: (letter, tray) => `Faza ${letter}: ${tray ? 'Temperiranje, priprava pekača in peka' : 'Temperiranje, oblikovanje in peka'}`,
};
const styles = ['napolitana', 'romanaTonda', 'romanaTeglia', 'newYork'];
const scenarios = [
  { name: 'direct cold', precedingLetters: 'ABCD', mixingPhaseLetter: 'A', fridgeHours: 24, expectedLetters: 'ABCDE' },
  { name: 'biga cold', precedingLetters: 'ABCDE', mixingPhaseLetter: 'B', fridgeHours: 24, expectedLetters: 'ABCDEF' },
  { name: 'poolish cold', precedingLetters: 'ABCDE', mixingPhaseLetter: 'B', fridgeHours: 24, expectedLetters: 'ABCDEF' },
  { name: 'biga room-only', precedingLetters: 'ABCD', mixingPhaseLetter: 'B', fridgeHours: 0, expectedLetters: 'ABCDE' },
  { name: 'poolish room-only', precedingLetters: 'ABCD', mixingPhaseLetter: 'B', fridgeHours: 0, expectedLetters: 'ABCDE' },
];
const bakeDuration = '60 s–90 s';

function makePhases(lang, precedingLetters, mixingPhaseLetter) {
  const prefix = prefixByLanguage[lang];
  return [
    ...precedingLetters.split('').map((letter) => ({
      title: `${prefix} ${letter}: Existing phase ${letter}`,
      steps: letter === mixingPhaseLetter ? ['Final mixing phase marker'] : [`Existing ${letter} instructions`],
      timers: [{ id: `timer-${letter}`, seconds: letter.charCodeAt(0), kind: 'rt' }],
      phaseId: `phase-${letter}`,
    })),
    { title: `${prefix} E: Existing final phase`, steps: ['Existing final instructions'], timers: [], phaseId: 'final-phase' },
  ];
}

function renderScenario(lang, variant, scenario) {
  const input = makePhases(lang, scenario.precedingLetters, scenario.mixingPhaseLetter);
  const result = replaceProPhaseE(input, {
    lang,
    variant,
    oven: 'ooni',
    ovenTemp: 450,
    fridgeHours: scenario.fridgeHours,
    finalRestMinutes: 30,
    diameter: 30,
    sauceAmount: 100,
    cheeseAmount: 100,
    trayCount: 1,
    bakingTimeRange: bakeDuration,
    trayDimensions: { width: 30, length: 40 },
  });
  assert.equal(result.length, input.length, `${scenario.name} must preserve phase count`);
  for (let index = 0; index < input.length - 1; index += 1) {
    assert.deepEqual(result[index], input[index], `${scenario.name} must preserve preceding phase ${index}`);
  }
  assert.equal(
    result.filter((phase) => phase.steps.includes('Final mixing phase marker')).length,
    1,
    `${scenario.name} must retain exactly one final-mixing phase`,
  );
  const finalPhase = result[result.length - 1];
  const expectedLetter = scenario.expectedLetters.at(-1);
  assert.equal(finalPhase.title, expectedTitle[lang](expectedLetter, variant === 'romanaTeglia'));
  assert.equal(finalPhase.phaseId, 'final-phase');
  assert.ok(finalPhase.steps.some((step) => step.includes(bakeDuration)), `${scenario.name} must preserve bake duration`);
  assert.deepEqual(Array.from(finalPhase.timers, ({ id, seconds }) => [id, seconds]), [
    ['tempering', 30 * 60],
    ['preheat', 20 * 60],
  ]);
  const actualLetters = result.map((phase) => phase.title.match(/^(?:Faza|Phase) ([A-Z]):/)?.[1]).join('');
  assert.equal(actualLetters, scenario.expectedLetters, `${lang}/${variant}/${scenario.name} labels must be sequential`);
  return finalPhase;
}

for (const lang of ['hr', 'en', 'de', 'sl']) {
  for (const variant of styles) {
    for (const scenario of scenarios) renderScenario(lang, variant, scenario);
  }
}

for (const lang of ['hr', 'en', 'de', 'sl']) {
  for (const variant of styles) {
    const phaseDResult = renderScenario(lang, variant, {
      name: 'preceding D',
      precedingLetters: 'ABCD',
      mixingPhaseLetter: 'B',
      fridgeHours: 24,
      expectedLetters: 'ABCDE',
    });
    const phaseEResult = renderScenario(lang, variant, {
      name: 'preceding E',
      precedingLetters: 'ABCDE',
      mixingPhaseLetter: 'B',
      fridgeHours: 24,
      expectedLetters: 'ABCDEF',
    });
    const withoutTitle = ({ title, ...phase }) => JSON.parse(JSON.stringify(phase));
    assert.deepEqual(withoutTitle(phaseDResult), withoutTitle(phaseEResult), 'only the final phase letter may change');
  }
}

assert.match(source, /const proPhaseEStepsBase = !isBeginner && detailedDirectSteps\s*\?\s*replaceProPhaseE/);
console.log('PRO final phase labels passed.');
