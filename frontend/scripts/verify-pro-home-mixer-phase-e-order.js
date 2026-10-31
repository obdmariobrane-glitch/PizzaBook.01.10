#!/usr/bin/env node

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const frontendRoot = path.join(__dirname, '..');
const sourcePath = path.join(frontendRoot, 'app', '(tabs)', 'index.tsx');
const source = fs.readFileSync(sourcePath, 'utf8');
const sourceFile = ts.createSourceFile(sourcePath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let replaceFunction;

const findReplaceFunction = (node) => {
  if (ts.isFunctionDeclaration(node) && node.name?.text === 'replaceProPhaseE') replaceFunction = node;
  ts.forEachChild(node, findReplaceFunction);
};
findReplaceFunction(sourceFile);
assert.ok(replaceFunction, 'the shared PRO final-phase replacement must exist');

const compiled = ts.transpileModule(
  `${replaceFunction.getText(sourceFile)}\nmodule.exports = replaceProPhaseE;`,
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } },
).outputText;
const moduleRef = { exports: {} };
vm.runInNewContext(compiled, {
  module: moduleRef,
  formatDuration: (seconds) => `${Math.round(seconds / 60)} min`,
  getBeginnerPreheatMinutes: () => 20,
  getTegliaFinalProofPlan: () => ({ proofMinutes: 60, pressRelaxationMinutes: 15, totalMinutes: 75 }),
  usesPizzaOvenBehavior: (oven) => oven === 'ooni',
  getKamadoBakeBlockedText: () => 'Kamado bake settings are not defined.',
});
const replaceProPhaseE = moduleRef.exports;

const preheatCopy = {
  hr: /Uključite kućnu pećnicu/,
  en: /Turn on the home oven/,
  de: /Schalten Sie den Haushaltsbackofen/,
  sl: /Vklopite domačo pečico/,
};
const temperCopy = {
  hr: /Nakon .*u hladnjaku/,
  en: /After .* in the refrigerator/,
  de: /Nehmen Sie .* im Kühlschrank heraus/,
  sl: /Po .* v hladilniku/,
};
const langs = ['hr', 'en', 'de', 'sl'];
const styles = ['napolitana', 'romanaTonda', 'newYork'];
const methods = [
  { id: 'direct', precedingLetters: 'ABCD' },
  { id: 'biga', precedingLetters: 'ABCDE' },
  { id: 'poolish', precedingLetters: 'ABCDE' },
];
let checks = 0;

function phasesFor(lang, precedingLetters) {
  const prefix = lang === 'hr' || lang === 'sl' ? 'Faza' : 'Phase';
  return [
    ...precedingLetters.split('').map((letter) => ({
      title: `${prefix} ${letter}: Existing phase`,
      steps: [`Existing ${letter} instruction`],
      timers: [],
    })),
    { title: `${prefix} E: Existing final phase`, steps: ['Existing final instruction'], timers: [] },
  ];
}

function options(lang, variant, mixing, oven = 'homeStone') {
  return {
    lang,
    variant,
    mixing,
    glutenFree: false,
    oven,
    ovenTemp: 250,
    fridgeHours: 24,
    finalRestMinutes: 120,
    diameter: 30,
    sauceAmount: 100,
    cheeseAmount: 100,
    trayCount: 1,
    bakingTimeRange: '6 min–9 min',
    trayDimensions: { width: 30, length: 40 },
  };
}

for (const lang of langs) {
  for (const style of styles) {
    for (const method of methods) {
      const input = phasesFor(lang, method.precedingLetters);
      const mixerPhase = replaceProPhaseE(input, options(lang, style, 'mixer')).at(-1);
      const handPhase = replaceProPhaseE(input, options(lang, style, 'hand')).at(-1);
      const spiralPhase = replaceProPhaseE(input, options(lang, style, 'spiral')).at(-1);

      assert.match(mixerPhase.steps[0], preheatCopy[lang], `${lang}/${style}/${method.id}: home-mixer step 1 is oven preheating`);
      assert.match(mixerPhase.steps[1], temperCopy[lang], `${lang}/${style}/${method.id}: home-mixer step 2 is dough tempering`);
      assert.deepEqual(mixerPhase.steps.slice(2), handPhase.steps.slice(2), 'only the home-mixer step order changes');
      assert.deepEqual(handPhase.steps.slice(0, 2), spiralPhase.steps.slice(0, 2), 'hand and spiral order remains unchanged');
      assert.match(handPhase.steps[0], temperCopy[lang]);
      assert.match(handPhase.steps[1], preheatCopy[lang]);
      checks += 1;
    }
  }

  const tegliaPhases = phasesFor(lang, 'ABCD');
  const tegliaMixer = replaceProPhaseE(tegliaPhases, options(lang, 'romanaTeglia', 'mixer')).at(-1);
  const tegliaHand = replaceProPhaseE(tegliaPhases, options(lang, 'romanaTeglia', 'hand')).at(-1);
  assert.deepEqual(tegliaMixer.steps, tegliaHand.steps, `${lang}: Teglia retains its own existing order`);

  const kamadoPhases = phasesFor(lang, 'ABCD');
  const kamadoMixer = replaceProPhaseE(kamadoPhases, options(lang, 'napolitana', 'mixer', 'kamado')).at(-1);
  const kamadoHand = replaceProPhaseE(kamadoPhases, options(lang, 'napolitana', 'hand', 'kamado')).at(-1);
  assert.deepEqual(kamadoMixer.steps, kamadoHand.steps, `${lang}: Kamado phase remains unchanged`);
  assert.equal(kamadoMixer.steps.length, 7);
}

assert.match(source, /const proPhaseEStepsBase = !isBeginner && detailedDirectSteps/);
assert.match(source, /mixing: mixingForExperience,/);
assert.match(source, /steps: isKamado[\s\S]*?mixing === 'mixer'[\s\S]*?\[copy\.preheat, copy\.temper/);
assert.equal(
  (source.match(/const proPhaseEStepsBase = !isBeginner && detailedDirectSteps/g) ?? []).length,
  1,
  'the final-phase replacement remains PRO-only',
);

console.log(`PRO home-mixer Phase E ordering passed (${checks} localized style/method combinations, plus Teglia/Kamado safeguards).`);
