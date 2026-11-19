#!/usr/bin/env node

const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const ts = require('typescript');
const vm = require('vm');

const frontendRoot = path.join(path.dirname(module.filename), '..');
const indexPath = path.join(frontendRoot, 'app', '(tabs)', 'index.tsx');
const indexSource = fs.readFileSync(indexPath, 'utf8');
const indexFile = ts.createSourceFile(indexPath, indexSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const pressRestFunction = indexFile.statements.find(
  (statement) => ts.isFunctionDeclaration(statement) && statement.name?.text === 'getRomanTegliaPressRestTimer',
);
assert.ok(pressRestFunction, 'production Romana Teglia press-rest timer must exist');
const pressRestModule = { exports: {} };
vm.runInNewContext(ts.transpileModule(
  `${pressRestFunction.getText(indexFile)}\nmodule.exports = getRomanTegliaPressRestTimer;`,
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } },
).outputText, { module: pressRestModule, exports: pressRestModule.exports });
const phaseFunction = indexFile.statements.find(
  (statement) => ts.isFunctionDeclaration(statement) && statement.name?.text === 'replaceProPhaseE',
);
assert.ok(phaseFunction, 'production PRO final-phase replacement must exist');

const compiledPhaseFunction = ts.transpileModule(
  `${phaseFunction.getText(indexFile)}\nmodule.exports = replaceProPhaseE;`,
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } },
).outputText;
const phaseModule = { exports: {} };
vm.runInNewContext(compiledPhaseFunction, {
  module: phaseModule,
  formatDuration: (seconds) => `${Math.round(seconds / 60)} min`,
  usesPizzaOvenBehavior: (oven) => oven === 'ooni' || oven === 'kamado',
  getBeginnerPreheatMinutes: () => 20,
  getRomanTegliaPressRestTimer: pressRestModule.exports,
  getTegliaFinalProofPlan: () => ({ proofMinutes: 0, pressRelaxationMinutes: 0, totalMinutes: 0 }),
  getKamadoBakeBlockedText: () => 'Kamado bake settings are not defined.',
});
const replaceProPhaseE = phaseModule.exports;

const prefermentPath = path.join(frontendRoot, 'src', 'i18n', 'prefermentSteps.ts');
const compiledPreferment = ts.transpileModule(fs.readFileSync(prefermentPath, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const compiledSpiralMixing = ts.transpileModule(
  fs.readFileSync(path.join(frontendRoot, 'src', 'i18n', 'spiralMixing.ts'), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } },
).outputText;
const spiralMixingModule = { exports: {} };
vm.runInNewContext(compiledSpiralMixing, {
  module: spiralMixingModule,
  exports: spiralMixingModule.exports,
  require: (specifier) => {
    assert.equal(specifier, './proIceWaterInstructions');
    return { calculateProWaterSplit: () => ({}) };
  },
});
const prefermentModule = { exports: {} };
vm.runInNewContext(compiledPreferment, {
  module: prefermentModule,
  exports: prefermentModule.exports,
  require: (specifier) => {
    assert.equal(specifier, './spiralMixing');
    return spiralMixingModule.exports;
  },
});
const { getYeastAwarePrefermentSteps } = prefermentModule.exports;

const languages = {
  hr: {
    removal: /izvadite jednu (?:bezglutensku )?kuglicu|jednu (?:bezglutensku )?kuglicu .* izvadite/i,
    transferWork: /prebacite je na .*radnu površinu|prebacite je na pripremljenu radnu površinu/i,
    shaping: /oblikujte|utisnite|potiskujte/i,
    toppings: /nadjenite|dodajte nadjev|rasporedite/i,
    launch: /pizzu pažljivo stavite|pažljivo prebacite|pažljivo ubacite/i,
    transferBake: /prebacite (?:pizzu )?na odabranu površinu za pečenje/i,
    bake: /pecite/i,
  },
  en: {
    removal: /remove one (?:gluten-free )?dough ball/i,
    transferWork: /transfer it to .*work surface/i,
    shaping: /shape|press/i,
    toppings: /add toppings|spread|distribute/i,
    launch: /carefully place the pizza|carefully transfer it|carefully launch it/i,
    transferBake: /transfer (?:the pizza|it) to the selected baking surface/i,
    bake: /bake/i,
  },
  de: {
    removal: /nehmen sie eine (?:glutenfreie )?teigkugel .* aus der gärbox/i,
    transferWork: /legen sie sie (?:ohne druck )?auf .*arbeitsfläche/i,
    shaping: /formen|drücken/i,
    toppings: /belegen sie|geben sie den belag|verteilen sie/i,
    launch: /legen sie die pizza vorsichtig|legen sie sie vorsichtig|schieben sie sie vorsichtig/i,
    transferBake: /legen sie sie auf die ausgewählte backfläche/i,
    bake: /backen sie/i,
  },
  sl: {
    removal: /vzemite iz fermentacijske posode|vzemite .* iz fermentacijske posode/i,
    transferWork: /prenesite (?:jo )?na .*delovno površino/i,
    shaping: /oblikujte|vtisnite|pritiskajte/i,
    toppings: /obložite|dodajte nadev|razporedite/i,
    launch: /pico previdno položite|previdno prenesite|previdno vstavite/i,
    transferBake: /prenesi(?:te)? pico na izbrano površino|prenesi(?:te)? na izbrano površino/i,
    bake: /specite|pecite/i,
  },
};
const variants = ['napolitana', 'romanaTonda', 'romanaTeglia', 'newYork'];
const ovens = ['ooni', 'homeStone', 'homePan'];
const methods = ['biga', 'poolish'];
const mixingMethods = ['hand', 'mixer', 'spiral'];
const flourCases = [
  { flour: 'caputo00', blend: false, glutenFree: false },
  { flour: 'manitoba', blend: false, glutenFree: false },
  { flour: 'spelt', blend: false, glutenFree: false },
  { flour: 'wholeWheat', blend: false, glutenFree: false },
  { flour: 'glutenFree', blend: false, glutenFree: true },
  { flour: 'custom', blend: true, glutenFree: true },
  { flour: 'custom', blend: false, glutenFree: false },
];
const removalCountPatterns = {
  hr: /izvadite jednu (?:bezglutensku )?kuglicu|jednu (?:bezglutensku )?kuglicu[^.]*izvadite/gi,
  en: /remove one (?:gluten-free )?dough ball/gi,
  de: /nehmen sie eine (?:glutenfreie )?teigkugel/gi,
  sl: /eno (?:brezglutensko )?kroglico/gi,
};

function assertInOrder(text, expressions, label) {
  let previousIndex = -1;
  for (const expression of expressions) {
    const match = expression.exec(text);
    assert.ok(match, `${label}: expected ${expression} in generated instruction`);
    assert.ok(match.index > previousIndex, `${label}: ${expression} must follow the prior instruction`);
    previousIndex = match.index;
  }
}

const slovenianTrayCases = [
  [1, '1 pekač', '1 enako porcijo'],
  [2, '2 pekača', '2 enaki porciji'],
  [3, 'vse 3 pekače', '3 enake porcije'],
  [4, 'vse 4 pekače', '4 enake porcije'],
  [5, 'vseh 5 pekačev', '5 enakih porcij'],
  [12, 'vseh 12 pekačev', '12 enakih porcij'],
  [22, '22 pekača', '22 enaki porciji'],
];

for (const [trayCount, trayText, portionText] of slovenianTrayCases) {
  const phases = replaceProPhaseE(
    [{ title: 'Phase D: Existing romanaTeglia phase', steps: ['Existing phase'] }],
    {
      lang: 'sl',
      variant: 'romanaTeglia',
      glutenFree: false,
      oven: 'homeStone',
      ovenTemp: 280,
      fridgeHours: 24,
      finalRestMinutes: 30,
      diameter: 30,
      sauceAmount: 100,
      cheeseAmount: 100,
      trayCount,
      bakingTimeRange: '20–25 min',
      trayDimensions: { width: 30, length: 40 },
    },
  );
  const steps = phases.at(-1).steps;
  assert.equal(steps.length, 8, `sl/${trayCount}: Teglia keeps exactly eight final steps`);
  assert.match(steps[2], new RegExp(trayText), `sl/${trayCount}: correct tray form`);
  assert.match(steps[3], new RegExp(portionText), `sl/${trayCount}: correct portion form`);
  assert.match(steps[5], /po vsakem pekaču/, `sl/${trayCount}: toppings are stated per tray`);
}

for (const [lang, terms] of Object.entries(languages)) {
  for (const variant of variants) {
    for (const oven of ovens) {
      for (const fridgeHours of [0, 24]) {
        for (const glutenFree of [false, true]) {
          const phases = replaceProPhaseE(
            [{ title: `Phase D: Existing ${variant} phase`, steps: ['Existing phase'] }],
            {
              lang,
              variant,
              glutenFree,
              oven,
              ovenTemp: oven === 'ooni' ? 450 : oven === 'homeStone' ? 280 : 250,
              fridgeHours,
              finalRestMinutes: 30,
              diameter: 30,
              sauceAmount: 100,
              cheeseAmount: 100,
              trayCount: 1,
              bakingTimeRange: '5–7 min',
              trayDimensions: { width: 30, length: 40 },
            },
          );
          const steps = phases.at(-1).steps;
          if (variant === 'romanaTeglia') {
            assert.ok(steps.some((step) => /tepsij|tray|blech|pekač/i.test(step)), `${lang}/${oven}: Teglia keeps its tray workflow`);
            assert.ok(
              steps.every((step) => !/fermentacijske kutije|fermentation box|gärbox|fermentacijske posode/i.test(step)),
              `${lang}/${oven}: Teglia must not acquire round-ball removal instructions`,
            );
            continue;
          }

          const doughStep = steps[3];
          assert.match(doughStep, terms.removal, `${lang}/${variant}/${oven}: remove a ball before shaping`);
          assert.match(doughStep, terms.transferWork, `${lang}/${variant}/${oven}: transfer the removed ball to the work surface`);
          assert.equal(
            (steps.join(' ').match(removalCountPatterns[lang]) ?? []).length,
            1,
            `${lang}/${variant}/${oven}: exactly one removal instruction`,
          );
          assertInOrder(
            steps.slice(3).join(' '),
            [terms.removal, terms.transferWork, terms.shaping, terms.toppings, terms.launch, terms.bake],
            `${lang}/${variant}/${oven}/fridgeHours=${fridgeHours}/glutenFree=${glutenFree}`,
          );
        }
      }
    }
  }
}

for (const [lang, terms] of Object.entries(languages)) {
  for (const method of methods) {
    for (const mixing of mixingMethods) {
      for (const style of variants) {
        for (const { flour, blend, glutenFree } of flourCases) {
          const { p3 } = getYeastAwarePrefermentSteps(
            lang,
            method,
            mixing,
            'dry',
            '6.5 g',
            style === 'romanaTeglia',
            true,
            flour,
            blend,
          );
          const finalStep = p3.steps.at(-1);
          const label = `${lang}/${style}/${method}/${mixing}/${flour}`;

          if (style === 'romanaTeglia') {
            assert.ok(p3.steps.some((step) => /tepsij|tray|blech|pekač/i.test(step)), `${label}: preserve Teglia tray workflow`);
            assert.ok(
              p3.steps.every((step) => !terms.removal.test(step)),
              `${label}: Teglia must not acquire round-ball removal instructions`,
            );
            continue;
          }

          assertInOrder(
            finalStep,
            [terms.removal, terms.transferWork, terms.shaping, terms.toppings, terms.transferBake, terms.bake],
            label,
          );
          assert.equal(
            (finalStep.match(removalCountPatterns[lang]) ?? []).length,
            1,
            `${label}: exactly one removal instruction`,
          );
          if (glutenFree) {
            assert.match(finalStep, /certified|certific|zertifiziert/i, `${label}: specify gluten-free dusting flour`);
            assert.doesNotMatch(finalStep, /semola|semolina|grieß|zdrob/i, `${label}: do not use wheat semolina`);
          }
        }
      }
    }
  }
}

assert.match(indexSource, /\{\(!isBeginner \|\| beginnerDirectHome\) \?\s*\(/);
assert.match(indexSource, /const proPhaseEStepsBase = !isBeginner && detailedDirectSteps\s*\?\s*replaceProPhaseE/);
assert.match(indexSource, /const proPhaseESteps = oven === 'kamado' && proPhaseEStepsBase\s*\?\s*insertKamadoPreheatPhase/);

console.log('PRO final shaping order passed');
