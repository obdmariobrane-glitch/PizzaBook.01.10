#!/usr/bin/env node

const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const ts = require('typescript');
const vm = require('vm');

const frontendRoot = path.join(__dirname, '..');
const indexPath = path.join(frontendRoot, 'app', '(tabs)', 'index.tsx');
const indexSource = fs.readFileSync(indexPath, 'utf8');
const indexFile = ts.createSourceFile(indexPath, indexSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

function findFunction(filePath, name, scriptKind = ts.ScriptKind.TS) {
  const text = fs.readFileSync(filePath, 'utf8');
  const sourceFile = ts.createSourceFile(filePath, text, ts.ScriptTarget.Latest, true, scriptKind);
  let declaration;
  const visit = (node) => {
    if (ts.isFunctionDeclaration(node) && node.name?.text === name) declaration = node;
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  assert.ok(declaration, `expected ${name} to exist in ${filePath}`);
  return declaration.getText(sourceFile).replace(/^export\s+/, '');
}

function loadFunction(filePath, name, context = {}, scriptKind = ts.ScriptKind.TS) {
  const module = { exports: {} };
  const compiled = ts.transpileModule(
    `${findFunction(filePath, name, scriptKind)}\nmodule.exports = ${name};`,
    { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } },
  ).outputText;
  vm.runInNewContext(compiled, { module, exports: module.exports, ...context });
  return module.exports;
}

const replaceProPhaseE = loadFunction(
  indexPath,
  'replaceProPhaseE',
  {
    formatDuration: (seconds) => `${Math.round(seconds / 60)} min`,
    getRomanTegliaPressRestTimer: (lang) => ({
      id: 'teglia-press-rest',
      seconds: 5 * 60,
      kind: 'rest',
      label: ({ hr: 'Odmor za razvlačenje tijesta', en: 'Dough pressing rest', de: 'Teigruhe zum Eindrücken', sl: 'Počitek testa za vtiskovanje' })[lang],
    }),
    getBeginnerPreheatMinutes: () => 20,
    getTegliaFinalProofPlan: () => ({ proofMinutes: 0, pressRelaxationMinutes: 0 }),
    usesPizzaOvenBehavior: (oven) => oven === 'ooni',
  },
  ts.ScriptKind.TSX,
);

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

const { getYeastAwarePrefermentSteps, PHASE_TIMER_DURATIONS } = prefermentModule.exports;
const languages = ['hr', 'en', 'de', 'sl'];
const styles = ['napolitana', 'romanaTonda', 'romanaTeglia', 'newYork'];
const ovens = ['ooni', 'homeStone', 'homePan'];
const flours = ['caputo00', 'manitoba', 'spelt', 'wholeWheat', 'glutenFree', 'custom'];
const nonGlutenFreeFlours = flours.filter((flour) => flour !== 'glutenFree');
const methods = ['biga', 'poolish'];
const mixingMethods = ['hand', 'mixer', 'spiral'];
const bakeDuration = '60 s–90 s';
const noFoldWording = {
  hr: /nemojte preklapati/i,
  en: /do not fold/i,
  de: /falten sie .* nicht/i,
  sl: /ne prepogibajte/i,
};

function renderFinalPhase(lang, variant, oven, flour, blendA = 'caputo00', blendB = 'wholeWheat') {
  const result = replaceProPhaseE(
    [{ title: 'Phase D: Existing phase', steps: ['Existing final phase'], timers: [], phaseId: 'existing-final' }],
    {
      lang,
      variant,
      glutenFree: flour === 'glutenFree' || (flour === 'custom' && blendA === 'glutenFree' && blendB === 'glutenFree'),
      oven,
      ovenTemp: 450,
      fridgeHours: 24,
      finalRestMinutes: 30,
      diameter: 30,
      sauceAmount: 100,
      cheeseAmount: 100,
      trayCount: 1,
      bakingTimeRange: bakeDuration,
      trayDimensions: { width: 30, length: 40 },
    },
  );
  return result[result.length - 1];
}

function phaseText(phase) {
  return [
    ...phase.steps,
    ...phase.stepInfo.map(({ title, body }) => `${title}: ${body}`),
  ].join(' ');
}

const noWheatSemolina = /semol|zdrob|grieß/i;

for (const lang of languages) {
  for (const style of styles) {
    for (const oven of ovens) {
      const nonGlutenFreeBaseline = renderFinalPhase(lang, style, oven, 'caputo00');
      for (const flour of nonGlutenFreeFlours) {
        const result = renderFinalPhase(lang, style, oven, flour);
        assert.equal(
          JSON.stringify(result.steps),
          JSON.stringify(nonGlutenFreeBaseline.steps),
          `${lang}/${style}/${oven}/${flour} must retain existing non-gluten-free final steps`,
        );
        assert.equal(
          JSON.stringify(result.stepInfo),
          JSON.stringify(nonGlutenFreeBaseline.stepInfo),
          `${lang}/${style}/${oven}/${flour} must retain existing non-gluten-free final guidance`,
        );
      }

      const glutenFree = renderFinalPhase(lang, style, oven, 'glutenFree');
      assert.doesNotMatch(phaseText(glutenFree), noWheatSemolina, `${lang}/${style}/${oven} gluten-free final phase must not mention semolina`);
      assert.ok(glutenFree.steps.some((step) => step.includes(bakeDuration)), 'baking duration must remain unchanged');
      assert.ok(glutenFree.steps.some((step) => step.includes('450 °C')), 'baking temperature must remain unchanged');

      if (style === 'romanaTeglia') {
        assert.equal(
          JSON.stringify(glutenFree),
          JSON.stringify(nonGlutenFreeBaseline),
          `${lang}/${oven} Teglia final handling must remain unchanged`,
        );
      } else {
        const shapingStep = glutenFree.steps[4];
        assert.match(shapingStep, /30 cm/, `${lang}/${style}/${oven} must retain the target diameter`);
        assert.match(shapingStep, /press|pritisk|drück|utis|pritisk|vtis/i, `${lang}/${style}/${oven} must use gentle pressing`);
        if (oven !== 'homePan') {
          assert.match(glutenFree.steps[2], /certified|certific|zertifiziert/i, `${lang}/${style} must specify certified gluten-free dusting flour`);
        }
      }

      if (style !== 'romanaTeglia' && oven !== 'homePan') {
        assert.match(phaseText(nonGlutenFreeBaseline), noWheatSemolina, `${lang}/${style}/${oven} must preserve semolina for non-gluten-free dough`);
      }

      const glutenFreeBlend = renderFinalPhase(lang, style, oven, 'custom', 'glutenFree', 'glutenFree');
      assert.doesNotMatch(phaseText(glutenFreeBlend), noWheatSemolina, `${lang}/${style}/${oven} all-gluten-free blend must not mention semolina`);
      const mixedBlend = renderFinalPhase(lang, style, oven, 'custom', 'glutenFree', 'caputo00');
      assert.equal(
        JSON.stringify(mixedBlend.steps),
        JSON.stringify(renderFinalPhase(lang, style, oven, 'custom').steps),
        `${lang}/${style}/${oven} mixed flour blend must retain non-gluten-free instructions`,
      );
    }
  }
}

for (const lang of languages) {
  for (const style of styles) {
    for (const method of methods) {
      for (const mixing of mixingMethods) {
        const teglia = style === 'romanaTeglia';
        const baseline = getYeastAwarePrefermentSteps(lang, method, mixing, 'dry', '6.5 g', teglia, true, 'caputo00');
        const glutenFree = getYeastAwarePrefermentSteps(lang, method, mixing, 'dry', '6.5 g', teglia, true, 'glutenFree');
        assert.equal(glutenFree.p3.steps.length, baseline.p3.steps.length, `${lang}/${style}/${method}/${mixing} must preserve P3 step count`);

        if (teglia) {
          assert.equal(
            JSON.stringify(glutenFree.p3),
            JSON.stringify(baseline.p3),
            `${lang}/${method}/${mixing} Teglia P3 must remain unchanged`,
          );
          continue;
        }

        for (const flour of nonGlutenFreeFlours) {
          const result = getYeastAwarePrefermentSteps(lang, method, mixing, 'dry', '6.5 g', false, true, flour);
          assert.equal(
            JSON.stringify(result.p3),
            JSON.stringify(baseline.p3),
            `${lang}/${style}/${method}/${mixing}/${flour} must retain existing non-gluten-free P3 instructions`,
          );
        }

        const glutenFreeBlend = getYeastAwarePrefermentSteps(lang, method, mixing, 'dry', '6.5 g', false, true, 'custom', true);
        const mixedBlend = getYeastAwarePrefermentSteps(lang, method, mixing, 'dry', '6.5 g', false, true, 'custom', false);
        assert.doesNotMatch(glutenFreeBlend.p3.steps.join(' '), noWheatSemolina, `${lang}/${style}/${method}/${mixing} all-gluten-free blend must not mention semolina`);
        assert.equal(
          JSON.stringify(mixedBlend.p3),
          JSON.stringify(baseline.p3),
          `${lang}/${style}/${method}/${mixing} mixed flour blend must retain non-gluten-free P3 instructions`,
        );

        const p3Text = glutenFree.p3.steps.join(' ');
        assert.doesNotMatch(p3Text, noWheatSemolina, `${lang}/${style}/${method}/${mixing} gluten-free P3 must not mention semolina`);
        assert.doesNotMatch(p3Text, /stretch\s*&\s*fold|stretch and fold/i, `${lang}/${style}/${method}/${mixing} must not prescribe gluten stretch-and-fold`);
        assert.match(glutenFree.p3.steps[2], noFoldWording[lang], `${lang}/${style}/${method}/${mixing} must explicitly avoid folding gluten-free dough`);
        assert.match(glutenFree.p3.steps[2], /30|60|90/, `${lang}/${style}/${method}/${mixing} must preserve the existing rest duration`);
        assert.match(glutenFree.p3.steps[glutenFree.p3.steps.length - 1], /certified|certific|zertifiziert/i, `${lang}/${style}/${method}/${mixing} must specify certified gluten-free dusting flour`);
        assert.match(glutenFree.p3.steps[glutenFree.p3.steps.length - 1], /press|pritisk|drück|pritisk|pritisk|vtisk|utis/i, `${lang}/${style}/${method}/${mixing} must use pressing rather than stretching`);
      }
    }
  }
}

for (const method of methods) {
  for (const mixing of ['hand', 'mixer']) {
    const p3Timers = PHASE_TIMER_DURATIONS[`${method}-${mixing}-P3`];
    assert.ok(p3Timers, `${method}/${mixing} P3 timers must remain configured`);
  }
}
assert.deepEqual(
  JSON.parse(JSON.stringify(PHASE_TIMER_DURATIONS['biga-hand-P3'])),
  [
    { id: 'rest7m', seconds: 7 * 60, kind: 'rest' },
    { id: 'rt30m', seconds: 30 * 60, kind: 'rt' },
    { id: 'fr60m', seconds: 60 * 60, kind: 'fridge' },
    { id: 'brt15m', seconds: 15 * 60, kind: 'ballsRt' },
    { id: 'bfr5h', seconds: 5 * 3600, kind: 'ballsFridge' },
    { id: 'pb15m', seconds: 15 * 60, kind: 'preBake' },
  ],
);
assert.deepEqual(
  JSON.parse(JSON.stringify(PHASE_TIMER_DURATIONS['poolish-hand-P3'])),
  [
    { id: 'rt30m', seconds: 30 * 60, kind: 'rt' },
    { id: 'rt30m2', seconds: 30 * 60, kind: 'rt' },
    { id: 'brt3h', seconds: 3 * 3600, kind: 'ballsRt' },
  ],
);

assert.match(indexSource, /const proPhaseEStepsBase = !isBeginner && detailedDirectSteps\s*\?\s*replaceProPhaseE/);
assert.match(indexSource, /getYeastAwarePrefermentSteps\(lang, 'biga',[^;]*dough\.main\.oil > 0, flour, isProEffectivelyGlutenFree, remainingFlourDescription, fridgeTemp, proSpiralRecipe\)/);
assert.match(indexSource, /getYeastAwarePrefermentSteps\(lang, 'poolish',[^;]*dough\.main\.oil > 0, flour, isProEffectivelyGlutenFree, undefined, fridgeTemp, proSpiralRecipe\)/);
assert.match(indexSource, /glutenFree: isWorkflowGlutenFree/);

console.log('PRO gluten-free final handling passed.');
