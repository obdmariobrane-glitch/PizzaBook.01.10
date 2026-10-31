#!/usr/bin/env node

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const frontendRoot = path.join(__dirname, '..');
const indexPath = path.join(frontendRoot, 'app', '(tabs)', 'index.tsx');
const indexSource = fs.readFileSync(indexPath, 'utf8');
const indexFile = ts.createSourceFile(indexPath, indexSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

function findInitializer(sourceFile, name) {
  let initializer;
  const visit = (node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === name) {
      initializer = node.initializer;
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  assert.ok(initializer, `expected ${name} to have an initializer`);
  return initializer;
}

function evaluate(source, context = {}) {
  const module = { exports: {} };
  const compiled = ts.transpileModule(`module.exports = (${source});`, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  vm.runInNewContext(compiled, { module, exports: module.exports, ...context });
  return module.exports;
}

function loadTypeScriptModule(filePath) {
  const source = fs.readFileSync(filePath, 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const module = { exports: {} };
  const localRequire = (request) => {
    if (request === './spiralMixing') {
      return loadTypeScriptModule(path.join(frontendRoot, 'src', 'i18n', 'spiralMixing.ts'));
    }
    if (request === './proIceWaterInstructions') {
      return loadTypeScriptModule(path.join(frontendRoot, 'src', 'i18n', 'proIceWaterInstructions.ts'));
    }
    throw new Error(`Unexpected runtime import in ${filePath}: ${request}`);
  };
  vm.runInNewContext(compiled, { module, exports: module.exports, require: localRequire });
  return module.exports;
}

function findPoolishP1Guard(sourceFile) {
  let guard;
  const visit = (node) => {
    if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(sourceFile) === 'PhaseBlock') {
      const title = node.attributes.properties.find(
        (attribute) => ts.isJsxAttribute(attribute) && attribute.name.getText(sourceFile) === 'title',
      );
      if (title?.initializer && ts.isJsxExpression(title.initializer)
        && title.initializer.expression?.getText(sourceFile) === 'path.p1.title') {
        let branch = node;
        while (branch.parent && !ts.isConditionalExpression(branch.parent)) branch = branch.parent;
        if (ts.isConditionalExpression(branch.parent)) guard = branch.parent.condition.getText(sourceFile);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  assert.ok(guard, 'expected the detailed Poolish P1 phase to have a render guard');
  return guard;
}

const poolishPreparationInitializer = findInitializer(indexFile, 'poolishPreparation');
const poolishMixStepsInitializer = findInitializer(indexFile, 'poolishMixSteps');
const poolishPreparationSource = poolishPreparationInitializer.getText(indexFile);
const poolishMixStepsSource = poolishMixStepsInitializer.getText(indexFile);
const detailedP1Guard = findPoolishP1Guard(indexFile);
assert.equal(detailedP1Guard, 'isBeginner || !poolishPreparation');
assert.match(indexSource, /poolishPreparation && !poolishHomeSchedule/);
assert.match(indexSource, /const poolishHomeSchedule = isBeginner && method === 'poolish'/);
assert.equal((indexSource.match(/<PhaseBlock title=\{path\.p2\.title\} steps=\{withProIceWaterInstruction\(poolishMixSteps/g) ?? []).length, 1);

const { getFermentationSchedule } = loadTypeScriptModule(path.join(frontendRoot, 'src', 'calculator.ts'));
const { getYeastAwarePrefermentSteps } = loadTypeScriptModule(
  path.join(frontendRoot, 'src', 'i18n', 'prefermentSteps.ts'),
);

const languages = ['hr', 'en', 'de', 'sl'];
const styles = [
  { id: 'neapolitan', teglia: false },
  { id: 'romanaTonda', teglia: false },
  { id: 'romanaTeglia', teglia: true },
  { id: 'newYork', teglia: false },
];
const flourPaths = [
  { flour: 'caputo00', glutenFreeBlend: false },
  { flour: 'manitoba', glutenFreeBlend: false },
  { flour: 'spelt', glutenFreeBlend: false },
  { flour: 'wholeWheat', glutenFreeBlend: false },
  { flour: 'custom', glutenFreeBlend: false },
  { flour: 'custom', glutenFreeBlend: true },
];
const mixingMethods = ['hand', 'mixer', 'spiral'];
const fermentationModes = [
  { id: 'room-only', prefermentHours: 1, roomHours: 6, fridgeHours: 0 },
  { id: 'cold', prefermentHours: 24, roomHours: 2, fridgeHours: 18 },
];
const yeastTypes = ['fresh', 'activeDry', 'dry'];
const coldLabels = { hr: 'hladnjak', en: 'refrigerator', de: 'Kühlschrank', sl: 'hladilnik' };
const finalIngredientWords = {
  hr: { flour: /brašn/i, water: /vod/i, salt: /sol/i, oil: /ulj/i, yeast: /kvas/i },
  en: { flour: /flour/i, water: /water/i, salt: /salt/i, oil: /oil/i, yeast: /yeast/i },
  de: { flour: /mehl/i, water: /wasser/i, salt: /salz/i, oil: /öl/i, yeast: /hefe/i },
  sl: { flour: /mok/i, water: /vod/i, salt: /sol/i, oil: /olj/i, yeast: /kvas/i },
};
const shouldRenderDetailedP1 = (isBeginner, preparation) => isBeginner || !preparation;
const dough = {
  preferment: { flour: 175, water: 175, yeast: 0.1 },
  main: { flour: 325, water: 205, yeast: 0.2 },
  total: { salt: 14, oil: 12 },
};

let checked = 0;
for (const lang of languages) {
  for (const style of styles) {
    for (const flourPath of flourPaths) {
      for (const mixing of mixingMethods) {
        for (const fermentation of fermentationModes) {
          for (const yeastType of yeastTypes) {
            const schedule = getFermentationSchedule({
              method: 'poolish',
              prefermentHours: fermentation.prefermentHours,
              roomHours: fermentation.roomHours,
              roomTemp: 22,
              fridgeHours: fermentation.fridgeHours,
              fridgeTemp: 4,
            });
            const preparation = evaluate(poolishPreparationSource, {
              method: 'poolish',
              lang,
              poolishPct: 35,
              poolishHydrationPct: 100,
              dough,
              yeastShortLabel: yeastType,
              preferredYeastType: yeastType,
              mixing,
              isRomanTeglia: style.teglia,
              prefermentRoomHours: schedule.prefermentRoomHours,
              prefermentRoomTemperature: '22 °C',
              isBeginner: false,
              prefermentFridgeHours: schedule.prefermentFridgeHours,
              prefermentFridgeTemperature: '4 °C',
              poolishHours: fermentation.prefermentHours,
              croatianHours: (hours) => `${hours} sati`,
            });
            const detailedPath = getYeastAwarePrefermentSteps(
              lang,
              'poolish',
              mixing,
              yeastType,
              '0.2 g',
              style.teglia,
              true,
              flourPath.flour,
              flourPath.glutenFreeBlend,
            );
            const finalMixSteps = evaluate(poolishMixStepsSource, {
              method: 'poolish',
              lang,
              preferredYeastType: yeastType,
              mixingForExperience: mixing,
              dough,
              weight: (amount) => String(amount),
            }) ?? detailedPath.p2.steps;

            assert.equal(preparation.timers.length, 1);
            assert.equal(preparation.timers[0].id, 'poolish-fermentation');
            assert.equal(preparation.timers[0].seconds, fermentation.prefermentHours * 3600);
            assert.ok(preparation.steps.some((step) => step.includes('175')));
            assert.ok(preparation.steps.some((step) => step.toLowerCase().includes('poolish')));
            const preparationText = preparation.steps.join(' ').toLowerCase();
            assert.equal(preparationText.includes(coldLabels[lang].toLowerCase()), schedule.prefermentFridgeHours > 0);
            if (schedule.prefermentFridgeHours > 0) {
              assert.ok(preparationText.includes(String(schedule.prefermentFridgeHours)));
            }
            assert.ok(finalMixSteps.some((step) => step.includes('Poolish')));
            const mixingTitle = detailedPath.p2.title.toLowerCase();
            if (mixing === 'hand') {
              assert.equal(evaluate(poolishMixStepsSource, {
                method: 'poolish', lang, preferredYeastType: yeastType, mixingForExperience: mixing,
                dough, weight: (amount) => String(amount),
              }) !== null, true);
            } else {
              assert.equal(evaluate(poolishMixStepsSource, {
                method: 'poolish', lang, preferredYeastType: yeastType, mixingForExperience: mixing,
                dough, weight: (amount) => String(amount),
              }), null);
              assert.ok(mixingTitle.includes(mixing === 'mixer' ? ({
                hr: 'mikser', en: 'mixer', de: 'maschine', sl: 'mešalnik',
              }[lang]) : ({
                hr: 'spiral', en: 'spiral', de: 'spiral', sl: 'spiral',
              }[lang])), `${lang}/${mixing} must retain its equipment-specific title`);
            }
            const finalMixText = finalMixSteps.join(' ');
            if (mixing === 'hand') {
              for (const amount of ['325', '185', '20', '0.2', '14', '12']) {
                assert.ok(finalMixText.includes(amount), `${lang}/${style.id}/${flourPath.flour}/${mixing}/${fermentation.id}/${yeastType} must include ${amount}`);
              }
            } else {
              for (const ingredient of ['flour', 'water', 'salt', 'oil', 'yeast']) {
                assert.ok(finalIngredientWords[lang][ingredient].test(finalMixText), `${lang}/${style.id}/${flourPath.flour}/${mixing}/${fermentation.id}/${yeastType} must include ${ingredient}`);
              }
            }

            const prefermentPhases = schedule.phases.filter((phase) => phase.kind === 'preferment');
            const finalFermentationPhases = schedule.phases.filter((phase) => phase.kind === 'final');
            assert.ok(prefermentPhases.length > 0);
            assert.ok(finalFermentationPhases.length > 0);
            assert.ok(schedule.phases.findIndex((phase) => phase.kind === 'preferment')
              < schedule.phases.findIndex((phase) => phase.kind === 'final'));

            const isBeginner = false;
            const poolishHomeSchedule = false;
            const renderedPhases = [
              ...(preparation && !poolishHomeSchedule ? [{ kind: 'poolish-preparation', value: preparation }] : []),
              ...(shouldRenderDetailedP1(isBeginner, preparation) ? [{ kind: 'detailed-poolish-P1', value: detailedPath.p1 }] : []),
              { kind: 'final-dough-mix', value: { title: detailedPath.p2.title, steps: finalMixSteps } },
              { kind: 'final-dough-fermentation', value: detailedPath.p3 },
            ];
            assert.equal(renderedPhases.filter((phase) => phase.kind === 'poolish-preparation' || phase.kind === 'detailed-poolish-P1').length, 1);
            assert.equal(renderedPhases.filter((phase) => phase.kind === 'final-dough-mix').length, 1);
            assert.deepEqual(renderedPhases.map((phase) => phase.kind), [
              'poolish-preparation',
              'final-dough-mix',
              'final-dough-fermentation',
            ]);
            assert.equal(shouldRenderDetailedP1(true, preparation), true, 'Beginner keeps its existing detailed P1 render path');
            checked += 1;
          }
        }
      }
    }
  }
}

console.log(`F16 Poolish phase sequence passed: ${checked} generated combinations across HR/EN/DE/SL.`);
