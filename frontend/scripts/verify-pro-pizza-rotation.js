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
assert.ok(functionNode, 'PRO Phase E replacement function must exist');

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

const expectedRotation = {
  hr: '25 sekundi',
  en: '25 seconds',
  de: '25 Sekunden',
  sl: '25 sekund',
};
const expectedBake = {
  hr: 'Pecite 60 s–90 s na 450 °C i rotirajte svakih 25 sekundi.',
  en: 'Bake for 60 s–90 s at 450 °C and rotate every 25 seconds.',
  de: 'Backen Sie 60 s–90 s bei 450 °C und drehen Sie die Pizza alle 25 Sekunden.',
  sl: 'Pecite 60 s–90 s pri 450 °C in pico obračajte vsakih 25 sekund.',
};
const styles = ['napolitana', 'romanaTonda', 'romanaTeglia', 'newYork'];
const bakeDuration = '60 s–90 s';
const ovenTemp = 450;

for (const lang of ['hr', 'en', 'de', 'sl']) {
  for (const variant of styles) {
    const [phase] = replaceProPhaseE([{ title: 'Original', steps: ['Original'] }], {
      lang,
      variant,
      oven: 'ooni',
      ovenTemp,
      fridgeHours: 0,
      finalRestMinutes: 30,
      diameter: 30,
      sauceAmount: 100,
      cheeseAmount: 100,
      trayCount: 1,
      bakingTimeRange: bakeDuration,
      trayDimensions: { width: 30, length: 40 },
    });
    const bakeStep = phase.steps.find((step) => step.includes(bakeDuration));
    assert.ok(bakeStep, `${lang}/${variant} must include a baking step`);
    assert.doesNotMatch(bakeStep, /0 min/);
    if (variant === 'romanaTeglia') {
      assert.doesNotMatch(bakeStep, /25/);
    } else {
      assert.match(bakeStep, new RegExp(expectedRotation[lang]));
      assert.equal(bakeStep, expectedBake[lang]);
    }
    assert.ok(bakeStep.includes(bakeDuration), `${lang}/${variant} must retain bake duration`);
    assert.ok(bakeStep.includes(`${ovenTemp} °C`), `${lang}/${variant} must retain temperature`);
  }
}

for (const lang of ['hr', 'en', 'de', 'sl']) {
  for (const oven of ['homeStone', 'homePan']) {
    const [phase] = replaceProPhaseE([{ title: 'Original', steps: ['Original'] }], {
      lang,
      variant: 'napolitana',
      oven,
      ovenTemp,
      fridgeHours: 0,
      finalRestMinutes: 30,
      diameter: 30,
      sauceAmount: 100,
      cheeseAmount: 100,
      trayCount: 1,
      bakingTimeRange: bakeDuration,
      trayDimensions: { width: 30, length: 40 },
    });
    const bakeStep = phase.steps.find((step) => step.includes(bakeDuration));
    assert.ok(bakeStep, `${lang}/${oven} must include a baking step`);
    assert.ok(bakeStep.includes(bakeDuration));
    assert.ok(bakeStep.includes(`${ovenTemp} °C`));
    assert.doesNotMatch(bakeStep, /25/);
  }
}

assert.match(source, /const proPhaseEStepsBase = !isBeginner && detailedDirectSteps/);
assert.match(source, /if \(usesPizzaOvenBehavior\(oven\)\) timers\.push\(\{ id: 'rotate', seconds: 25, kind: 'rotate' \}\)/);

console.log('PRO pizza rotation interval display passed.');
